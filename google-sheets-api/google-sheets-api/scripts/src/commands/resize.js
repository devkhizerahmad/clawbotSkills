'use strict';

const { colToIndex } = require('../utils/colToIndex');
const { getSheetIdByName } = require('../services/sheets/getSheetIdByName');
const { logAudit } = require('../services/audit/logAudit');

async function resize({ sheets, args, command }) {
  const [, spreadsheetId, sheetName, dimension, start, end, size] = args;
  if (!spreadsheetId || !sheetName || !dimension || !start || !end || !size) {
    throw new Error(
      'Usage: resize <spreadsheetId> <sheetName> <cols|rows> <start> <end> <px>',
    );
  }
  
  const sheetId = await getSheetIdByName(sheets, spreadsheetId, sheetName);
  const isCols = dimension === 'cols';
  const range = isCols
    ? {
        dimension: 'COLUMNS',
        startIndex: colToIndex(start),
        endIndex: colToIndex(end) + 1,
      }
    : {
        dimension: 'ROWS',
        startIndex: parseInt(start, 10) - 1,
        endIndex: parseInt(end, 10),
      };

  const response = await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          updateDimensionProperties: {
            range: { sheetId, ...range },
            properties: { pixelSize: parseInt(size, 10) },
            fields: 'pixelSize',
          },
        },
      ],
    },
  });
  
  // Log audit entry for dimension resize
  await logAudit({
    user: 'ASSISTANT',
    sheet: sheetName,
    cell: `${dimension} ${start}-${end}`,
    oldValue: 'Previous size',
    newValue: `Resized to ${size}px`,
    source: 'SYSTEM',
  });
  
  return { resized: true, replies: response.data.replies };
}

module.exports = { resize };
