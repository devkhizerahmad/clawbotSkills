const { getSheetsClient } = require('../services/google');
const { executeWithAuditForBatch } = require('../services/audit');
const { parseA1Range, getSheetIdByName, getDefaultSheetId, buildUserEnteredFormat } = require('../utils/sheets');
const { jsonFromArg } = require('../utils/parser');
const { SCOPES } = require('../config');

async function execute(args, flags) {
  const spreadsheetId = args[1];
  const range = args[2];
  const formatRaw = args[3];
  if (!spreadsheetId || !range || !formatRaw) throw new Error('Usage: format <spreadsheetId> <range> <formatJsonOr@file>');

  const formatOptions = jsonFromArg(formatRaw, 'format');
  const sheets = getSheetsClient([SCOPES.WRITE]);
  const grid = parseA1Range(range);
  const sheetId = grid.sheetName ? await getSheetIdByName(sheets, spreadsheetId, grid.sheetName) : await getDefaultSheetId(sheets, spreadsheetId);

  const { userEnteredFormat, fields } = buildUserEnteredFormat(formatOptions);
  if (!fields.length) throw new Error('No format fields provided.');

  return await executeWithAuditForBatch({
    command: 'format', spreadsheetId, range, requestsRaw: formatOptions,
    execute: () => sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: [{ repeatCell: { range: { ...grid, sheetId }, cell: { userEnteredFormat }, fields: fields.join(',') } }] } }),
  });
}
module.exports = { execute };