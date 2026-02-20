'use strict';

const { colToIndex } = require('./colToIndex.js');

function parseA1Range(a1) {
  let sheetName = null;
  let ref = a1;

  if (a1.includes('!')) {
    const parts = a1.split('!');
    sheetName = parts[0].replace(/^'+|'+$/g, '');
    ref = parts[1];
  }

  const match = ref.match(/^([A-Za-z]+)(\d+)(?::([A-Za-z]+)(\d+))?$/);
  if (!match) {
    throw new Error(`Unsupported A1 range: ${a1}. Use A1 or A1:B2 format.`);
  }

  const startCol = colToIndex(match[1]);
  const startRow = parseInt(match[2], 10) - 1;
  const endCol = match[3] ? colToIndex(match[3]) + 1 : startCol + 1;
  const endRow = match[4] ? parseInt(match[4], 10) : startRow + 1;

  return {
    sheetName,
    startRowIndex: startRow,
    endRowIndex: endRow,
    startColumnIndex: startCol,
    endColumnIndex: endCol,
  };
}

module.exports = { parseA1Range };
