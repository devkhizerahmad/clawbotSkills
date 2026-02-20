'use strict';

const {
  executeWithOptionalAudit,
} = require('../services/audit/executeWithOptionalAudit');

async function clear({ sheets, args, flags, command, isMutation }) {
  const spreadsheetId = args[1];
  const range = args[2];

  if (!spreadsheetId || !range)
    throw new Error('Usage: clear <spreadsheetId> <range>');

  return executeWithOptionalAudit({
    isMutation,
    command,
    spreadsheetId,
    range,
    newValue: '',
    execute: async () => {
      const response = await sheets.spreadsheets.values.clear({
        spreadsheetId,
        range,
      });
      return response.data;
    },
  });
}

module.exports = { clear };
