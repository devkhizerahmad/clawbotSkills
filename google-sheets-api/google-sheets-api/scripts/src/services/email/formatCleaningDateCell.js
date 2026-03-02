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
  isMoveout = false 

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

  // Define colors
  // Blue for Move-out
  const blueColor = { red: 0.4, green: 0.6, blue: 1.0 }; 
  // Yellow for Non-Move-out
  const yellowColor = { red: 1.0, green: 1.0, blue: 0.4 }; 

  // Select color based on flag
  const backgroundColor = isMoveout ? blueColor : yellowColor;

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
                backgroundColor: backgroundColor,
              },
            },
            fields: 'userEnteredFormat.backgroundColor',
          },
        },
      ],
    },
  });

  // ===== GET CONTACT EMAIL AND MOVEOUT STATUS FROM ROW =====
  let contactEmail = EMAIL_CONFIG.recipient; // Default fallback
  let moveoutStatus = isMoveout; // Use passed flag as default

  try {
    console.log(`Looking for contact email and moveout status in row ${rowNumber}`);
    
    // Find Contact and Move-out columns index
    const headerRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${CLEANING_SHEET_NAME}!1:1`,
    });

    const headerRow = headerRes.data.values?.[0] || [];
    console.log("Header row:", headerRow);
    
    const contactIndex = headerRow.findIndex(
      (h) => h?.toLowerCase().includes('contacts') && !h?.toLowerCase().includes('room'),
    );
    
    // Look for move-out related columns
    const moveoutIndex = headerRow.findIndex(
      (h) => h?.toLowerCase().includes('move') && h?.toLowerCase().includes('out'),
    );
    
    console.log("Contact column index:", contactIndex);
    console.log("Move-out column index:", moveoutIndex);

    // Get contact email
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
    
    // Get move-out status if column exists
    if (moveoutIndex !== -1) {
      // Get move-out value from the row
      const moveoutColLetter = indexToCol(moveoutIndex);
      console.log(`Fetching move-out status from column ${moveoutColLetter}, row ${rowNumber}`);
      
      const moveoutRes = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${CLEANING_SHEET_NAME}!${moveoutColLetter}${rowNumber}`,
      });

      const moveoutValue = moveoutRes.data.values?.[0]?.[0];
      // Consider it a moveout if the cell has any truthy value like "Yes", "True", "Move-out", etc.
      moveoutStatus = Boolean(moveoutValue && 
        (typeof moveoutValue === 'string') && 
        moveoutValue.trim().toLowerCase() !== 'no' && 
        moveoutValue.trim().toLowerCase() !== 'false' && 
        moveoutValue.trim().toLowerCase() !== '');
      
      console.log(`Move-out status from sheet: ${moveoutStatus}, value: ${moveoutValue}`);
    } else {
      console.log("Move-out column not found in header, using passed flag");
    }
  } catch (error) {
    console.log(`Could not fetch contact email or moveout status: ${error.message}`);
  }
  // ======================================

  // Select color based on actual status
  const finalBackgroundColor = moveoutStatus ? blueColor : yellowColor;
  
  // Re-apply the correct color in case it was changed based on sheet data
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
                backgroundColor: finalBackgroundColor,
              },
            },
            fields: 'userEnteredFormat.backgroundColor',
          },
        },
      ],
    },
  });

  // ===== SEND EMAIL NOTIFICATION =====
  await sendCleaningDateEmail(cell, oldValue, newValue, contactEmail, moveoutStatus);
  // ===================================
}

module.exports = { formatCleaningDateCell };
