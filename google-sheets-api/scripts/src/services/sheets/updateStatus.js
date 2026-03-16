'use strict';

const { indexToCol } = require('../../utils/indexToCol');
const { logAudit } = require('../audit/logAudit');

/**
 * Updates the "Status" column for a given row in a sheet.
 */
async function updateStatus(
  sheets,
  spreadsheetId,
  sheetName,
  rowNumber,
  statusValue,
) {
  console.log(`Checking for Status column in ${sheetName}...`);

  // 1️⃣ Get header row
  const headerRes = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!1:1`,
  });

  const headerRow = headerRes.data.values?.[0] || [];
  console.log(`Header row: ${JSON.stringify(headerRow)}`);

  // 2️⃣ Find Status column
  const statusIndex = headerRow.findIndex(
    (h) => h?.toLowerCase().trim() === 'status',
  );
  console.log(`Status column index found: ${statusIndex}`);

  if (statusIndex === -1) {
    console.log('No "Status" column found. Skipping status update.');
    return;
  }

  // 3️⃣ Convert column index to A1 notation correctly
  const statusColumnLetter = indexToCol(statusIndex);
  const statusCell = `${sheetName}!${statusColumnLetter}${rowNumber}`;
  console.log(`Updating status at ${statusCell} to "${statusValue}"`);

  // Get old status value before updating for audit log
  let oldStatus = '';
  try {
    const oldStatusRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: statusCell,
    });
    oldStatus = oldStatusRes.data.values?.[0]?.[0] || '';
  } catch (err) {
    console.warn('Could not fetch old status:', err.message);
  }

  // 4️⃣ Update Status cell
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: statusCell,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [[statusValue]],
    },
  });
  
  // Audit log for status mutation
  try {
    await logAudit({
      user: 'UPDATE_STATUS_SERVICE',
      sheet: sheetName,
      cell: statusCell,
      oldValue: oldStatus || '(no status)',
      newValue: statusValue,
      source: 'UPDATE_STATUS',
    });
  } catch (err) {
    console.warn('Audit log failed:', err.message);
  }
  
  console.log('Status updated successfully.');
}

module.exports = { updateStatus };
