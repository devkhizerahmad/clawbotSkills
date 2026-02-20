'use strict';

const { jsonFromArg } = require('../utils/jsonFromArg');
const {
  executeWithAuditForBatch,
} = require('../services/audit/executeWithAuditForBatch');

async function batchWrite({ sheets, args }) {
  const [, spreadsheetId, dataRaw] = args;
  if (!spreadsheetId || !dataRaw)
    throw new Error('Usage: batchWrite <spreadsheetId> <jsonOr@file>');

  const body = jsonFromArg(dataRaw, 'batchUpdate');

  return executeWithAuditForBatch({
    command: 'batchWrite',
    spreadsheetId,
    requestsRaw: body,
    execute: () =>
      sheets.spreadsheets.values.batchUpdate({
        spreadsheetId,
        requestBody: body,
      }),
  });
}

module.exports = { batchWrite };
