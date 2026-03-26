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

  try {
    const sheets = getSheetsClient([WRITE_SCOPE]);
    const timestamp = new Date().toISOString();

    // Ensure values are strings or at least stringifiable
    const formatValue = (val) => {
      if (val === null || val === undefined) return '';
      if (typeof val === 'object') return JSON.stringify(val);
      return String(val);
    };

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
            formatValue(oldValue),
            formatValue(newValue),
            source || 'sheets-cli',
          ],
        ],
      },
    });
    console.log(`Audit log successful: ${source} - ${sheet} - ${cell}`);
  } catch (error) {
    console.error('CRITICAL: Audit log failed to write to spreadsheet:', error.message);
    // We don't throw here to avoid breaking the main command if auditing fails
  }
}

module.exports = { logAudit };
