const { getSheetsClient } = require('../services/google');
const { executeWithOptionalAudit } = require('../services/audit');
const { SCOPES } = require('../config');

async function execute(args, flags) {
  const spreadsheetId = args[1];
  const range = args[2];
  if (!spreadsheetId || !range) throw new Error('Usage: clear <spreadsheetId> <range>');
  
  const sheets = getSheetsClient([SCOPES.WRITE]);

  return await executeWithOptionalAudit({
    command: 'clear', spreadsheetId, range, newValue: '',
    execute: async () => {
      const response = await sheets.spreadsheets.values.clear({ spreadsheetId, range });
      return response.data;
    },
  });
}
module.exports = { execute };