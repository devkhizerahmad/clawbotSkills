'use strict';

function indexToCol(index) {
  let col = '';
  let i = index;
  while (i >= 0) {
    col = String.fromCharCode((i % 26) + 65) + col;
    i = Math.floor(i / 26) - 1;
  }
  return col;
}

module.exports = { indexToCol };
