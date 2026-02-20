'use strict';

async function getSheetIdByName(sheets, spreadsheetId, sheetName) {
  const response = await sheets.spreadsheets.get({ spreadsheetId });
  const entry = response.data.sheets.find(
    (s) => s.properties?.title === sheetName,
  );
  if (!entry) {
    throw new Error(`Sheet not found: ${sheetName}`);
  }
  return entry.properties.sheetId;
}

module.exports = { getSheetIdByName };
