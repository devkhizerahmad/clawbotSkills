const { getSheetsClient } = require('../services/google');
const { executeWithAuditForBatch } = require('../services/audit');
const { jsonFromArg } = require('../utils/parser');
const { SCOPES } = require('../config');

async function execute(args, flags) {
  const spreadsheetId = args[1];
  const dataRaw = args[2];
  if (!spreadsheetId || !dataRaw) throw new Error('Usage: batchWrite <spreadsheetId> <jsonOr@file>');

  const body = jsonFromArg(dataRaw, 'batchUpdate');
  const sheets = getSheetsClient([SCOPES.WRITE]);

  return await executeWithAuditForBatch({
    command: 'batchWrite', spreadsheetId, requestsRaw: body,
    execute: () => sheets.spreadsheets.values.batchUpdate({ spreadsheetId, requestBody: body }),
  });
}
module.exports = { execute };