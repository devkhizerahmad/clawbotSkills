'use strict';

const {
  executeWithOptionalAudit,
} = require('../services/audit/executeWithOptionalAudit');
const { getSheetsClient } = require('../auth');
const { WRITE_SCOPE } = require('../config');
const { parseA1Range } = require('../utils/parseA1Range');
const { getSheetIdByName } = require('../services/sheets/getSheetIdByName');
const { updateStatus } = require('../services/sheets/updateStatus');

async function highlight({ sheets, args, command }) {
  const spreadsheetId = args[1];
  const range = args[2];

  if (!spreadsheetId || !range)
    throw new Error('Usage: highlight <spreadsheetId> <range>');

  return executeWithOptionalAudit({
    command,
    spreadsheetId,
    range,
    newValue: 'Unavailable',
    isMutation: true,
    execute: async () => {
      const sheetsClient = getSheetsClient([WRITE_SCOPE]);
      const grid = parseA1Range(range);
      const sheetName = grid.sheetName;
      const sheetId = await getSheetIdByName(
        sheetsClient,
        spreadsheetId,
        sheetName,
      );
      const rowNumber = grid.startRowIndex + 1;

      // 🔴 COLOR FULL ROW RED
      await sheetsClient.spreadsheets.batchUpdate({
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
                    backgroundColor: { red: 1, green: 0, blue: 0 },
                  },
                },
                fields: 'userEnteredFormat.backgroundColor',
              },
            },
          ],
        },
      });

      // 🔁 UPDATE STATUS
      await updateStatus(
        sheetsClient,
        spreadsheetId,
        sheetName,
        rowNumber,
        'Unavailable',
      );

      return {
        rowNumber,
        status: 'Unavailable',
        highlighted: true,
      };
    },
  });
}

module.exports = { highlight };
