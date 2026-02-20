'use strict';

const { jsonFromArg } = require('../utils/jsonFromArg');
const { parseA1Range } = require('../utils/parseA1Range');
const { getSheetIdByName } = require('../services/sheets/getSheetIdByName');
const { getDefaultSheetId } = require('../services/sheets/getDefaultSheetId');
const {
  buildUserEnteredFormat,
} = require('../services/sheets/buildUserEnteredFormat');
const {
  executeWithAuditForBatch,
} = require('../services/audit/executeWithAuditForBatch');

async function format({ sheets, args }) {
  const [, spreadsheetId, range, formatRaw] = args;
  if (!spreadsheetId || !range || !formatRaw)
    throw new Error(
      'Usage: format <spreadsheetId> <range> <formatJsonOr@file>',
    );
  const formatOptions = jsonFromArg(formatRaw, 'format');
  const grid = parseA1Range(range);
  const sheetId = grid.sheetName
    ? await getSheetIdByName(sheets, spreadsheetId, grid.sheetName)
    : await getDefaultSheetId(sheets, spreadsheetId);

  const { userEnteredFormat, fields } = buildUserEnteredFormat(formatOptions);
  if (!fields.length) throw new Error('No format fields provided.');

  return executeWithAuditForBatch({
    command: 'format',
    spreadsheetId,
    range,
    requestsRaw: formatOptions,
    execute: () =>
      sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              repeatCell: {
                range: { ...grid, sheetId },
                cell: { userEnteredFormat },
                fields: fields.join(','),
              },
            },
          ],
        },
      }),
  });
}

module.exports = { format };
