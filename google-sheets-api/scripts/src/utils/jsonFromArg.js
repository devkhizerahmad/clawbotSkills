'use strict';

const fs = require('fs');
const { readFileJson } = require('./readFileJson.js');

function jsonFromArg(value, label) {
  if (!value) {
    throw new Error(`Missing JSON input for ${label}.`);
  }
  if (value.startsWith('@')) {
    const filePath = value.slice(1);
    if (!fs.existsSync(filePath)) {
      throw new Error(`JSON file not found: ${filePath}`);
    }
    return readFileJson(filePath);
  }
  return JSON.parse(value);
}

module.exports = { jsonFromArg };
