/**
 * Billing logic, with no web framework in it.
 *
 * Express uses this locally; on Vercel each endpoint is its own function that calls the same
 * functions. Keeping the rules here means the entitlement behaviour is identical wherever it
 * runs, and testable without starting a server.
 *
 * Stripe is the only thing that knows whether money moved, so the browser never says what
 * something costs: it sends a plan id, this file decides the amount, and access is granted when
 * Stripe's webhook says the payment settled. That matters especially for UPI, which settles
 * asynchronously — a patient can be back on the site before their bank has confirmed.
 *
 * Environment:
 *   STRIPE_SECRET_KEY         sk_test_... or, better, a restricted key rk_...
 *   STRIPE_WEBHOOK_SECRET     whsec_... for the webhook endpoint
 *   STRIPE_PRICE_RECOVER      (optional) price_... per plan; without these the server falls
 *   STRIPE_PRICE_CARE                    back to inline prices, fine for a sandbox
 *   STRIPE_PRICE_CAREPLUS
 *   STRIPE_PRICE_SESSIONTOPUP
 *   FIREBASE_SERVICE_ACCOUNT  service-account JSON, required on Vercel (see server/store.js)
 *   PUBLIC_SITE_URL           where to send the patient back to
 */

const Stripe = require("stripe");
const { recordFor, updateRecord } = require("./store");

let client = null;
/** The Stripe client, or null when no key is configured. */
function stripe() {
  if (!client && process.env.STRIPE_SECRET_KEY) client = new Stripe(process.env.STRIPE_SECRET_KEY);
  return client;
}
const isConfigured = () => !!stripe();

// Amounts in paise: 49900 is 499 rupees. Every recurring amount stays under the 15,000 rupee
// ceiling UPI AutoPay puts on a mandate, so a patient can pay by UPI rather than needing a card.
const PLANS = {
  recover: { amount: 49900, name: "RehabOS Recover", recurring: true, priceEnv: "STRIPE_PRICE_RECOVER" },
  care: { amount: 99900, name: "RehabOS Care", recurring: true, priceEnv: "STRIPE_PRICE_CARE" },
  carePlus: { amount: 179900, name: "RehabOS Care Plus", recurring: true, priceEnv: "STRIPE_PRICE_CAREPLUS" },
  sessionTopup: { amount: 34900, name: "RehabOS extra live session", recurring: false, priceEnv: "STRIPE_PRICE_SESSIONTOPUP" },
};

const siteUrl = (origin) => origin || process.env.PUBLIC_SITE_URL || "http://localhost:3000";

// Stripe asks for a label with an eight-letter suffix so flows can be compared in the Dashboard.
const randomSuffix = () =>
  Array.from({ length: 8 }, () => "abcdefghijklmnopqrstuvwxyz"[Math.floor(Math.random() * 26)]).join("");

/** A configured Price when one exists for this plan, otherwise an inline one. */
function lineItem(plan) {
  const configured = process.env[plan.priceEnv];
  if (configured) return { price: configured, quantity: 1 };
  return {
    quantity: 1,
    price_data: {
      currency: "inr",
      unit_amount: plan.amount,
      product_data: { name: plan.name },
      ...(plan.recurring ? { recurring: { interval: "month" } } : {}),
    },
  };
}

/** Start a Checkout Session. Throws with a `status` for the caller to answer with. */
async function createCheckout({ planId, email, origin }) {
  const plan = PLANS[planId];
  if (!plan) throw Object.assign(new Error("Unknown plan"), { status: 400 });
  if (!email) throw Object.assign(new Error("Missing customer email"), { status: 400 });

  const site = siteUrl(origin);
  const existing = await recordFor(email);
  const session = await stripe().checkout.sessions.create({
    mode: plan.recurring ? "subscription" : "payment",
    line_items: [lineItem(plan)],
    ...(existing?.customerId ? { customer: existing.customerId } : { customer_email: email }),
    // Carried through to the webhook, which is what actually grants the plan.
    metadata: { email, planId },
    ...(plan.recurring ? { subscription_data: { metadata: { email, planId } } } : {}),
    integration_identifier: `rehabos-checkout-${randomSuffix()}`,
    success_url: `${site}/billing/return?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${site}/pricing?checkout=cancelled`,
  });
  return { url: session.url, id: session.id };
}

/** What this patient is entitled to, according to what Stripe has told us. */
async function getEntitlements(email) {
  const record = await recordFor(email);
  if (!record) return { planId: null, status: null, extraSessions: 0 };
  return {
    planId: record.planId || null,
    status: record.status || null,
    customerId: record.customerId || null,
    subscriptionId: record.subscriptionId || null,
    currentPeriodStart: record.currentPeriodStart || null,
    currentPeriodEnd: record.currentPeriodEnd || null,
    // Records written before startedAt existed fall back to when they were last written.
    startedAt: record.startedAt || record.updatedAt || null,
    extraSessions: record.extraSessions || 0,
    updatedAt: record.updatedAt || null,
  };
}

/** Stripe's own page for changing payment method, switching plan or cancelling. */
async function createPortal({ email, origin }) {
  const record = await recordFor(email);
  if (!record?.customerId) throw Object.assign(new Error("No Stripe customer for that account"), { status: 400 });
  const session = await stripe().billingPortal.sessions.create({
    customer: record.customerId,
    return_url: `${siteUrl(origin)}/dashboard`,
  });
  return { url: session.url };
}

/** One Checkout Session, for the "did that go through?" screen. */
async function getSession(id) {
  const session = await stripe().checkout.sessions.retrieve(id, { expand: ["subscription"] });
  return {
    paymentStatus: session.payment_status,
    status: session.status,
    planId: session.metadata?.planId || null,
    email: session.metadata?.email || session.customer_email || null,
    mode: session.mode,
    // "unpaid" here is normal for UPI: the bank may still be confirming.
    settled: session.payment_status === "paid",
  };
}

async function emailForCustomer(customer) {
  if (!customer) return null;
  const id = typeof customer === "string" ? customer : customer.id;
  try {
    const c = await stripe().customers.retrieve(id);
    return c?.email || c?.metadata?.email || null;
  } catch {
    return null;
  }
}

/**
 * What Stripe tells us happened. This is what grants and removes access: renewals, failed
 * payments and cancellations all happen when nobody is looking at the site.
 */
async function handleEvent(event) {
  const object = event.data.object;

  switch (event.type) {
    // Both mean "the money is in". The second is the one UPI and other asynchronous methods
    // arrive on, sometimes minutes after the patient closed the tab.
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      if (object.payment_status !== "paid") break; // still pending: wait for the async event
      const email = object.metadata?.email || object.customer_email;
      const planId = object.metadata?.planId;
      if (!email || !planId) break;
      if (planId === "sessionTopup") {
        const current = await recordFor(email);
        await updateRecord(email, { extraSessions: (current?.extraSessions || 0) + 1 });
      } else {
        const current = await recordFor(email);
        await updateRecord(email, {
          planId,
          status: "active",
          customerId: typeof object.customer === "string" ? object.customer : object.customer?.id || null,
          subscriptionId: typeof object.subscription === "string" ? object.subscription : null,
          // Sessions booked before this moment belong to whatever came before, so the allowance
          // counts from here. Kept on a plan change so an upgrade does not reset the month.
          startedAt: current?.startedAt || Date.now(),
        });
      }
      break;
    }

    case "checkout.session.async_payment_failed": {
      const email = object.metadata?.email || object.customer_email;
      if (email) await updateRecord(email, { lastFailureAt: Date.now() });
      break;
    }

    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const email = object.metadata?.email || (await emailForCustomer(object.customer));
      if (!email) break;
      const ended = event.type === "customer.subscription.deleted" || object.status === "canceled";
      await updateRecord(email, {
        planId: ended ? null : object.metadata?.planId || (await recordFor(email))?.planId || null,
        status: ended ? "canceled" : object.status,
        subscriptionId: object.id,
        customerId: typeof object.customer === "string" ? object.customer : object.customer?.id || null,
        currentPeriodStart: object.current_period_start ? object.current_period_start * 1000 : null,
        currentPeriodEnd: object.current_period_end ? object.current_period_end * 1000 : null,
      });
      break;
    }

    case "invoice.paid": {
      const email = await emailForCustomer(object.customer);
      if (email) await updateRecord(email, { status: "active", lastPaidAt: Date.now() });
      break;
    }

    case "invoice.payment_failed": {
      const email = await emailForCustomer(object.customer);
      // Access stays on while Stripe retries; the patient keeps their exercises either way.
      if (email) await updateRecord(email, { status: "past_due", lastFailureAt: Date.now() });
      break;
    }

    default:
      break;
  }
}

/** Verify a webhook's signature against the raw bytes Stripe sent. */
async function constructEvent(rawBody, signature) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET is not set");
  return stripe().webhooks.constructEventAsync(rawBody, signature, secret);
}

module.exports = {
  stripe,
  isConfigured,
  createCheckout,
  getEntitlements,
  createPortal,
  getSession,
  handleEvent,
  constructEvent,
  recordFor,
};
