'use strict';

const { parseA1Range } = require('../utils/parseA1Range');
const { getSheetIdByName } = require('../services/sheets/getSheetIdByName');
const { getDefaultSheetId } = require('../services/sheets/getDefaultSheetId');

async function copyFormat({ sheets, args }) {
  const [, spreadsheetId, sourceRange, destRange] = args;
  if (!spreadsheetId || !sourceRange || !destRange)
    throw new Error(
      'Usage: copyFormat <spreadsheetId> <sourceRange> <destRange>',
    );
  const sourceGrid = parseA1Range(sourceRange);
  const destGrid = parseA1Range(destRange);
  const sourceSheetId = sourceGrid.sheetName
    ? await getSheetIdByName(sheets, spreadsheetId, sourceGrid.sheetName)
    : await getDefaultSheetId(sheets, spreadsheetId);
  const destSheetId = destGrid.sheetName
    ? await getSheetIdByName(sheets, spreadsheetId, destGrid.sheetName)
    : await getDefaultSheetId(sheets, spreadsheetId);

  const response = await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          copyPaste: {
            source: { ...sourceGrid, sheetId: sourceSheetId },
            destination: { ...destGrid, sheetId: destSheetId },
            pasteType: 'PASTE_FORMAT',
          },
        },
      ],
    },
  });
  return { copied: true, replies: response.data.replies };
}

module.exports = { copyFormat };
