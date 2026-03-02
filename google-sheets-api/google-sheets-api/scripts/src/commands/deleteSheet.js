'use strict';

const { getSheetIdByName } = require('../services/sheets/getSheetIdByName');
const { logAudit } = require('../services/audit/logAudit');

async function deleteSheet({ sheets, args, command }) {
  const [, spreadsheetId, sheetName] = args;
  if (!spreadsheetId || !sheetName)
    throw new Error('Usage: deleteSheet <spreadsheetId> <sheetName>');
    
  const sheetId = await getSheetIdByName(sheets, spreadsheetId, sheetName);
  const response = await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests: [{ deleteSheet: { sheetId } }] },
  });
  
  // Log audit entry for sheet deletion
  await logAudit({
    user: 'ASSISTANT',
    sheet: sheetName,
    cell: 'N/A',
    oldValue: `Sheet existed in spreadsheet ${spreadsheetId}`,
    newValue: 'Sheet deleted',
    source: 'SYSTEM',
  });
  
  return response.data;
}

module.exports = { deleteSheet };
