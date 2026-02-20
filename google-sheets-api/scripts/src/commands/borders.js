'use strict';

const { jsonFromArg } = require('../utils/jsonFromArg');
const { parseA1Range } = require('../utils/parseA1Range');
const { getSheetIdByName } = require('../services/sheets/getSheetIdByName');
const { getDefaultSheetId } = require('../services/sheets/getDefaultSheetId');

async function borders({ sheets, args }) {
  const [, spreadsheetId, range, styleRaw] = args;
  if (!spreadsheetId || !range)
    throw new Error(
      'Usage: borders <spreadsheetId> <range> [styleJsonOr@file]',
    );
  const style = styleRaw
    ? jsonFromArg(styleRaw, 'borderStyle')
    : { style: 'SOLID', color: { red: 0, green: 0, blue: 0 } };
  const grid = parseA1Range(range);
  const sheetId = grid.sheetName
    ? await getSheetIdByName(sheets, spreadsheetId, grid.sheetName)
    : await getDefaultSheetId(sheets, spreadsheetId);

  const response = await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          updateBorders: {
            range: { ...grid, sheetId },
            top: style,
            bottom: style,
            left: style,
            right: style,
            innerHorizontal: style,
            innerVertical: style,
          },
        },
      ],
    },
  });
  return { updated: true, replies: response.data.replies };
}

module.exports = { borders };
