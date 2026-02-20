// src/utils/parser.js
const fs = require('fs');

function parseArgs(argv) {
  const args = [];
  const flags = {};

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith('--')) {
      args.push(token);
      continue;
    }

    const stripped = token.slice(2);
    const eqIndex = stripped.indexOf('=');
    if (eqIndex >= 0) {
      const key = stripped.slice(0, eqIndex);
      const value = stripped.slice(eqIndex + 1);
      flags[key] = value === '' ? true : value;
      continue;
    }

    const next = argv[i + 1];
    if (next && !next.startsWith('--')) {
      flags[stripped] = next;
      i += 1;
    } else {
      flags[stripped] = true;
    }
  }

  return { args, flags };
}

function readFileJson(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}

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

module.exports = { parseArgs, readFileJson, jsonFromArg };