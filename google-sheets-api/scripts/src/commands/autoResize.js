'use strict';

const { colToIndex } = require('../utils/colToIndex');
const { getSheetIdByName } = require('../services/sheets/getSheetIdByName');
const { logAudit } = require('../services/audit/logAudit');

async function autoResize({ sheets, args, flags, command }) {
  const [, spreadsheetId, sheetName, startCol, endCol] = args;
  if (!spreadsheetId || !sheetName || !startCol || !endCol) {
    throw new Error(
      'Usage: autoResize <spreadsheetId> <sheetName> <startCol> <endCol>',
    );
  }
  
  const auditUser = flags.user || 'AUTO_RESIZE_CMD';
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
    user: auditUser,
    sheet: sheetName,
    cell: `Columns ${startCol}-${endCol}`,
    oldValue: 'Manual sizing',
    newValue: 'Auto-resized to fit content',
    source: command || 'autoResize',
  });
  
  return { autoResized: true, replies: response.data.replies };
}

module.exports = { autoResize };
