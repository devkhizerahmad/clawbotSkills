'use strict';

const { formatCleaningDateCell } = require('../services/email/formatCleaningDateCell');
const { CLEANING_SPREADSHEET_ID, CLEANING_SHEET_NAME, CLEANING_DATE_COLUMN } = require('../config');
const { getSheetsClient } = require('../auth');
const { logAudit } = require('../services/audit/logAudit');


async function allUpdatesCleaning({ sheets, args, flags, command, isMutation }) {
  const spreadsheetId = args[1];
  const operation = args[2]; // 'add' or 'subtract'
  const amount = parseInt(args[3]); // number to add/subtract
  const unit = args[4]; // 'days', 'weeks', 'months', 'years'

  if (!spreadsheetId || !operation || !amount || !unit)
    throw new Error('Usage: allUpdatesCleaning <spreadsheetId> <add|subtract> <amount> <days|weeks|months|years>');

  if (!['add', 'subtract'].includes(operation))
    throw new Error('Operation must be "add" or "subtract"');

  if (!['days', 'weeks', 'months', 'years'].includes(unit))
    throw new Error('Unit must be "days", "weeks", "months", or "years"');

  const auditUser = flags.user || 'CLEANING_CMD';

  // Read the entire X column
  const range = `${CLEANING_SHEET_NAME}!${CLEANING_DATE_COLUMN}:${CLEANING_DATE_COLUMN}`;

  const existingData = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
  });

  const values = existingData.data.values || [];
  if (values.length === 0) {
    
    return { message: 'No data found in the X column' };
  }

  // Process each date
  const updatedValues = [];
  const changes = [];

  for (let i = 0; i < values.length; i++) {
    const cellValue = values[i][0];

    if (!cellValue) {
      updatedValues.push([null]); // Keep empty cells empty
      continue;
    }

    try {
      let date = new Date(cellValue);

      if (isNaN(date.getTime())) {
        // Try parsing as MM/DD/YYYY format
        const dateParts = cellValue.toString().split(/[\/\-]/);
        if (dateParts.length >= 3) {
          date = new Date(dateParts[2], dateParts[0] - 1, dateParts[1]); // MM/DD/YYYY
          if (isNaN(date.getTime())) {
            // Try DD/MM/YYYY format
            date = new Date(dateParts[2], dateParts[1] - 1, dateParts[0]);
          }
        }
      }

      if (isNaN(date.getTime())) {
        console.warn(`Invalid date at row ${i + 1}: "${cellValue}"`);
        updatedValues.push([cellValue]); // Keep invalid dates as-is
        continue;
      }

      // Perform the date arithmetic
      if (operation === 'add') {
        switch (unit) {
          case 'days':
            date.setDate(date.getDate() + amount);
            break;
          case 'weeks':
            date.setDate(date.getDate() + (amount * 7));
            break;
          case 'months':
            date.setMonth(date.getMonth() + amount);
            break;
          case 'years':
            date.setFullYear(date.getFullYear() + amount);
            break;
        }
      } else if (operation === 'subtract') {
        switch (unit) {
          case 'days':
            date.setDate(date.getDate() - amount);
            break;
          case 'weeks':
            date.setDate(date.getDate() - (amount * 7));
            break;
          case 'months':
            date.setMonth(date.getMonth() - amount);
            break;
          case 'years':
            date.setFullYear(date.getFullYear() - amount);
            break;
        }
      }

      const newDateStr = formatDateAsMMDDYYYY(date);
      updatedValues.push([newDateStr]);
      changes.push({
        row: i + 1,
        oldDate: cellValue,
        newDate: newDateStr
      });
    } catch (error) {
      console.error(`Error processing date at row ${i + 1}: ${error.message}`);
      updatedValues.push([cellValue]); // Keep original value on error
    }
  }

  // Write the updated values back to the sheet
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: updatedValues },
  });

  if (changes.length === 0) {
    await logAudit({
      user: auditUser,
      sheet: CLEANING_SHEET_NAME,
      cell: range,
      oldValue: 'No effective date changes',
      newValue: `${operation} ${amount} ${unit} attempted`,
      source: command || 'allUpdatesCleaning',
    });
  }

  // Log granular per-row audit entries
  if (changes.length > 0) {
    const affectedCells = changes.map(change => `${CLEANING_DATE_COLUMN}${change.row}`).join(', ');
    const oldValues = values.map(v => v[0]).join(', ');
    const newValues = updatedValues.map(v => v[0]).join(', ');

    //  const oldValues = changes.map(change => change.oldDate).join(', ');
    // const newValues = changes.map(change => change.newDate).join(', ');
    try {
      await logAudit({
        user: auditUser,
        sheet: CLEANING_SHEET_NAME,
        cell: affectedCells,
        oldValue: oldValues,
        newValue: newValues,
        source: command || 'allUpdatesCleaning',
      });
    } catch (err) {
      console.warn('Audit log failed:', err.message);
    }
  }

  // Trigger formatCleaningDateCell for each changed row
  const sheetsClient = getSheetsClient(['https://www.googleapis.com/auth/spreadsheets']);

  for (const change of changes) {
    const cell = `${CLEANING_SHEET_NAME}!${CLEANING_DATE_COLUMN}${change.row}`;
    await formatCleaningDateCell(
      sheetsClient,
      spreadsheetId,
      cell,
      change.oldDate,
      change.newDate,
      false // isMoveout defaults to false for batch updates
    );
  }

  return {
    message: `Date arithmetic completed: ${operation}ed ${amount} ${unit} to ${changes.length} dates`,
    changes: changes
  };
}

// Helper function to format date as MM/DD/YYYY
function formatDateAsMMDDYYYY(date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const year = date.getFullYear();
  return `${month}/${day}/${year}`;
}

module.exports = { allUpdatesCleaning };