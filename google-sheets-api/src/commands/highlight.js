const { getSheetsClient } = require('../services/google');
const { executeWithOptionalAudit } = require('../services/audit');
const { parseA1Range, getSheetIdByName, updateStatus } = require('../utils/sheets');
const { COLORS, SCOPES } = require('../config');

async function execute(args, flags) {
  const spreadsheetId = args[1];
  const range = args[2];
  if (!spreadsheetId || !range) throw new Error('Usage: highlight <spreadsheetId> <range>');

  const sheets = getSheetsClient([SCOPES.WRITE]);

  return await executeWithOptionalAudit({
    command: 'highlight', spreadsheetId, range, newValue: 'Unavailable',
    execute: async () => {
      const grid = parseA1Range(range);
      const sheetName = grid.sheetName;
      const sheetId = await getSheetIdByName(sheets, spreadsheetId, sheetName);
      const rowNumber = grid.startRowIndex + 1;

      await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: [{ repeatCell: { range: { sheetId, startRowIndex: grid.startRowIndex, endRowIndex: grid.endRowIndex }, cell: { userEnteredFormat: { backgroundColor: COLORS.RED } }, fields: 'userEnteredFormat.backgroundColor' } }] } });
      await updateStatus(sheets, spreadsheetId, sheetName, rowNumber, 'Unavailable');
      return { rowNumber, status: 'Unavailable', highlighted: true };
    },
  });
}
module.exports = { execute };