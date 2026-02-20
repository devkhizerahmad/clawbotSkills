const { getSheetsClient } = require('../services/google');
const { toRanges } = require('../utils/sheets');
const { SCOPES } = require('../config');

async function execute(args, flags) {
  const spreadsheetId = args[1];
  const rangeArgs = args.slice(2);
  if (!spreadsheetId || rangeArgs.length === 0) throw new Error('Usage: batchGet <spreadsheetId> <range1,range2,...>');
  
  const ranges = toRanges(rangeArgs.length === 1 ? rangeArgs[0] : rangeArgs.join(','));
  const sheets = getSheetsClient([SCOPES.READ]);

  const response = await sheets.spreadsheets.values.batchGet({
    spreadsheetId, ranges, majorDimension: flags.major,
    valueRenderOption: flags.render, dateTimeRenderOption: flags.date,
  });
  return response.data;
}
module.exports = { execute };