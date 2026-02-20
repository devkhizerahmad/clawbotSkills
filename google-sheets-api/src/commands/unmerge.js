const { getSheetsClient } = require('../services/google');
const { parseA1Range, getSheetIdByName, getDefaultSheetId } = require('../utils/sheets');
const { SCOPES } = require('../config');

async function execute(args, flags) {
  const spreadsheetId = args[1];
  const range = args[2];
  if (!spreadsheetId || !range) throw new Error('Usage: unmerge <spreadsheetId> <range>');

  const sheets = getSheetsClient([SCOPES.WRITE]);
  const grid = parseA1Range(range);
  const sheetId = grid.sheetName ? await getSheetIdByName(sheets, spreadsheetId, grid.sheetName) : await getDefaultSheetId(sheets, spreadsheetId);

  const response = await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: [{ unmergeCells: { range: { ...grid, sheetId } } }] } });
  return { unmerged: true, replies: response.data.replies };
}
module.exports = { execute };