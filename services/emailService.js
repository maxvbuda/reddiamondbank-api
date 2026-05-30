const nodemailer = require('nodemailer');

// Transporter is configured via env vars set in Render dashboard:
//   EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASS, EMAIL_FROM
// Works with Gmail, SendGrid, Mailgun, or any SMTP provider.
function createTransporter() {
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT || '587'),
    secure: process.env.EMAIL_PORT === '465',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
}

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function sendVerificationEmail(toEmail, username, code) {
  const transporter = createTransporter();
  const from = process.env.EMAIL_FROM || process.env.EMAIL_USER;

  await transporter.sendMail({
    from: `"Red Diamond Bank" <${from}>`,
    to: toEmail,
    subject: 'Your Red Diamond Bank verification code',
    text: `Hi ${username},\n\nYour verification code is: ${code}\n\nIt expires in 15 minutes.\n\n— Red Diamond Bank`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px;background:#fff;border-radius:12px;border:1px solid #eee">
        <h2 style="color:#8B0000;margin-bottom:4px">◆ Red Diamond Bank</h2>
        <p style="color:#555">Hi <strong>${username}</strong>, verify your email to activate your account.</p>
        <div style="background:#8B0000;color:#fff;font-size:32px;font-weight:bold;letter-spacing:8px;text-align:center;padding:20px 0;border-radius:8px;margin:24px 0">
          ${code}
        </div>
        <p style="color:#999;font-size:13px">This code expires in 15 minutes. If you didn't sign up, ignore this email.</p>
      </div>
    `,
  });
}

module.exports = { generateCode, sendVerificationEmail };
