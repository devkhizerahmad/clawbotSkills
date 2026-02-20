const { getSheetsClient } = require('../services/google');
const { jsonFromArg } = require('../utils/parser');
const { SCOPES } = require('../config');

async function execute(args, flags) {
  const spreadsheetId = args[1];
  const requestsRaw = args[2];
  if (!spreadsheetId || !requestsRaw) throw new Error('Usage: batch <spreadsheetId> <requestsJsonOr@file>');

  const payload = jsonFromArg(requestsRaw, 'requests');
  const requestBody = Array.isArray(payload) ? { requests: payload } : payload;
  const sheets = getSheetsClient([SCOPES.WRITE]);

  const response = await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody });
  return response.data;
}
module.exports = { execute };