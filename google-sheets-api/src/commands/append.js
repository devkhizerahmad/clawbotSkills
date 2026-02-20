const { getSheetsClient } = require('../services/google');
const { executeWithOptionalAudit } = require('../services/audit');
const { parseA1Range, getSheetIdByName, updateStatus } = require('../utils/sheets');
const { jsonFromArg } = require('../utils/parser');
const { COLORS, SCOPES } = require('../config');

async function execute(args, flags) {
  const spreadsheetId = args[1];
  const range = args[2];
  const dataRaw = args[3];

  if (!spreadsheetId || !range || !dataRaw) throw new Error('Usage: append <spreadsheetId> <range> <jsonOr@file>');

  const values = jsonFromArg(dataRaw, 'values');
  const newValue = JSON.stringify(values);
  const sheets = getSheetsClient([SCOPES.WRITE]);

  return await executeWithOptionalAudit({
    command: 'append', spreadsheetId, range, newValue,
    execute: async () => {
      const response = await sheets.spreadsheets.values.append({
        spreadsheetId, range,
        valueInputOption: flags.input || 'USER_ENTERED',
        insertDataOption: flags.insert || 'INSERT_ROWS',
        requestBody: { values, majorDimension: flags.major },
      });

      const updatedRange = response.data.updates.updatedRange;
      const match = updatedRange.match(/!(?:[A-Z]+)(\d+)/);
      const rowNumber = parseInt(match[1], 10);
      const sheetName = updatedRange.split('!')[0];
      const grid = parseA1Range(updatedRange);
      const sheetId = await getSheetIdByName(sheets, spreadsheetId, sheetName);

      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: { requests: [{ repeatCell: { range: { sheetId, startRowIndex: grid.startRowIndex, endRowIndex: grid.endRowIndex }, cell: { userEnteredFormat: { backgroundColor: COLORS.GREEN } }, fields: 'userEnteredFormat.backgroundColor' } }] },
      });

      await updateStatus(sheets, spreadsheetId, sheetName, rowNumber, 'New');
      return response.data;
    },
  });
}
module.exports = { execute };