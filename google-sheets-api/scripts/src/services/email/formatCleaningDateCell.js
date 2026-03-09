'use strict';

const {
  CLEANING_SPREADSHEET_ID,
  CLEANING_SHEET_NAME,
  CLEANING_DATE_COLUMN,
  CLEANING_DATE_COLOR,
  EMAIL_CONFIG,
} = require('../../config');
const { indexToCol } = require('../../utils/indexToCol');
const { getSheetIdByName } = require('../sheets/getSheetIdByName');
const { sendCleaningDateEmail } = require('./sendCleaningDateEmail');

async function formatCleaningDateCell(
  sheets,
  spreadsheetId,
  cell,
  oldValue,
  newValue,
) {
  // Check: Correct spreadsheet, correct sheet, correct column
  if (spreadsheetId !== CLEANING_SPREADSHEET_ID) return;

  // Parse cell to get sheet name and column
  const parts = cell.split('!');
  if (parts.length < 2) return;

  const sheetName = parts[0];
  const cellRef = parts[1];

  // Check: Sheet must be "Cleaning"
  if (sheetName !== CLEANING_SHEET_NAME) return;

  // Check: Column must be "X"
  const columnMatch = cellRef.match(/^([A-Za-z]+)/);
  if (!columnMatch || columnMatch[1].toUpperCase() !== CLEANING_DATE_COLUMN)
    return;

  // Get row number
  const rowMatch = cellRef.match(/(\d+)/);
  if (!rowMatch) return;
  const rowNumber = parseInt(rowMatch[1]);
  
  console.log("Formatter called");
  console.log("Incoming spreadsheetId:", spreadsheetId);
  console.log("Expected spreadsheetId:", CLEANING_SPREADSHEET_ID);
  console.log("Processing cell:", cell);
  console.log("Row number:", rowNumber);
  console.log("Column:", columnMatch[1].toUpperCase());

  // Get sheet ID
  const sheetId = await getSheetIdByName(
    sheets,
    spreadsheetId,
    CLEANING_SHEET_NAME,
  );

  // Apply color to X column cell only
  // 'X' is the 24th letter, so index 23
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
              startColumnIndex: 23, // X is index 23
              endColumnIndex: 24, // End at index 24 (exclusive)
            },
            cell: {
              userEnteredFormat: {
                backgroundColor: CLEANING_DATE_COLOR,
              },
            },
            fields: 'userEnteredFormat.backgroundColor',
          },
        },
      ],
    },
  });

  // ===== GET CONTACT EMAIL FROM ROW =====
  let contactEmail = EMAIL_CONFIG.recipient; // Default fallback

  try {
    console.log(`Looking for contact email in row ${rowNumber}`);
    
    // Find Contact column index
    const headerRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${CLEANING_SHEET_NAME}!1:1`,
    });

    const headerRow = headerRes.data.values?.[0] || [];
    console.log("Header row:", headerRow);
    
    const contactIndex = headerRow.findIndex(
      (h) => h?.toLowerCase().includes('contacts') && !h?.toLowerCase().includes('room'),
    );
    
    console.log("Contact column index:", contactIndex);

    if (contactIndex !== -1) {
      // Get contact value from the row
      const contactColLetter = indexToCol(contactIndex);
      console.log(`Fetching contact from column ${contactColLetter}, row ${rowNumber}`);
      
      const contactRes = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${CLEANING_SHEET_NAME}!${contactColLetter}${rowNumber}`,
      });

      contactEmail = contactRes.data.values?.[0]?.[0] || EMAIL_CONFIG.recipient;
      console.log(`Contact email found: ${contactEmail}`);
    } else {
      console.log("Contact column not found in header");
    }
  } catch (error) {
    console.log(`Could not fetch contact email: ${error.message}`);
  }
  // ======================================

  // ===== SEND EMAIL NOTIFICATION =====
  await sendCleaningDateEmail(cell, oldValue, newValue, contactEmail);
  // ===================================
}

module.exports = { formatCleaningDateCell };
