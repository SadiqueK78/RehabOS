// POST /api/billing/portal — Stripe's page for changing plan, card or cancelling.
const core = require("../../server/billing-core");

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });
  if (!core.isConfigured()) return res.status(503).json({ error: "Stripe is not configured." });
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    res.json(await core.createPortal(body));
  } catch (err) {
    console.error("Stripe portal error:", err.message);
    res.status(err.status || 500).json({ error: err.message });
  }
};
