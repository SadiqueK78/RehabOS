// GET /api/health — is the API up, and does it have what it needs?
const core = require("../server/billing-core");
const { usingFirestore } = require("../server/store");

module.exports = (_req, res) =>
  res.json({
    status: "ok",
    stripe: core.isConfigured() ? "configured" : "not configured",
    entitlementStore: usingFirestore() ? "firestore" : "local file",
  });
