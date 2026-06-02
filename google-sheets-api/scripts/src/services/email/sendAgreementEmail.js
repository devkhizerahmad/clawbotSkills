'use strict';

const nodemailer = require('nodemailer');
const { Resend } = require('resend');
const path = require('path');
const { EMAIL_CONFIG } = require('../../config');
const { logAudit } = require('../audit/logAudit');
const fs = require('fs');

async function sendAgreementEmail(recipientEmail, tenantName, pdfPath, isLetterhead) {
  const pdfBuffer = fs.readFileSync(pdfPath);
  const emailTo = recipientEmail || EMAIL_CONFIG.recipient;

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(emailTo)) {
    console.log(`Invalid email address: ${emailTo}, skipping notification`);
    return;
  }

  const subject = `Sublease Agreement - ${tenantName}`;
  const text = `
Hello ${tenantName},

Please find attached your Sublease Agreement.

This is an automated notification from ClawdBot.
  `;
  const html = `
      <h2>📄 Sublease Agreement</h2>
      <p>Hello <b>${tenantName}</b>,</p>
      <p>Please find attached your Sublease Agreement.</p>
      <br>
      <p><i>This is an automated notification from ClawdBot.</i></p>
  `;

  try {
    if (isLetterhead) {
      const resendApiKey = process.env.RESEND_API_KEY || EMAIL_CONFIG.resendApiKey;
      const resendFrom = process.env.RESEND_FROM || EMAIL_CONFIG.resendFrom;

      if (!resendApiKey || !resendFrom) {
        console.log('Resend config missing, skipping notification');
        return;
      }
      try {
        const resend = new Resend(resendApiKey);
        await resend.emails.send({
          from: resendFrom,
          to: emailTo,
          subject,
          //text,
          html,
          attachments: [
            {
              filename: path.basename(pdfPath),
              content: pdfBuffer,
            },
          ],
        });
        console.log(`Agreement email sent successfully to: ${emailTo} via Resend`);
      } catch (err) {
        console.error('Resend email send failed:', err.message);
        throw err; // Re-throw to be caught by outer catch for audit logging
      }
    } else {
      const userEmail = EMAIL_CONFIG.user;
      const userPass = EMAIL_CONFIG.pass;

      if (!userEmail || !userPass) {
        console.log('Email config missing, skipping notification');
        return;
      }
      try {

        const transporter = nodemailer.createTransport({
          service: EMAIL_CONFIG.service,
          auth: {
            user: userEmail,
            pass: userPass,
          },
        });

        await transporter.sendMail({
          from: userEmail,
          to: emailTo,
          subject,
          text,
          html,
          attachments: [
            {
              filename: path.basename(pdfPath),
              path: pdfPath,
            },
          ],
        });
        console.log(`Agreement email sent successfully to: ${emailTo} via nodemailer`);
      } catch (err) {
        console.error('Nodemailer email send failed:', err.message);
        throw err; // Re-throw to be caught by outer catch for audit logging
      }
    }

    // Audit log for successful email send (mutation complete)
    try {
      await logAudit({
        user: 'LEASE_SERVICE',
        sheet: 'Lease_Email',
        cell: 'N/A',
        oldValue: 'Email not sent',
        newValue: `Lease agreement sent to ${emailTo} for ${tenantName}`,
        source: 'AGREEMENT_EMAIL',
      });
    } catch (err) {
      console.warn('Audit log failed:', err.message);
    }
  } catch (error) {
    console.error('Email send failed:', error.message);
  }
}

module.exports = { sendAgreementEmail };
