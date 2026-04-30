'use strict';

const nodemailer = require('nodemailer');
const { EMAIL_CONFIG } = require('../../config');
const { logAudit } = require('../audit/logAudit');

async function sendCleaningDateEmail(cell, oldValue, newValue, recipientEmail, isMoveout = false) {
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
  const moveoutStatus = isMoveout ? 'Yes (Move-out)' : 'No (Regular Cleaning)';
  const mailOptions = {
    from: EMAIL_CONFIG.user,
    to: emailTo,
    subject: `Cleaning Date Updated - ${cell} ${isMoveout ? '(Move-out)' : ''}`,
    text: `
Cleaning Date Modified!

Cell: ${cell}
Old Value: ${oldValue || '(empty)'}
New Value: ${newValue}
Move-out: ${moveoutStatus}
Time: ${new Date().toLocaleString()}

This is an automated notification from ClawdBot.
    `,
    html: `
      <h2>🧹 Cleaning Date Modified!</h2>
      <table border="1" cellpadding="8" cellspacing="0">
        <tr><td><b>Cell</b></td><td>${cell}</td></tr>
        <tr><td><b>Old Value</b></td><td>${oldValue || '(empty)'}</td></tr>
        <tr><td><b>New Value</b></td><td>${newValue}</td></tr>
        <tr><td><b>Move-out</b></td><td>${moveoutStatus}</td></tr>
        <tr><td><b>Time</b></td><td>${new Date().toLocaleString()}</td></tr>
      </table>
      <br>
      <p><i>This is an automated notification from ClawdBot.</i></p>
    `,
  };

  // Send email
  try {
    await transporter.sendMail(mailOptions);
    console.log(`Email notification sent successfully to: ${emailTo}`);
    
    // Audit log for successful email send (mutation complete)
    try {
      const moveoutStatusText = isMoveout ? 'Move-out Cleaning' : 'Regular Cleaning';
      await logAudit({
        user: 'CLEANING_EMAIL_SERVICE',
        sheet: 'Cleaning_Email',
        cell: cell,
        oldValue: 'Email sent',
        newValue: `Email sent to ${emailTo} | Type: ${moveoutStatusText}`,
        source: 'CLEANING_SERVICE',
      });
    } catch (err) {
      console.warn('Audit log failed:', err.message);
    }
  } catch (error) {
    console.error('Email send failed:', error.message);
  }
}

module.exports = { sendCleaningDateEmail };
