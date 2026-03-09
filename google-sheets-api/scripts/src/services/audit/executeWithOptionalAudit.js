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
    // If it's a mutation, we want to capture old value before change if possible
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

  // Only execute logic if value changes (or if we can't determine change, blindly run)
  // For commands that return objects (like 'execute' passed in), we should check
  // However, the original code had specific logic here for skipping if oldValue === newValue

  if (oldValue !== newValue) {
    const result = await execute();

    // Log audit only on real change and mutations
    if (isMutation) {
      await logAudit({
        user: 'ASSISTANT',
        sheet: sheetName,
        cell: range,
        oldValue,
        newValue,
        source: 'SYTEM',
      });
    }

    return result;
  } else {
    // No change, nothing executed
    return { skipped: true, reason: 'Value unchanged' };
  }
}

module.exports = { executeWithOptionalAudit };
