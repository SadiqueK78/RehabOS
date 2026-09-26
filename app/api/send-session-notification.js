// POST /api/send-session-notification — tell a patient their session is booked.
const mail = require("../server/mail");

module.exports = async (req, res) => {
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    res.json(await mail.sendSessionNotification(body));
  } catch (err) {
    console.error("Session notification email error:", err.message);
    res.status(err.status || 500).json({ error: "Failed to send notification: " + err.message });
  }
};
