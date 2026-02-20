'use strict';

const {
  WRITE_SCOPE,
  AUDIT_SPREADSHEET_ID,
  AUDIT_SHEET_NAME,
} = require('../../config');
const { getSheetsClient } = require('../../auth');
const { formatTimestamp } = require('../../utils/formatTimestamp');

async function logAudit({ user, sheet, cell, oldValue, newValue, source }) {
  if (oldValue === newValue) {
    // No change → no audit log
    return;
  }

  const sheets = getSheetsClient([WRITE_SCOPE]);
  const timestamp = new Date().toISOString();

  await sheets.spreadsheets.values.append({
    spreadsheetId: AUDIT_SPREADSHEET_ID,
    range: `${AUDIT_SHEET_NAME}!A:G`,
    valueInputOption: 'RAW',
    requestBody: {
      values: [
        [
          formatTimestamp(timestamp),
          user || 'unknown',
          sheet || '',
          cell || '',
          oldValue ?? '',
          newValue ?? '',
          source || 'sheets-cli',
        ],
      ],
    },
  });
}

module.exports = { logAudit };
