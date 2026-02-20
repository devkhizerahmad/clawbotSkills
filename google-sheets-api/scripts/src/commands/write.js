'use strict';

const {
  executeWithOptionalAudit,
} = require('../services/audit/executeWithOptionalAudit');
const { jsonFromArg } = require('../utils/jsonFromArg');
const { parseA1Range } = require('../utils/parseA1Range');
const { getSheetIdByName } = require('../services/sheets/getSheetIdByName');
const { updateStatus } = require('../services/sheets/updateStatus');
const {
  formatCleaningDateCell,
} = require('../services/email/formatCleaningDateCell');
const { CLEANING_SPREADSHEET_ID, WRITE_SCOPE } = require('../config');
const { getSheetsClient } = require('../auth');

async function write({ sheets, args, flags, command, isMutation }) {
  const spreadsheetId = args[1];
  let range = args[2];
  const dataRaw = args[3];

  if (!spreadsheetId || !range || !dataRaw)
    throw new Error('Usage: write <spreadsheetId> <range> <jsonOr@file>');

  let values = jsonFromArg(dataRaw, 'values');
  if (
    values &&
    typeof values === 'object' &&
    !Array.isArray(values) &&
    values.values
  ) {
    values = values.values;
  }
  const newValue = values?.[0]?.[0];

  return executeWithOptionalAudit({
    isMutation,
    command,
    spreadsheetId,
    range,
    newValue,

    execute: async () => {
      const sheetsClient = getSheetsClient([WRITE_SCOPE]);

      // 🟢 STEP 1 — READ CURRENT VALUE
      const existing = await sheetsClient.spreadsheets.values.get({
        spreadsheetId,
        range,
      });

      const oldValue = existing.data.values?.[0]?.[0] ?? '';
      const wasEmpty = oldValue === '';

      // 🟢 STEP 2 — WRITE ONLY IF VALUE CHANGED
      if (oldValue !== newValue) {
        await sheetsClient.spreadsheets.values.update({
          spreadsheetId,
          range,
          valueInputOption: flags.input || 'USER_ENTERED',
          requestBody: { values, majorDimension: flags.major },
        });
      }

      // 🟢 STEP 3 — EXTRACT SHEET + ROW
      const match = range.match(/!(?:[A-Z]+)(\d+)/i);
      if (!match) throw new Error('Could not extract row number from range');

      const rowNumber = parseInt(match[1], 10);
      const sheetName = range.split('!')[0].trim();

      // 🟢 STEP 4 — ONLY APPLY COLOR + STATUS TO INVENTORY
      if (sheetName.toLowerCase() === 'inventory') {
        const sheetId = await getSheetIdByName(
          sheetsClient,
          spreadsheetId,
          sheetName,
        );

        const color = wasEmpty
          ? { red: 146 / 255, green: 208 / 255, blue: 80 / 255 } // GREEN = NEW
          : { red: 1, green: 1, blue: 0 }; // YELLOW = MODIFIED

        const grid = parseA1Range(range);

        // 🟢 STEP 5 — COLOR FULL ROW
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
                      backgroundColor: color,
                    },
                  },
                  fields: 'userEnteredFormat.backgroundColor',
                },
              },
            ],
          },
        });

        // 🟢 STEP 6 — UPDATE STATUS
        await updateStatus(
          sheetsClient,
          spreadsheetId,
          sheetName,
          rowNumber,
          wasEmpty ? 'New' : 'Modified',
        );
      }

      // 🟢 KEEP YOUR CLEANING FORMATTER
      if (spreadsheetId === CLEANING_SPREADSHEET_ID && range) {
        await formatCleaningDateCell(
          sheetsClient,
          spreadsheetId,
          range,
          oldValue,
          newValue,
        );
      }

      return {
        oldValue,
        newValue,
        rowNumber,
        status: wasEmpty ? 'New' : 'Modified',
      };
    },
  });
}

module.exports = { write };
