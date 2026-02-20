'use strict';

const fs = require('fs');

function readFileJson(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}

module.exports = { readFileJson };
