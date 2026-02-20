'use strict';

function colToIndex(col) {
  let index = 0;
  const letters = col.toUpperCase();
  for (let i = 0; i < letters.length; i++) {
    index = index * 26 + (letters.charCodeAt(i) - 64);
  }
  return index - 1;
}

module.exports = { colToIndex };
