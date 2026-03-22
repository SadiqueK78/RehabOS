/*
 * SMTP Email Service (calls the Express backend at /api/send-report)
 *
 * Backend Setup:
 * 1. Add SMTP credentials to .env in the app/ folder:
 *      SMTP_HOST=smtp.gmail.com
 *      SMTP_PORT=587
 *      SMTP_USER=your-email@gmail.com
 *      SMTP_PASS=your-app-password
 *      SMTP_FROM=your-email@gmail.com
 *
 * 2. For Gmail: enable 2FA → create App Password at
 *    https://myaccount.google.com/apppasswords
 *
 * 3. Run the backend: npm run server
 * 4. The React dev server proxies /api to the backend (see package.json proxy)
 */

const API_URL = process.env.REACT_APP_API_URL || "";

export const isEmailConfigured = () => true; // server validates SMTP config

/**
 * Send the rehabilitation report PDF to the user's email via the SMTP backend.
 */
export const sendReportEmail = async (pdfBlob, userEmail, userName) => {
  const formData = new FormData();
  formData.append("to_email", userEmail);
  formData.append("user_name", userName || "User");
  formData.append(
    "attachment",
    new File([pdfBlob], "rehabilitation-report.pdf", { type: "application/pdf" })
  );

  const res = await fetch(`${API_URL}/api/send-report`, {
    method: "POST",
    body: formData,
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Failed to send email");
  return data;
};
