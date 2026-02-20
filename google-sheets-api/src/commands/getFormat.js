const { getSheetsClient } = require('../services/google');
const { SCOPES } = require('../config');

async function execute(args, flags) {
  const spreadsheetId = args[1];
  const range = args[2];
  if (!spreadsheetId || !range) throw new Error('Usage: getFormat <spreadsheetId> <range>');
  const sheets = getSheetsClient([SCOPES.READ]);
  const response = await sheets.spreadsheets.get({ spreadsheetId, ranges: [range], includeGridData: true });
  return response.data;
}
module.exports = { execute };