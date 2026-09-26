// GET /api/billing/subscription?email= — what Stripe has confirmed this patient is entitled to.
const core = require("../../server/billing-core");

module.exports = async (req, res) => {
  try {
    const email = req.query?.email || new URL(req.url, "http://x").searchParams.get("email");
    res.json(await core.getEntitlements(email));
  } catch (err) {
    console.error("Entitlement lookup error:", err.message);
    res.status(500).json({ error: err.message });
  }
};
