'use strict';

async function addSheet({ sheets, args }) {
  const [, spreadsheetId, title] = args;
  if (!spreadsheetId || !title)
    throw new Error('Usage: addSheet <spreadsheetId> <title>');
  const response = await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests: [{ addSheet: { properties: { title } } }] },
  });
  return response.data;
}

module.exports = { addSheet };
