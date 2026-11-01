// Mailer — Nodemailer with graceful fallback. Never throws (ADR: alert stored even if SMTP down).
const nodemailer = require('nodemailer');
const config = require('../config');

let transporter = null;
function getTransporter() {
  if (transporter) return transporter;
  if (config.smtp.host) {
    transporter = nodemailer.createTransport({
      host: config.smtp.host, port: config.smtp.port,
      auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
    });
  } else {
    transporter = nodemailer.createTransport({ jsonTransport: true });
  }
  return transporter;
}
async function sendAlertEmail(to, subject, text) {
  try {
    await getTransporter().sendMail({ from: config.smtp.from, to: to || config.smtp.user || 'admin@hazard.local', subject, text });
    return true;
  } catch (e) {
    console.warn(`[WARN][mailer] send failed (stored anyway): ${e.message}`);
    return false;
  }
}
module.exports = { sendAlertEmail };
