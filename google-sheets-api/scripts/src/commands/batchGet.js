'use strict';

const { toRanges } = require('../utils/toRanges');

async function batchGet({ sheets, args, flags }) {
  const spreadsheetId = args[1];
  const rangeArgs = args.slice(2);
  if (!spreadsheetId || rangeArgs.length === 0)
    throw new Error('Usage: batchGet <spreadsheetId> <range1,range2,...>');

  const ranges = toRanges(
    rangeArgs.length === 1 ? rangeArgs[0] : rangeArgs.join(','),
  );

  const response = await sheets.spreadsheets.values.batchGet({
    spreadsheetId,
    ranges,
    majorDimension: flags.major,
    valueRenderOption: flags.render || flags.valueRenderOption,
    dateTimeRenderOption: flags.date || flags.dateTimeRenderOption,
  });
  return response.data;
}

module.exports = { batchGet };
