const { getSheetsClient } = require('../services/google');
const { parseA1Range, getSheetIdByName, getDefaultSheetId } = require('../utils/sheets');
const { jsonFromArg } = require('../utils/parser');
const { SCOPES, COLORS } = require('../config');

async function execute(args, flags) {
  const spreadsheetId = args[1];
  const range = args[2];
  const styleRaw = args[3];
  if (!spreadsheetId || !range) throw new Error('Usage: borders <spreadsheetId> <range> [styleJsonOr@file]');

  const style = styleRaw ? jsonFromArg(styleRaw, 'borderStyle') : { style: 'SOLID', color: COLORS.BLACK };
  const sheets = getSheetsClient([SCOPES.WRITE]);
  const grid = parseA1Range(range);
  const sheetId = grid.sheetName ? await getSheetIdByName(sheets, spreadsheetId, grid.sheetName) : await getDefaultSheetId(sheets, spreadsheetId);

  const response = await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests: [{ updateBorders: { range: { ...grid, sheetId }, top: style, bottom: style, left: style, right: style, innerHorizontal: style, innerVertical: style } }] },
  });
  return { updated: true, replies: response.data.replies };
}
module.exports = { execute };