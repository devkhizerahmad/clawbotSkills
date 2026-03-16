'use strict';

const { parseA1Range } = require('../utils/parseA1Range');
const { getSheetIdByName } = require('../services/sheets/getSheetIdByName');
const { getDefaultSheetId } = require('../services/sheets/getDefaultSheetId');
const { logAudit } = require('../services/audit/logAudit');

async function merge({ sheets, args, flags, command }) {
  const [, spreadsheetId, range] = args;
  if (!spreadsheetId || !range)
    throw new Error(
      'Usage: merge <spreadsheetId> <range> [--type=MERGE_ALL|MERGE_COLUMNS|MERGE_ROWS]',
    );
    
  const grid = parseA1Range(range);
  const sheetName = grid.sheetName || 'Sheet1';
  const auditUser = flags.user || 'MERGE_CMD';
  const sheetId = grid.sheetName
    ? await getSheetIdByName(sheets, spreadsheetId, grid.sheetName)
    : await getDefaultSheetId(sheets, spreadsheetId);

  const mergeType = flags.type || 'MERGE_ALL';

  const response = await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          mergeCells: {
            range: { ...grid, sheetId },
            mergeType: mergeType,
          },
        },
      ],
    },
  });
  
  // Log audit entry for cell merge
  await logAudit({
    user: auditUser,
    sheet: sheetName,
    cell: range,
    oldValue: 'Separate cells',
    newValue: `Cells merged (${mergeType})`,
    source: command || 'merge',
  });
  
  return { merged: true, replies: response.data.replies };
}

module.exports = { merge };
