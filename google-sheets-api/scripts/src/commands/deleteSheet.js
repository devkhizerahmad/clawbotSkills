'use strict';

const { getSheetIdByName } = require('../services/sheets/getSheetIdByName');

async function deleteSheet({ sheets, args }) {
  const [, spreadsheetId, sheetName] = args;
  if (!spreadsheetId || !sheetName)
    throw new Error('Usage: deleteSheet <spreadsheetId> <sheetName>');
  const sheetId = await getSheetIdByName(sheets, spreadsheetId, sheetName);
  const response = await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests: [{ deleteSheet: { sheetId } }] },
  });
  return response.data;
}

module.exports = { deleteSheet };
