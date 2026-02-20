const { getSheetsClient } = require("../services/google");
const { executeWithOptionalAudit } = require("../services/audit");
const { formatCleaningDateCell } = require("../services/cleaning");
const {
  parseA1Range,
  getSheetIdByName,
  updateStatus,
} = require("../utils/sheets");
const { jsonFromArg } = require("../utils/parser");
const { CLEANING, COLORS, SCOPES } = require("../config");

async function execute(args, flags) {
  const spreadsheetId = args[1];
  const range = args[2];
  const dataRaw = args[3];

  if (!spreadsheetId || !range || !dataRaw)
    throw new Error("Usage: write <spreadsheetId> <range> <jsonOr@file>");

  const values = jsonFromArg(dataRaw, "values");
  const newValue = values?.[0]?.[0];
  const sheets = getSheetsClient([SCOPES.WRITE]);

  let oldValue_ = "";
  try {
    const oldRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });
    oldValue_ = oldRes.data.values?.[0]?.[0] ?? "";
  } catch {
    oldValue_ = "";
  }

  const result = await executeWithOptionalAudit({
    command: "write",
    spreadsheetId,
    range,
    newValue,
    execute: async () => {
      if (oldValue_ !== newValue) {
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range,
          valueInputOption: flags.input || "USER_ENTERED",
          requestBody: { values, majorDimension: flags.major },
        });
      }

      const match = range.match(/!(?:[A-Z]+)(\d+)/i);
      if (!match) throw new Error("Invalid range format");
      const rowNumber = parseInt(match[1], 10);
      const sheetName = range.split("!")[0].trim();

      if (sheetName.toLowerCase() === "inventory") {
        const sheetId = await getSheetIdByName(
          sheets,
          spreadsheetId,
          sheetName
        );
        const wasEmpty = oldValue_ === "";
        const color = wasEmpty ? COLORS.GREEN : COLORS.YELLOW;
        const grid = parseA1Range(range);

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
                  cell: { userEnteredFormat: { backgroundColor: color } },
                  fields: "userEnteredFormat.backgroundColor",
                },
              },
            ],
          },
        });
        await updateStatus(
          sheets,
          spreadsheetId,
          sheetName,
          rowNumber,
          wasEmpty ? "New" : "Modified"
        );
      }

      return { oldValue: oldValue_, newValue, rowNumber };
    },
  });

  if (spreadsheetId === CLEANING.SPREADSHEET_ID && range) {
    await formatCleaningDateCell(
      sheets,
      spreadsheetId,
      range,
      oldValue_,
      newValue
    );
  }
  return result;
}
module.exports = { execute };
