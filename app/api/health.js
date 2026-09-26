// GET /api/health — is the API up, and does it have what it needs?
const core = require("../server/billing-core");
const { status } = require("../server/store");

module.exports = (_req, res) => {
  const store = status();
  res.setHeader("Cache-Control", "no-store");
  res.status(store.ok ? 200 : 500).json({
    status: store.ok ? "ok" : "degraded",
    stripe: core.isConfigured() ? "configured" : "not configured",
    entitlementStore: store,
  });
};
