'use strict';

const { WRITE_SCOPE } = require('../../config');
const { getSheetsClient } = require('../../auth');
const { parseA1Range } = require('../../utils/parseA1Range');
const { indexToCol } = require('../../utils/indexToCol');
const { logAudit } = require('./logAudit');

async function executeWithAuditForBatch({
  command,
  spreadsheetId,
  requestsRaw,
  range, // optional, for fetching old values
  execute,
}) {
  const sheets = getSheetsClient([WRITE_SCOPE]);

  // Map old values if a range is provided
  let oldValues = [];
  let cells = [];
  if (range) {
    try {
      const oldRes = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range,
      });
      const oldGrid = parseA1Range(range);
      const values = oldRes.data.values || [];
      values.forEach((row, rIdx) => {
        row.forEach((val, cIdx) => {
          const cell = `${indexToCol(cIdx + oldGrid.startColumnIndex)}${
            rIdx + oldGrid.startRowIndex + 1
          }`;
          cells.push(cell);
          oldValues.push(val ?? '');
        });
      });
    } catch {
      oldValues = [];
      cells = [];
    }
  }

  // Execute the batch
  const result = await execute();

  // Normalize requests array (requestsRaw may be { data: { requests: [...] } })
  const requests = Array.isArray(requestsRaw)
    ? requestsRaw
    : (requestsRaw?.data?.requests ?? []);

  // Gather new values
  const newValues = [];
  const newCells = [];
  requests.forEach((req) => {
    if (!req.updateCells) return;
    const startRow = req.updateCells.range?.startRowIndex || 0;
    const startCol = req.updateCells.range?.startColumnIndex || 0;
    req.updateCells.rows.forEach((row, rIdx) => {
      row.values.forEach((cellObj, cIdx) => {
        const newVal =
          cellObj.userEnteredValue?.stringValue ??
          cellObj.userEnteredValue?.numberValue ??
          '';
        newValues.push(newVal);

        const cell = `${indexToCol(cIdx + startCol)}${rIdx + startRow + 1}`;
        newCells.push(cell);
      });
    });
  });

  // Only log if values actually changed
  const oldStr = oldValues.join(', ');
  const newStr = newValues.join(', ');
  if (oldStr !== newStr || oldValues.length === 0) {
    await logAudit({
      user: 'ASSISTANT',
      sheet: '', // omit sheet name for batch
      cell: newCells.join(', '),
      oldValue: oldStr,
      newValue: newStr,
      source: 'SYSTEM',
    });
  }

  return result;
}

module.exports = { executeWithAuditForBatch };
