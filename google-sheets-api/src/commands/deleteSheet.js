const { getSheetsClient } = require('../services/google');
const { getSheetIdByName } = require('../utils/sheets');
const { SCOPES } = require('../config');

async function execute(args, flags) {
  const spreadsheetId = args[1];
  const sheetName = args[2];
  if (!spreadsheetId || !sheetName) throw new Error('Usage: deleteSheet <spreadsheetId> <sheetName>');
  const sheets = getSheetsClient([SCOPES.WRITE]);
  const sheetId = await getSheetIdByName(sheets, spreadsheetId, sheetName);
  const response = await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: [{ deleteSheet: { sheetId } }] } });
  return response.data;
}
module.exports = { execute };