// GET /api/health — is the API up, and does it have what it needs?
const core = require("../server/billing-core");
const { status } = require("../server/store");
const mail = require("../server/mail");

module.exports = async (req, res) => {
  const store = status();
  // ?verify=mail logs in to the SMTP server without sending anything, which is the only way to
  // know the credentials actually work.
  const checkMail = req.query?.verify === "mail" || new URL(req.url, "http://x").searchParams.get("verify") === "mail";
  res.setHeader("Cache-Control", "no-store");
  res.status(store.ok ? 200 : 500).json({
    status: store.ok ? "ok" : "degraded",
    stripe: core.isConfigured() ? "configured" : "not configured",
    entitlementStore: store,
    mail: checkMail ? await mail.verifyMail() : { configured: mail.configured() },
  });
};
