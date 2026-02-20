const { getSheetsClient } = require('../services/google');
const { SCOPES } = require('../config');

async function execute(args, flags) {
  const spreadsheetId = args[1];
  const title = args[2];
  if (!spreadsheetId || !title) throw new Error('Usage: addSheet <spreadsheetId> <title>');
  const sheets = getSheetsClient([SCOPES.WRITE]);
  const response = await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: [{ addSheet: { properties: { title } } }] } });
  return response.data;
}
module.exports = { execute };