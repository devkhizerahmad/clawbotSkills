'use strict';

// const { logAudit } = require('../services/audit/logAudit');
const { executeWithAuditForBatch } = require('../services/audit/executeWithAuditForBatch');

async function addSheet({ sheets, args, command }) {
  const [, spreadsheetId, title] = args;
  if (!spreadsheetId || !title)
    throw new Error('Usage: addSheet <spreadsheetId> <title>');

  const requests = [{ addSheet: { properties: { title } } }];
  const response = await executeWithAuditForBatch({
    command,
    spreadsheetId,
    requestsRaw: requests,
    // No range because this  
    execute: () =>
      sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: { requests },
      }),
  });

  return response;
}

module.exports = { addSheet };
