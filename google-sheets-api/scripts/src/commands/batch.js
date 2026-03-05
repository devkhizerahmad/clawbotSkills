'use strict';

const { jsonFromArg } = require('../utils/jsonFromArg');
const { logAudit } = require('../services/audit/logAudit');

async function batch({ sheets, args, command }) {
  const [, spreadsheetId, requestsRaw] = args;
  if (!spreadsheetId || !requestsRaw)
    throw new Error('Usage: batch <spreadsheetId> <requestsJsonOr@file>');
    
  const payload = jsonFromArg(requestsRaw, 'requests');
  const requestBody = Array.isArray(payload) ? { requests: payload } : payload;
  const response = await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody,
  });
  
  // Log audit entry for batch operations
  const requestCount = requestBody.requests?.length || 0;
const newValue = requestCount > 20
  ? `Batch operation executed with 20 requests + ${requestCount - 20} more`
  : `Batch operation executed with ${requestCount} requests`;
  // Since batch can contain multiple operations, we'll log a generic entry
  await logAudit({
    user: 'ASSISTANT',
    sheet: 'Multiple sheets',
    cell: 'Multiple ranges',
    oldValue: 'N/A',
    newValue  : newValue,
    source: 'SYSTEM',
  });
  
  return response.data;
}

module.exports = { batch };
