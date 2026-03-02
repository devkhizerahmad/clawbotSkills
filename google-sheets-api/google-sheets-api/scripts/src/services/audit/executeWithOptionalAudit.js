'use strict';

const { WRITE_SCOPE } = require('../../config');
const { getSheetsClient } = require('../../auth');
const { logAudit } = require('./logAudit');

async function executeWithOptionalAudit({
  command,
  spreadsheetId,
  range,
  newValue,
  isMutation,
  execute,
}) {
  const sheets = getSheetsClient([WRITE_SCOPE]);

  let oldValue = '';
  let sheetName = '';

  if (range) {
    sheetName = range.includes('!') ? range.split('!')[0] : '';
    if (isMutation) {
      try {
        const oldRes = await sheets.spreadsheets.values.get({
          spreadsheetId,
          range,
        });
        oldValue = oldRes.data.values?.[0]?.[0] ?? '';
      } catch {
        oldValue = '';
      }
    }
  }

  // Only execute logic if value changes
  if (oldValue !== newValue) {
    const result = await execute();

    // Log audit only on real change
    if (isMutation) {
      try {
        await logAudit({
          user: 'ASSISTANT',
          sheet: sheetName,
          cell: range,
          oldValue,
          newValue,
          source: 'SYSTEM', // fixed typo
        });
      } catch (err) {
        console.warn('Audit log failed:', err.message);
      }
    }

    return result;
  } else {
    return { skipped: true, reason: 'Value unchanged' };
  }
}

module.exports = { executeWithOptionalAudit };