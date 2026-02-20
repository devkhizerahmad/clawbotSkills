const { getSheetsClient } = require('../services/google');
const { getSheetIdByName } = require('../utils/sheets');
const { SCOPES } = require('../config');

async function execute(args, flags) {
  const spreadsheetId = args[1];
  const oldName = args[2];
  const newName = args[3];
  if (!spreadsheetId || !oldName || !newName) throw new Error('Usage: renameSheet <spreadsheetId> <oldName> <newName>');
  const sheets = getSheetsClient([SCOPES.WRITE]);
  const sheetId = await getSheetIdByName(sheets, spreadsheetId, oldName);
  const response = await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: [{ updateSheetProperties: { properties: { sheetId, title: newName }, fields: 'title' } }] } });
  return response.data;
}
module.exports = { execute };