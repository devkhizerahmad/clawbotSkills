// src/services/audit.js
const { getSheetsClient } = require('./google');
const { SCOPES, AUDIT } = require('../config');
const { indexToCol, parseA1Range } = require('../utils/sheets');

function formatTimestamp(ts) {
  const [date, time] = ts.split('.')[0].split('T');
  const [year, month, day] = date.split('-');
  return `${parseInt(month)}/${parseInt(day)}/${parseInt(year)} ${time}`;
}

async function logAudit({ user, sheet, cell, oldValue, newValue, source }) {
  if (oldValue === newValue) return;

  const sheets = getSheetsClient([SCOPES.WRITE]);
  const timestamp = new Date().toISOString();

  await sheets.spreadsheets.values.append({
    spreadsheetId: AUDIT.SPREADSHEET_ID,
    range: `${AUDIT.SHEET_NAME}!A:G`,
    valueInputOption: 'RAW',
    requestBody: {
      values: [
        [formatTimestamp(timestamp), user || 'unknown', sheet || '', cell || '', oldValue ?? '', newValue ?? '', source || 'sheets-cli'],
      ],
    },
  });
}

async function executeWithOptionalAudit({ command, spreadsheetId, range, newValue, execute }) {
  const sheets = getSheetsClient([SCOPES.WRITE]);
  let oldValue = '';
  let sheetName = '';

  if (range) {
    sheetName = range.includes('!') ? range.split('!')[0] : '';
    try {
      const oldRes = await sheets.spreadsheets.values.get({ spreadsheetId, range });
      oldValue = oldRes.data.values?.[0]?.[0] ?? '';
    } catch {
      oldValue = '';
    }
  }

  if (oldValue !== newValue) {
    const result = await execute();
    await logAudit({ user: 'ASSISTANT', sheet: sheetName, cell: range, oldValue, newValue, source: 'SYSTEM' });
    return result;
  } else {
    return { skipped: true, reason: 'Value unchanged' };
  }
}

async function executeWithAuditForBatch({ command, spreadsheetId, requestsRaw, range, execute }) {
  const sheets = getSheetsClient([SCOPES.WRITE]);
  let oldValues = [];
  let cells = [];

  if (range) {
    try {
      const oldRes = await sheets.spreadsheets.values.get({ spreadsheetId, range });
      const oldGrid = parseA1Range(range);
      const values = oldRes.data.values || [];
      values.forEach((row, rIdx) => {
        row.forEach((val, cIdx) => {
          const cell = `${indexToCol(cIdx + oldGrid.startColumnIndex)}${rIdx + oldGrid.startRowIndex + 1}`;
          cells.push(cell);
          oldValues.push(val ?? '');
        });
      });
    } catch { /* ignore */ }
  }

  const result = await execute();

  // Logic to parse new values from request and log
  const requests = Array.isArray(requestsRaw) ? requestsRaw : (requestsRaw?.data?.requests ?? []);
  const newValues = [];
  const newCells = [];

  requests.forEach((req) => {
    if (!req.updateCells) return;
    const startRow = req.updateCells.range?.startRowIndex || 0;
    const startCol = req.updateCells.range?.startColumnIndex || 0;
    req.updateCells.rows.forEach((row, rIdx) => {
      row.values.forEach((cellObj, cIdx) => {
        const newVal = cellObj.userEnteredValue?.stringValue ?? cellObj.userEnteredValue?.numberValue ?? '';
        newValues.push(newVal);
        const cell = `${indexToCol(cIdx + startCol)}${rIdx + startRow + 1}`;
        newCells.push(cell);
      });
    });
  });

  const oldStr = oldValues.join(', ');
  const newStr = newValues.join(', ');
  if (oldStr !== newStr || oldValues.length === 0) {
    await logAudit({
      user: 'ASSISTANT',
      sheet: '',
      cell: newCells.join(', '),
      oldValue: oldStr,
      newValue: newStr,
      source: 'SYSTEM',
    });
  }

  return result;
}

module.exports = { logAudit, executeWithOptionalAudit, executeWithAuditForBatch };