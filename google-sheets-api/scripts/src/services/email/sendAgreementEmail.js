"use strict";

const nodemailer = require("nodemailer");
const fs = require("fs");
const path = require("path");
const { EMAIL_CONFIG } = require("../../config");
// Temporary fallback while the database connection is unavailable.
// const {
//  getLeaseContractById,
//   updateLeaseContractEmailSent,
// } = require("../mongodb/mongodbService");
const { hasEmail, addEmail, logAllEmails } = require("./sentEmailRegistry");
async function sendAgreementEmail(
  recipientEmail,
  tenantName,
  pdfPath,
  leaseContractId
) {
  // const leaseContract = leaseContractId
  //   ? await getLeaseContractById(leaseContractId)
  //   : null;

  // if (leaseContract?.emailSent) {
  //   console.log(
  //     `Agreement email already sent to: ${
  //       leaseContract.email || recipientEmail
  //     }`
  //   );
  //   return { sent: false, skipped: true, reason: "already-sent" };
  // }

  // Use provided recipient or default, while preserving the stored email field unchanged
  // const emailTo =
  //   leaseContract?.email || recipientEmail || EMAIL_CONFIG.recipient;
  const emailTo = recipientEmail || EMAIL_CONFIG.recipient;

  // Check email config
  if (!EMAIL_CONFIG.user || !EMAIL_CONFIG.pass) {
    console.log("Email config missing, skipping notification");
    return { sent: false, skipped: true, reason: "missing-config" };
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(emailTo)) {
    console.log(`Invalid email address: ${emailTo}, skipping notification`);
    return { sent: false, skipped: true, reason: "invalid-email" };
  }

  // Create transporter
  const transporter = nodemailer.createTransport({
    service: EMAIL_CONFIG.service,
    auth: {
      user: EMAIL_CONFIG.user,
      pass: EMAIL_CONFIG.pass,
    },
  });

  // Email content
  const mailOptions = {
    from: EMAIL_CONFIG.user,
    to: emailTo,
    subject: `Sublease Agreement - ${tenantName}`,
    text: `
Hello ${tenantName},

Please find attached your Sublease Agreement.

This is an automated notification from ClawdBot.
    `,
    html: `
      <h2>📄 Sublease Agreement</h2>
      <p>Hello <b>${tenantName}</b>,</p>
      <p>Please find attached your Sublease Agreement.</p>
      <br>
      <p><i>This is an automated notification from ClawdBot.</i></p>
    `,
    attachments: [
      {
        filename: path.basename(pdfPath),
        path: pdfPath,
      },
    ],
  };

  // Send email
  // Check if email already exists in memory registry
  if (hasEmail(emailTo)) {
    console.log(
      `[EmailRegistry] Email already exists in registry, skipping: ${emailTo}`
    );
    logAllEmails(); // Optional debug
    return { sent: false, skipped: true, reason: "memory-duplicate" };
  }
  try {
    await transporter.sendMail(mailOptions);
    // Add email to in-memory registry after successful send
    addEmail(emailTo);

    // Log registry contents
    logAllEmails();
    // if (leaseContractId) {
    //   await updateLeaseContractEmailSent(leaseContractId, true);
    // }

    console.log(`Agreement email sent successfully to: ${emailTo}`);
    return { sent: true, skipped: false };
  } catch (error) {
    console.error("Email send failed:", error.message);
    throw error;
  }
}

module.exports = { sendAgreementEmail };
