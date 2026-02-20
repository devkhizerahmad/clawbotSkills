'use strict';

async function getFormat({ sheets, args }) {
  const [, spreadsheetId, range] = args;
  if (!spreadsheetId || !range)
    throw new Error('Usage: getFormat <spreadsheetId> <range>');
  const response = await sheets.spreadsheets.get({
    spreadsheetId,
    ranges: [range],
    includeGridData: true,
  });
  return response.data;
}

module.exports = { getFormat };
