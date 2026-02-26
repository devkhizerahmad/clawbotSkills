'use strict';

const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const { EMAIL_CONFIG } = require('../../config');

async function sendAgreementEmail(recipientEmail, tenantName, pdfPath) {
  // Use provided recipient or default
  const emailTo = recipientEmail || EMAIL_CONFIG.recipient;

  // Check email config
  if (!EMAIL_CONFIG.user || !EMAIL_CONFIG.pass) {
    console.log('Email config missing, skipping notification');
    return;
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(emailTo)) {
    console.log(`Invalid email address: ${emailTo}, skipping notification`);
    return;
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
  try {
    await transporter.sendMail(mailOptions);
    console.log(`Agreement email sent successfully to: ${emailTo}`);
  } catch (error) {
    console.error('Email send failed:', error.message);
  }
}

module.exports = { sendAgreementEmail };
