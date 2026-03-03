'use strict';

const { getSheetIdByName } = require('../services/sheets/getSheetIdByName');
const { logAudit } = require('../services/audit/logAudit');

async function renameSheet({ sheets, args, command }) {
  const [, spreadsheetId, oldName, newName] = args;
  if (!spreadsheetId || !oldName || !newName)
    throw new Error('Usage: renameSheet <spreadsheetId> <oldName> <newName>');
    
  const sheetId = await getSheetIdByName(sheets, spreadsheetId, oldName);
  const response = await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          updateSheetProperties: {
            properties: { sheetId, title: newName },
            fields: 'title',
          },
        },
      ],
    },
  });
  
  // Log audit entry for sheet rename
  await logAudit({
    user: 'ASSISTANT',
    sheet: oldName,
    cell: 'N/A',
    oldValue: `Sheet name: ${oldName}`,
    newValue: `Sheet renamed to: ${newName}`,
    source: 'SYSTEM',
  });
  
  return response.data;
}

module.exports = { renameSheet };
