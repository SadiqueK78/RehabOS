/**
 * The entitlement rules, tested against the webhook events Stripe actually sends.
 * Run with:  npm run test:server
 */
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

// A scratch store, and a key so the module believes Stripe is configured.
process.env.BILLING_STORE = path.join(os.tmpdir(), `rehabos-billing-${Date.now()}.json`);
process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "sk_test_not_a_real_key";

const { handleEvent, recordFor } = require("./billing-core");

const EMAIL = "patient@example.com";
const event = (type, object) => ({ type, data: { object } });
const checkout = (over = {}) => ({
  payment_status: "paid",
  customer: "cus_123",
  subscription: "sub_123",
  metadata: { email: EMAIL, planId: "care" },
  ...over,
});

test.beforeEach(() => {
  try {
    fs.unlinkSync(process.env.BILLING_STORE);
  } catch {
    /* first run */
  }
});

test("a completed checkout grants the plan that was paid for", async () => {
  await handleEvent(event("checkout.session.completed", checkout()));
  const record = await recordFor(EMAIL);
  assert.equal(record.planId, "care");
  assert.equal(record.status, "active");
  assert.equal(record.customerId, "cus_123");
  assert.equal(record.subscriptionId, "sub_123");
});

test("a UPI payment that is still pending grants nothing yet", async () => {
  await handleEvent(event("checkout.session.completed", checkout({ payment_status: "unpaid" })));
  assert.equal(await recordFor(EMAIL), null);

  // The bank confirms minutes later, long after the patient closed the tab.
  await handleEvent(event("checkout.session.async_payment_succeeded", checkout()));
  assert.equal((await recordFor(EMAIL)).planId, "care");
});

test("the plan is never taken from what the browser claims", async () => {
  await handleEvent(event("checkout.session.completed", checkout({ metadata: { email: EMAIL } })));
  assert.equal(await recordFor(EMAIL), null, "no plan id in Stripe's own metadata means no entitlement");
});

test("an extra session tops up instead of changing the plan", async () => {
  await handleEvent(event("checkout.session.completed", checkout({ metadata: { email: EMAIL, planId: "care" } })));
  await handleEvent(
    event("checkout.session.completed", checkout({ metadata: { email: EMAIL, planId: "sessionTopup" } }))
  );
  const record = await recordFor(EMAIL);
  assert.equal(record.planId, "care", "the plan is unchanged");
  assert.equal(record.extraSessions, 1);
});

test("cancelling in Stripe removes the plan", async () => {
  await handleEvent(event("checkout.session.completed", checkout()));
  await handleEvent(
    event("customer.subscription.deleted", {
      id: "sub_123",
      customer: "cus_123",
      status: "canceled",
      metadata: { email: EMAIL, planId: "care" },
    })
  );
  const record = await recordFor(EMAIL);
  assert.equal(record.planId, null);
  assert.equal(record.status, "canceled");
});

test("a failed renewal marks the account past due rather than cutting it off", async () => {
  await handleEvent(event("checkout.session.completed", checkout()));
  await handleEvent(
    event("customer.subscription.updated", {
      id: "sub_123",
      customer: "cus_123",
      status: "past_due",
      metadata: { email: EMAIL, planId: "care" },
      current_period_end: 1790000000,
    })
  );
  const record = await recordFor(EMAIL);
  assert.equal(record.status, "past_due");
  assert.equal(record.planId, "care", "the patient keeps access while Stripe retries");
  assert.equal(record.currentPeriodEnd, 1790000000 * 1000);
});

test("an unrelated event changes nothing", async () => {
  await handleEvent(event("payment_intent.created", { id: "pi_1" }));
  assert.equal(await recordFor(EMAIL), null);
});
