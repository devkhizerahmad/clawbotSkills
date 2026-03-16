'use strict';

const { logAudit } = require('../services/audit/logAudit');
const { getSheetsClient } = require('../auth');
const { WRITE_SCOPE } = require('../config');

async function clear({ sheets, args, command }) {
  const spreadsheetId = args[1];
  const range = args[2];

  if (!spreadsheetId || !range)
    throw new Error('Usage: clear <spreadsheetId> <range>');

  const sheetName = range.includes('!') ? range.split('!')[0] : '';
  const auditUser = 'CLEAR_CMD'; // Use command name as user identifier

  // Fetch old value before clearing
  let oldValue = '';
  try {
    const sheetsClient = getSheetsClient([WRITE_SCOPE]);
    const oldRes = await sheetsClient.spreadsheets.values.get({
      spreadsheetId,
      range,
    });
    const vals = oldRes.data.values;
    if (vals && vals.length > 0) {
      // Flatten all values for audit
      oldValue = vals.map(row => row.join(', ')).join(' | ');
    }
  } catch {
    oldValue = '';
  }

  // Always execute the clear regardless of whether the range is empty
  const response = await sheets.spreadsheets.values.clear({
    spreadsheetId,
    range,
  });

  // Always audit (clearing an already-empty range is still an intentional action)
  try {
    await logAudit({
      user: auditUser,
      sheet: sheetName,
      cell: range,
      oldValue: oldValue || '(empty)',
      newValue: '(cleared)',
      source: command || 'clear',
    });
  } catch (err) {
    console.warn('Audit log failed:', err.message);
  }

  return response.data;
}

module.exports = { clear };
