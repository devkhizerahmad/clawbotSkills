'use strict';

async function info({ sheets, args }) {
  const [, spreadsheetId] = args;
  if (!spreadsheetId) throw new Error('Usage: info <spreadsheetId>');
  const response = await sheets.spreadsheets.get({ spreadsheetId });
  return response.data;
}

module.exports = { info };
