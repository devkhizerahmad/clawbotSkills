"use strict";

const nodemailer = require("nodemailer");
const path = require("path");
const { EMAIL_CONFIG } = require("../../config");

async function sendReportEmail(recipient, subject, body, attachmentPath) {
  if (!EMAIL_CONFIG.user || !EMAIL_CONFIG.pass) {
    console.warn("Email credentials not set in EMAIL_CONFIG. Skipping email.");
    return { skipped: true, reason: "Email credentials not configured." };
  }

  const transporter = nodemailer.createTransport({
    service: EMAIL_CONFIG.service,
    auth: {
      user: EMAIL_CONFIG.user,
      pass: EMAIL_CONFIG.pass,
    },
  });

  const mailOptions = {
    from: `"Hive NY Automation" <${EMAIL_CONFIG.user}>`,
    to: recipient,
    subject: subject,
    text: body,
    attachments: [
      {
        filename: path.basename(attachmentPath),
        path: attachmentPath,
        contentType: "application/pdf",
      },
    ],
  };

  return transporter.sendMail(mailOptions);
}

module.exports = { sendReportEmail };
