'use strict';

const { getSheetIdByName } = require('../services/sheets/getSheetIdByName');
const { logAudit } = require('../services/audit/logAudit');

async function freeze({ sheets, args, command }) {
  const [, spreadsheetId, sheetName, rowsRaw, colsRaw] = args;
  if (!spreadsheetId || !sheetName)
    throw new Error('Usage: freeze <spreadsheetId> <sheetName> [rows] [cols]');
    
  const sheetId = await getSheetIdByName(sheets, spreadsheetId, sheetName);
  const frozenRowCount =
    rowsRaw !== undefined ? parseInt(rowsRaw, 10) : undefined;
  const frozenColumnCount =
    colsRaw !== undefined ? parseInt(colsRaw, 10) : undefined;
    
  const gridProperties = {};
  const fields = [];
  if (frozenRowCount !== undefined) {
    gridProperties.frozenRowCount = frozenRowCount;
    fields.push('gridProperties.frozenRowCount');
  }
  if (frozenColumnCount !== undefined) {
    gridProperties.frozenColumnCount = frozenColumnCount;
    fields.push('gridProperties.frozenColumnCount');
  }
  
  const response = await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          updateSheetProperties: {
            properties: { sheetId, gridProperties },
            fields: fields.join(','),
          },
        },
      ],
    },
  });
  
  // Log audit entry for freeze settings
  const freezeInfo = [];
  if (frozenRowCount !== undefined) {
    freezeInfo.push(`Rows: ${frozenRowCount}`);
  }
  if (frozenColumnCount !== undefined) {
    freezeInfo.push(`Columns: ${frozenColumnCount}`);
  }
  
  await logAudit({
    user: 'ASSISTANT',
    sheet: sheetName,
    cell: 'N/A',
    oldValue: 'Previous freeze settings',
    newValue: `Freeze settings updated: ${freezeInfo.join(', ')}`,
    source: 'SYSTEM',
  });
  
  return { frozen: true, replies: response.data.replies };
}

module.exports = { freeze };
