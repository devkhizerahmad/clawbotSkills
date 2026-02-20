'use strict';

const { jsonFromArg } = require('../utils/jsonFromArg');

async function batch({ sheets, args }) {
  const [, spreadsheetId, requestsRaw] = args;
  if (!spreadsheetId || !requestsRaw)
    throw new Error('Usage: batch <spreadsheetId> <requestsJsonOr@file>');
  const payload = jsonFromArg(requestsRaw, 'requests');
  const requestBody = Array.isArray(payload) ? { requests: payload } : payload;
  const response = await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody,
  });
  return response.data;
}

module.exports = { batch };
