const { getSheetsClient } = require('../services/google');
const { getSheetIdByName, colToIndex } = require('../utils/sheets');
const { SCOPES } = require('../config');

async function execute(args, flags) {
  const spreadsheetId = args[1];
  const sheetName = args[2];
  const startCol = args[3];
  const endCol = args[4];
  if (!spreadsheetId || !sheetName || !startCol || !endCol) throw new Error('Usage: autoResize <spreadsheetId> <sheetName> <startCol> <endCol>');

  const sheets = getSheetsClient([SCOPES.WRITE]);
  const sheetId = await getSheetIdByName(sheets, spreadsheetId, sheetName);

  const response = await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: [{ autoResizeDimensions: { dimensions: { sheetId, dimension: 'COLUMNS', startIndex: colToIndex(startCol), endIndex: colToIndex(endCol) + 1 } } }] } });
  return { autoResized: true, replies: response.data.replies };
}
module.exports = { execute };