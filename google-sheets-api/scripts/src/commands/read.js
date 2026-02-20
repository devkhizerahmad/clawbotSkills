'use strict';

const {
  executeWithOptionalAudit,
} = require('../services/audit/executeWithOptionalAudit');

async function read({ sheets, args, flags, command, isMutation }) {
  const spreadsheetId = args[1];
  const range = args[2];
  if (!spreadsheetId || !range)
    throw new Error('Usage: read <spreadsheetId> <range>');

  return executeWithOptionalAudit({
    isMutation,
    command,
    execute: async () => {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range,
        majorDimension: flags.major,
        valueRenderOption: flags.render || flags.valueRenderOption,
        dateTimeRenderOption: flags.date || flags.dateTimeRenderOption,
      });
      return flags.full ? response.data : response.data.values || [];
    },
  });
}

module.exports = { read };
