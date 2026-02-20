'use strict';

const {
  executeWithOptionalAudit,
} = require('../services/audit/executeWithOptionalAudit');
const { jsonFromArg } = require('../utils/jsonFromArg');
const { parseA1Range } = require('../utils/parseA1Range');
const { getSheetIdByName } = require('../services/sheets/getSheetIdByName');
const { updateStatus } = require('../services/sheets/updateStatus');

async function append({ sheets, args, flags, command, isMutation }) {
  const spreadsheetId = args[1];
  const range = args[2];
  const dataRaw = args[3];

  if (!spreadsheetId || !range || !dataRaw)
    throw new Error('Usage: append <spreadsheetId> <range> <jsonOr@file>');

  let values = jsonFromArg(dataRaw, 'values');
  if (
    values &&
    typeof values === 'object' &&
    !Array.isArray(values) &&
    values.values
  ) {
    values = values.values;
  }
  const newValue = JSON.stringify(values);

  return executeWithOptionalAudit({
    isMutation,
    command,
    spreadsheetId,
    range,
    newValue,
    execute: async () => {
      const response = await sheets.spreadsheets.values.append({
        spreadsheetId,
        range,
        valueInputOption: flags.input || 'USER_ENTERED',
        insertDataOption: flags.insert || 'INSERT_ROWS',
        requestBody: {
          values,
          majorDimension: flags.major,
        },
      });

      //GET APPENDED ROW NUMBER
      const updatedRange = response.data.updates.updatedRange;
      const match = updatedRange.match(/!(?:[A-Z]+)(\d+)/);
      const rowNumber = parseInt(match[1], 10);
      const sheetName = updatedRange.split('!')[0];
      const grid = parseA1Range(updatedRange);

      const sheetId = await getSheetIdByName(sheets, spreadsheetId, sheetName);

      //COLOR FULL ROW GREEN
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              repeatCell: {
                range: {
                  sheetId,
                  startRowIndex: grid.startRowIndex,
                  endRowIndex: grid.endRowIndex,
                },
                cell: {
                  userEnteredFormat: {
                    backgroundColor: {
                      red: 146 / 255.0,
                      green: 208 / 255.0,
                      blue: 80 / 255.0,
                    },
                  },
                },
                fields: 'userEnteredFormat.backgroundColor',
              },
            },
          ],
        },
      });

      await updateStatus(sheets, spreadsheetId, sheetName, rowNumber, 'New');

      return response.data;
    },
  });
}

module.exports = { append };
