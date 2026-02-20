const { getSheetsClient } = require('../services/google');
const { getSheetIdByName } = require('../utils/sheets');
const { SCOPES } = require('../config');

async function execute(args, flags) {
  const spreadsheetId = args[1];
  const sheetName = args[2];
  const rowsRaw = args[3];
  const colsRaw = args[4];
  if (!spreadsheetId || !sheetName) throw new Error('Usage: freeze <spreadsheetId> <sheetName> [rows] [cols]');

  const sheets = getSheetsClient([SCOPES.WRITE]);
  const sheetId = await getSheetIdByName(sheets, spreadsheetId, sheetName);

  const gridProperties = {};
  const fields = [];
  if (rowsRaw !== undefined) { gridProperties.frozenRowCount = parseInt(rowsRaw, 10); fields.push('gridProperties.frozenRowCount'); }
  if (colsRaw !== undefined) { gridProperties.frozenColumnCount = parseInt(colsRaw, 10); fields.push('gridProperties.frozenColumnCount'); }

  const response = await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: [{ updateSheetProperties: { properties: { sheetId, gridProperties }, fields: fields.join(',') } }] } });
  return { frozen: true, replies: response.data.replies };
}
module.exports = { execute };