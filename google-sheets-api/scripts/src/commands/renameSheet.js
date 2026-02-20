'use strict';

const { getSheetIdByName } = require('../services/sheets/getSheetIdByName');

async function renameSheet({ sheets, args }) {
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
  return response.data;
}

module.exports = { renameSheet };
