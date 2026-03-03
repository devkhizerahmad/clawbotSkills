'use strict';

const { parseA1Range } = require('../utils/parseA1Range');
const { getSheetIdByName } = require('../services/sheets/getSheetIdByName');
const { getDefaultSheetId } = require('../services/sheets/getDefaultSheetId');
const { logAudit } = require('../services/audit/logAudit');

async function copyFormat({ sheets, args, command }) {
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
  
  // Log audit entry for format copy
  await logAudit({
    user: 'ASSISTANT',
    sheet: sourceGrid.sheetName || 'Sheet1',
    cell: `${sourceRange} → ${destRange}`,
    oldValue: 'Source format',
    newValue: 'Format copied to destination',
    source: 'SYSTEM',
  });
  
  return { copied: true, replies: response.data.replies };
}

module.exports = { copyFormat };
