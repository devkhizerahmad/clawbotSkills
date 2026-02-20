#!/usr/bin/env node
"use strict";

const { parseArgs } = require("./src/utils/parser");
const { SCOPES, READ_ONLY_COMMANDS } = require("./src/config");
const { getSheetsClient } = require("./src/services/google");

// Import all command modules
const commands = {
  read: require("./src/commands/read"),
  write: require("./src/commands/write"),
  append: require("./src/commands/append"),
  clear: require("./src/commands/clear"),
  batchGet: require("./src/commands/batchGet"),
  batchWrite: require("./src/commands/batchWrite"),
  create: require("./src/commands/create"),
  info: require("./src/commands/info"),
  format: require("./src/commands/format"),
  getFormat: require("./src/commands/getFormat"),
  borders: require("./src/commands/borders"),
  unmerge: require("./src/commands/unmerge"),
  resize: require("./src/commands/resize"),
  autoResize: require("./src/commands/autoResize"),
  freeze: require("./src/commands/freeze"),
  addSheet: require("./src/commands/addSheet"),
  deleteSheet: require("./src/commands/deleteSheet"),
  renameSheet: require("./src/commands/renameSheet"),
  copyFormat: require("./src/commands/copyFormat"),
  batch: require("./src/commands/batch"),
  highlight: require("./src/commands/highlight"),
  unhighlight: require("./src/commands/unhighlight"),
};

const HELP_TEXT = `
Google Sheets CLI (Refactored)

Usage:
  node index.js <command> [args] [--flags]

Core data commands:
  read <spreadsheetId> <range>
  write <spreadsheetId> <range> <jsonOr@file>
  append <spreadsheetId> <range> <jsonOr@file>
  clear <spreadsheetId> <range>
  batchGet <spreadsheetId> <range1,range2,...>
  batchWrite <spreadsheetId> <jsonOr@file>
  highlight <spreadsheetId> <range>
  unhighlight <spreadsheetId> <range>

Formatting and layout:
  format <spreadsheetId> <range> <formatJsonOr@file>
  borders <spreadsheetId> <range> [styleJsonOr@file]
  resize <spreadsheetId> <sheetName> <cols|rows> <start> <end> <px>
  autoResize <spreadsheetId> <sheetName> <startCol> <endCol>
  freeze <spreadsheetId> <sheetName> [rows] [cols]

Sheet management:
  create <title>
  info <spreadsheetId>
  addSheet <spreadsheetId> <title>
  deleteSheet <spreadsheetId> <sheetName>
  renameSheet <spreadsheetId> <oldName> <newName>
  copyFormat <spreadsheetId> <sourceRange> <destRange>
`;

async function main() {
  const { args, flags } = parseArgs(process.argv.slice(2));
  const command = args[0];

  if (!command || command === "help" || command === "--help") {
    console.log(HELP_TEXT.trim());
    return;
  }

  // Determine Scopes and Initialize Client
  const scopes = READ_ONLY_COMMANDS.has(command)
    ? [SCOPES.READ]
    : [SCOPES.WRITE];
  getSheetsClient(scopes);

  try {
    const cmdModule = commands[command];

    if (cmdModule && typeof cmdModule.execute === "function") {
      const result = await cmdModule.execute(args, flags);
      console.log(JSON.stringify(result, null, 2));
    } else {
      throw new Error(`Unknown command: ${command}`);
    }
  } catch (error) {
    console.error("Error:", error.message);
    if (error.response?.data?.error) {
      console.error(JSON.stringify(error.response.data.error, null, 2));
    }
    process.exit(1);
  }
}

main();
