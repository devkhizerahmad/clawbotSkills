'use strict';

const { colToIndex } = require('../utils/colToIndex');
const { getSheetIdByName } = require('../services/sheets/getSheetIdByName');
const { logAudit } = require('../services/audit/logAudit');

async function autoResize({ sheets, args, command }) {
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
  
  // Log audit entry for auto resize
  await logAudit({
    user: 'ASSISTANT',
    sheet: sheetName,
    cell: `Columns ${startCol}-${endCol}`,
    oldValue: 'Manual sizing',
    newValue: 'Auto-resized to fit content',
    source: 'SYSTEM',
  });
  
  return { autoResized: true, replies: response.data.replies };
}

module.exports = { autoResize };
