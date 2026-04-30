'use strict';

const nodemailer = require('nodemailer');
const { EMAIL_CONFIG } = require('../../config');
const { logAudit } = require('../audit/logAudit');

async function sendCleaningDateEmail(cell, oldValue, newValue, recipientEmail, isMoveout = false) {
  const emailTo = recipientEmail || EMAIL_CONFIG.recipient;

  if (!EMAIL_CONFIG.user || !EMAIL_CONFIG.pass) {
    console.log('Email config missing, skipping notification');
    return;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(emailTo)) {
    console.log(`Invalid email address: ${emailTo}, skipping notification`);
    return;
  }

  const transporter = nodemailer.createTransport({
    service: EMAIL_CONFIG.service,
    auth: {
      user: EMAIL_CONFIG.user,
      pass: EMAIL_CONFIG.pass,
    },
  });

  const timestamp = new Date().toISOString();
  const formattedDate = new Date().toLocaleString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  });

  const cleaningType = isMoveout ? 'Yes (Move-out)' : 'No (Regular Cleaning)';
  const companyName = EMAIL_CONFIG.companyName || 'Property Management';
  const companyEmail = EMAIL_CONFIG.user || 'noreply@example.com';

  const textContent = `Dear Resident,

This is an automated notification regarding an update to your cleaning schedule.

CLEANING SCHEDULE UPDATE
========================

Property/Cell: ${cell}
Previous Date: ${oldValue || 'Not set'}
New Date: ${newValue}
Cleaning Type: ${cleaningType}
Update Timestamp: ${formattedDate}

If you have any questions or need to verify this information, please contact the property management team.

Best regards,
${companyName}
Property Management Team`;

  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Cleaning Schedule Update</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5; -webkit-font-smoothing: antialiased;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f5f5f5;">
    <tr>
      <td align="center" style="padding: 20px 10px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background-color: #2c3e50; padding: 25px 30px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 22px; font-weight: 600; letter-spacing: 0.5px;">Cleaning Schedule Update</h1>
              <p style="margin: 8px 0 0 0; color: #bdc3c7; font-size: 13px;">${companyName}</p>
            </td>
          </tr>
          
          <!-- Main Content -->
          <tr>
            <td style="padding: 30px 30px 20px 30px;">
              <p style="margin: 0 0 20px 0; color: #34495e; font-size: 15px; line-height: 1.6;">Dear Resident,</p>
              <p style="margin: 0 0 25px 0; color: #34495e; font-size: 15px; line-height: 1.6;">This is an automated notification regarding an update to your scheduled cleaning date.</p>
              
              <!-- Details Table -->
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8f9fa; border-radius: 6px; overflow: hidden; margin-bottom: 25px;">
                <tr>
                  <td style="padding: 20px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #e9ecef;">
                          <span style="color: #7f8c8d; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Property / Cell</span>
                        </td>
                        <td style="padding: 8px 0; border-bottom: 1px solid #e9ecef; text-align: right; color: #2c3e50; font-size: 14px; font-weight: 500;">${cell}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #e9ecef;">
                          <span style="color: #7f8c8d; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Previous Date</span>
                        </td>
                        <td style="padding: 8px 0; border-bottom: 1px solid #e9ecef; text-align: right; color: #7f8c8d; font-size: 14px;">${oldValue || 'Not set'}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #e9ecef;">
                          <span style="color: #7f8c8d; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">New Date</span>
                        </td>
                        <td style="padding: 8px 0; border-bottom: 1px solid #e9ecef; text-align: right; color: #27ae60; font-size: 14px; font-weight: 600;">${newValue}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #e9ecef;">
                          <span style="color: #7f8c8d; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Cleaning Type</span>
                        </td>
                        <td style="padding: 8px 0; border-bottom: 1px solid #e9ecef; text-align: right; color: #2c3e50; font-size: 14px;">${cleaningType}</td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0;">
                          <span style="color: #7f8c8d; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Timestamp</span>
                        </td>
                        <td style="padding: 8px 0; text-align: right; color: #7f8c8d; font-size: 13px;">${formattedDate}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 0 0 20px 0; color: #34495e; font-size: 14px; line-height: 1.6;">If you have any questions or need to verify this information, please contact the property management team.</p>
              
              <p style="margin: 0; color: #34495e; font-size: 15px; line-height: 1.6;">Best regards,<br><strong>${companyName}</strong><br>Property Management Team</p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #ecf0f1; padding: 20px 30px; text-align: center;">
              <p style="margin: 0 0 8px 0; color: #7f8c8d; font-size: 12px;">This is an automated notification from ${companyName}. Please do not reply to this email.</p>
              <p style="margin: 0; color: #95a5a6; font-size: 11px;">If you believe this notification is in error, please contact support.</p>
            </td>
          </tr>
        </table>
        
        <!-- Extra padding -->
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
          <tr>
            <td height="20"></td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const mailOptions = {
    from: `${companyName} <${companyEmail}>`,
    to: emailTo,
    subject: `[${companyName}] Cleaning Schedule Updated - ${cell}${isMoveout ? ' (Move-out)' : ''}`,
    text: textContent,
    html: htmlContent,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Email notification sent successfully to: ${emailTo}`);

    try {
      await logAudit({
        user: 'CLEANING_EMAIL_SERVICE',
        sheet: 'Cleaning_Email',
        cell: cell,
        oldValue: 'Email sent',
        newValue: `Email sent to ${emailTo} | Type: ${cleaningType}`,
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