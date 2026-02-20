const { getSheetsClient } = require('../services/google');
const { SCOPES } = require('../config');

async function execute(args, flags) {
  const spreadsheetId = args[1];
  if (!spreadsheetId) throw new Error('Usage: info <spreadsheetId>');
  const sheets = getSheetsClient([SCOPES.READ]);
  const response = await sheets.spreadsheets.get({ spreadsheetId });
  return response.data;
}
module.exports = { execute };