'use strict';

const { colToIndex } = require('../utils/colToIndex');
const { getSheetIdByName } = require('../services/sheets/getSheetIdByName');

async function resize({ sheets, args }) {
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
  return { resized: true, replies: response.data.replies };
}

module.exports = { resize };
