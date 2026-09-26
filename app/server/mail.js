/**
 * Sending mail, and checking that we can.
 *
 * Lives apart from the Express server so the same code runs as a Vercel function: the mail
 * endpoints used to exist only on the local server, which is why a scheduled session never
 * emailed anyone in production.
 *
 * Environment: SMTP_USER, SMTP_PASS, optionally SMTP_HOST (default smtp.gmail.com),
 * SMTP_PORT (default 587) and SMTP_FROM. With Gmail, SMTP_PASS must be an App Password;
 * an ordinary account password is refused.
 */

const nodemailer = require("nodemailer");

const configured = () => !!(process.env.SMTP_USER && process.env.SMTP_PASS);

const getTransporter = () =>
  nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT) || 587,
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });

/**
 * Open a connection and log in, without sending anything. This is the honest answer to "is the
 * mail server working": it proves the host, port and credentials, and nothing else does.
 */
async function verifyMail() {
  if (!configured()) return { ok: false, error: "SMTP_USER and SMTP_PASS are not set" };
  try {
    await getTransporter().verify();
    return { ok: true, host: process.env.SMTP_HOST || "smtp.gmail.com", user: process.env.SMTP_USER };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/** Tell a patient their session is booked, with the link to join. */
async function sendSessionNotification({ patientEmail, patientName, therapistName, scheduledDate, scheduledTime, sessionLink }) {
  if (!patientEmail || !scheduledDate || !scheduledTime || !sessionLink) {
    throw Object.assign(new Error("Missing required fields"), { status: 400 });
  }
  if (!configured()) throw Object.assign(new Error("SMTP is not configured"), { status: 503 });


  const transporter = getTransporter();
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
    const formattedDate = new Date(scheduledDate + "T00:00").toLocaleDateString("en-US", {
      weekday: "long", year: "numeric", month: "long", day: "numeric"
    });

    await transporter.sendMail({
      from: `"RehabOS" <${from}>`,
      to: patientEmail,
      subject: `Your Live Therapy Session is Scheduled – ${formattedDate}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0f0f0f;color:#e0e0e0;border-radius:16px;overflow:hidden;">
          <div style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:32px 24px;text-align:center;">
            <h1 style="color:#fff;margin:0;font-size:24px;">📹 Live Session Scheduled!</h1>
          </div>
          <div style="padding:32px 24px;">
            <p style="font-size:16px;margin:0 0 20px;">Hi ${patientName || "there"},</p>
            <p style="font-size:15px;line-height:1.6;margin:0 0 24px;color:#d1d5db;">
              Great news! <strong style="color:#818cf8;">Dr. ${therapistName || "Your Therapist"}</strong> has 
              scheduled a live video therapy session with you.
            </p>
            <div style="background:#1a1a2e;border:1px solid #2a2a3e;border-radius:12px;padding:20px;margin:0 0 24px;">
              <table style="width:100%;border-collapse:collapse;">
                <tr>
                  <td style="padding:8px 0;color:#9ca3af;font-size:13px;">📅 Date</td>
                  <td style="padding:8px 0;color:#fff;font-weight:600;text-align:right;">${formattedDate}</td>
                </tr>
                <tr>
                  <td style="padding:8px 0;color:#9ca3af;font-size:13px;">⏰ Time</td>
                  <td style="padding:8px 0;color:#fff;font-weight:600;text-align:right;">${scheduledTime}</td>
                </tr>
                <tr>
                  <td style="padding:8px 0;color:#9ca3af;font-size:13px;">👨‍⚕️ Therapist</td>
                  <td style="padding:8px 0;color:#818cf8;font-weight:600;text-align:right;">Dr. ${therapistName || "N/A"}</td>
                </tr>
              </table>
            </div>
            <div style="text-align:center;margin:0 0 24px;">
              <a href="${sessionLink}" style="display:inline-block;background:linear-gradient(135deg,#22c55e,#16a34a);color:#fff;text-decoration:none;padding:14px 32px;border-radius:10px;font-weight:700;font-size:16px;">
                Join Session
              </a>
            </div>
            <p style="font-size:13px;color:#6b7280;line-height:1.5;margin:0 0 8px;">
              💡 <strong>Tip:</strong> You can join the session up to 15 minutes before the scheduled time. 
              Make sure your camera and microphone are enabled.
            </p>
            <p style="font-size:13px;color:#6b7280;line-height:1.5;margin:0;">
              If the button doesn't work, copy and paste this link into your browser:<br/>
              <a href="${sessionLink}" style="color:#818cf8;word-break:break-all;">${sessionLink}</a>
            </p>
          </div>
          <div style="background:#0a0a0a;padding:16px 24px;text-align:center;border-top:1px solid #1e1e1e;">
            <p style="font-size:11px;color:#4b5563;margin:0;">This is an automated notification from RehabOS. Do not reply to this email.</p>
          </div>
        </div>
      `,
    });

  return { success: true, message: `Session notification sent to ${patientEmail}` };
}

module.exports = { configured, getTransporter, verifyMail, sendSessionNotification };
