/**
 * The billing endpoints as Express routes, for local development.
 *
 * All of the thinking lives in billing-core.js, which the Vercel functions under api/ call
 * directly. This file is only the web plumbing, so both deployments behave identically.
 */

const express = require("express");
const core = require("./billing-core");

const router = express.Router();

const requireStripe = (res) => {
  if (core.isConfigured()) return true;
  res.status(503).json({ error: "Stripe is not configured on this server (set STRIPE_SECRET_KEY)." });
  return false;
};

const fail = (res, err, what) => {
  console.error(`${what}:`, err.message);
  res.status(err.status || 500).json({ error: err.message });
};

router.post("/api/billing/checkout", async (req, res) => {
  if (!requireStripe(res)) return;
  try {
    res.json(await core.createCheckout({ ...(req.body || {}) }));
  } catch (err) {
    fail(res, err, "Stripe checkout error");
  }
});

/**
 * What the patient's app is entitled to. The app polls this after checkout instead of believing
 * the success page, which is what makes an asynchronous UPI payment safe to rely on.
 */
router.get("/api/billing/subscription", async (req, res) => {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  try {
    res.json(await core.getEntitlements(req.query.email));
  } catch (err) {
    fail(res, err, "Entitlement lookup error");
  }
});

router.get("/api/billing/session/:id", async (req, res) => {
  if (!requireStripe(res)) return;
  try {
    res.json(await core.getSession(req.params.id));
  } catch (err) {
    console.error("Stripe session lookup error:", err.message);
    res.status(404).json({ error: "Session not found" });
  }
});

router.post("/api/billing/portal", async (req, res) => {
  if (!requireStripe(res)) return;
  try {
    res.json(await core.createPortal({ email: req.body?.email, origin: req.body?.origin }));
  } catch (err) {
    fail(res, err, "Stripe portal error");
  }
});

/**
 * The webhook, which is what grants and removes access. Locally:
 *   stripe listen --forward-to localhost:5000/api/billing/webhook
 * On Vercel this path is served by api/billing/webhook.mjs instead, because a function there can
 * read the raw request bytes that Stripe's signature is calculated over.
 */
router.post("/api/billing/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  if (!core.isConfigured()) return res.status(503).end();
  let event;
  try {
    event = await core.constructEvent(req.body, req.headers["stripe-signature"]);
  } catch (err) {
    console.error("Stripe webhook rejected:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }
  try {
    await core.handleEvent(event);
  } catch (err) {
    // Answer with an error so Stripe retries: a 200 here would mean the payment is never
    // retried even though nothing was stored.
    console.error("Stripe webhook handling failed:", event.type, err.message);
    return res.status(500).send(`Handler error: ${err.message}`);
  }
  res.json({ received: true });
});

module.exports = router;
module.exports.isConfigured = core.isConfigured;
