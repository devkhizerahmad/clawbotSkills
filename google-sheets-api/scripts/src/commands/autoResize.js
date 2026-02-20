'use strict';

const { colToIndex } = require('../utils/colToIndex');
const { getSheetIdByName } = require('../services/sheets/getSheetIdByName');

async function autoResize({ sheets, args }) {
  const [, spreadsheetId, sheetName, startCol, endCol] = args;
  if (!spreadsheetId || !sheetName || !startCol || !endCol) {
    throw new Error(
      'Usage: autoResize <spreadsheetId> <sheetName> <startCol> <endCol>',
    );
  }
  const sheetId = await getSheetIdByName(sheets, spreadsheetId, sheetName);
  const response = await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          autoResizeDimensions: {
            dimensions: {
              sheetId,
              dimension: 'COLUMNS',
              startIndex: colToIndex(startCol),
              endIndex: colToIndex(endCol) + 1,
            },
          },
        },
      ],
    },
  });
  return { autoResized: true, replies: response.data.replies };
}

module.exports = { autoResize };
