const { getSheetsClient } = require('../services/google');
const { getSheetIdByName, colToIndex } = require('../utils/sheets');
const { SCOPES } = require('../config');

async function execute(args, flags) {
  const spreadsheetId = args[1];
  const sheetName = args[2];
  const dimension = args[3];
  const start = args[4];
  const end = args[5];
  const size = args[6];

  if (!spreadsheetId || !sheetName || !dimension || !start || !end || !size) throw new Error('Usage: resize <spreadsheetId> <sheetName> <cols|rows> <start> <end> <px>');

  const sheets = getSheetsClient([SCOPES.WRITE]);
  const sheetId = await getSheetIdByName(sheets, spreadsheetId, sheetName);

  const isCols = dimension === 'cols';
  const range = isCols
    ? { dimension: 'COLUMNS', startIndex: colToIndex(start), endIndex: colToIndex(end) + 1 }
    : { dimension: 'ROWS', startIndex: parseInt(start, 10) - 1, endIndex: parseInt(end, 10) };

  const response = await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: [{ updateDimensionProperties: { range: { sheetId, ...range }, properties: { pixelSize: parseInt(size, 10) }, fields: 'pixelSize' } }] } });
  return { resized: true, replies: response.data.replies };
}
module.exports = { execute };