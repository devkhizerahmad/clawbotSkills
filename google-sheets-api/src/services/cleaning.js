// src/services/cleaning.js
const nodemailer = require("nodemailer");
const { CLEANING, EMAIL } = require("../config");
const { getSheetIdByName, indexToCol } = require("../utils/sheets");

async function sendCleaningDateEmail(cell, oldValue, newValue, recipientEmail) {
  const emailTo = recipientEmail || EMAIL.RECIPIENT;
  if (!EMAIL.USER || !EMAIL.PASS) return;

  const transporter = nodemailer.createTransport({
    service: EMAIL.SERVICE,
    auth: { user: EMAIL.USER, pass: EMAIL.PASS },
  });

  const mailOptions = {
    from: EMAIL.USER,
    to: emailTo,
    subject: `Cleaning Date Updated - ${cell}`,
    text: `Cleaning Date Modified!\nCell: ${cell}\nOld: ${
      oldValue || "(empty)"
    }\nNew: ${newValue}`,
    html: `
      <h2>🧹 Cleaning Date Modified!</h2>
      <table border="1" cellpadding="8" cellspacing="0">
        <tr><td><b>Cell</b></td><td>${cell}</td></tr>
        <tr><td><b>Old Value</b></td><td>${oldValue || "(empty)"}</td></tr>
        <tr><td><b>New Value</b></td><td>${newValue}</td></tr>
        <tr><td><b>Time</b></td><td>${new Date().toLocaleString()}</td></tr>
      </table>
      <br><p><i>This is an automated notification from ClawdBot.</i></p>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Email sent to ${emailTo}`);
  } catch (error) {
    console.error("Email send failed:", error.message);
  }
}

async function formatCleaningDateCell(
  sheets,
  spreadsheetId,
  cell,
  oldValue,
  newValue
) {
  if (spreadsheetId !== CLEANING.SPREADSHEET_ID) return;

  const parts = cell.split("!");
  if (parts.length < 2) return;
  const sheetName = parts[0];
  const cellRef = parts[1];

  if (sheetName !== CLEANING.SHEET_NAME) return;

  const columnMatch = cellRef.match(/^([A-Za-z]+)/);
  if (!columnMatch || columnMatch[1].toUpperCase() !== CLEANING.DATE_COLUMN)
    return;

  const rowMatch = cellRef.match(/(\d+)/);
  if (!rowMatch) return;
  const rowNumber = parseInt(rowMatch[1]);

  const sheetId = await getSheetIdByName(
    sheets,
    spreadsheetId,
    CLEANING.SHEET_NAME
  );

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          repeatCell: {
            range: {
              sheetId,
              startRowIndex: rowNumber - 1,
              endRowIndex: rowNumber,
              startColumnIndex: 22,
              endColumnIndex: 23,
            },
            cell: {
              userEnteredFormat: { backgroundColor: CLEANING.DATE_COLOR },
            },
            fields: "userEnteredFormat.backgroundColor",
          },
        },
      ],
    },
  });

  let contactEmail = EMAIL.RECIPIENT;
  try {
    const headerRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${CLEANING.SHEET_NAME}!1:1`,
    });
    const headerRow = headerRes.data.values?.[0] || [];
    const contactIndex = headerRow.findIndex(
      (h) => h?.toLowerCase().trim() === "contact"
    );
    if (contactIndex !== -1) {
      const contactColLetter = indexToCol(contactIndex);
      const contactRes = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${CLEANING.SHEET_NAME}!${contactColLetter}${rowNumber}`,
      });
      contactEmail = contactRes.data.values?.[0]?.[0] || EMAIL.RECIPIENT;
    }
  } catch (error) {
    console.log(`Could not fetch contact email: ${error.message}`);
  }

  await sendCleaningDateEmail(cell, oldValue, newValue, contactEmail);
}

module.exports = { formatCleaningDateCell };
