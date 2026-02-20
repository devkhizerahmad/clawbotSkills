'use strict';

const { parseA1Range } = require('../utils/parseA1Range');
const { getSheetIdByName } = require('../services/sheets/getSheetIdByName');
const { getDefaultSheetId } = require('../services/sheets/getDefaultSheetId');

async function unmerge({ sheets, args }) {
  const [, spreadsheetId, range] = args;
  if (!spreadsheetId || !range)
    throw new Error('Usage: unmerge <spreadsheetId> <range>');
  const grid = parseA1Range(range);
  const sheetId = grid.sheetName
    ? await getSheetIdByName(sheets, spreadsheetId, grid.sheetName)
    : await getDefaultSheetId(sheets, spreadsheetId);

  const response = await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          unmergeCells: {
            range: { ...grid, sheetId },
          },
        },
      ],
    },
  });
  return { unmerged: true, replies: response.data.replies };
}

module.exports = { unmerge };
