'use strict';

const { indexToCol } = require('../../utils/indexToCol');

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

  const headerRes = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!1:1`,
  });

  const headerRow = headerRes.data.values?.[0] || [];
  console.log(`Header row: ${JSON.stringify(headerRow)}`);

  const statusIndex = headerRow.findIndex(
    (h) => h?.toLowerCase().trim() === 'status',
  );
  console.log(`Status column index found: ${statusIndex}`);

  if (statusIndex === -1) {
    console.log('No "Status" column found. Skipping status update.');
    return;
  }

  const statusColumnLetter = indexToCol(statusIndex);
  const statusCell = `${sheetName}!${statusColumnLetter}${rowNumber}`;
  console.log(`Updating status at ${statusCell} to "${statusValue}"`);

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: statusCell,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [[statusValue]],
    },
  });

  console.log('Status updated successfully.');
}

module.exports = { updateStatus };
