'use strict';

async function getDefaultSheetId(sheets, spreadsheetId) {
  const response = await sheets.spreadsheets.get({ spreadsheetId });
  const entry = response.data.sheets[0];
  if (!entry) {
    throw new Error('Spreadsheet has no sheets.');
  }
  return entry.properties.sheetId;
}

module.exports = { getDefaultSheetId };
