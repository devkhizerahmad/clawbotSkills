#!/usr/bin/env node
'use strict';

const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const READ_SCOPE = 'https://www.googleapis.com/auth/spreadsheets.readonly';
const WRITE_SCOPE = 'https://www.googleapis.com/auth/spreadsheets';

const DEFAULT_CRED_FILES = [
  'service-account.json',
  'credentials.json',
  'google-service-account.json',
  path.join(process.env.HOME || '', '.config/google-sheets/credentials.json'),
];

const AUDIT_SPREADSHEET_ID = '1x7Ch_AOuLk6Zht2ef0Q--2K_QueKvcAft-P6d0sx76A';
const AUDIT_SHEET_NAME = 'Audit_Log';

const formatTimestamp = (ts) => {
  const [date, time] = ts.split('.')[0].split('T');
  const [year, month, day] = date.split('-');
  return `${parseInt(month)}/${parseInt(day)}/${parseInt(year)} ${time}`;
};

async function logAudit({ user, sheet, cell, oldValue, newValue, source }) {
  if (oldValue === newValue) {
    // No change → no audit log
    return;
  }

  const sheets = getSheetsClient([WRITE_SCOPE]);
  const timestamp = new Date().toISOString();

  await sheets.spreadsheets.values.append({
    spreadsheetId: AUDIT_SPREADSHEET_ID,
    range: `${AUDIT_SHEET_NAME}!A:G`,
    valueInputOption: 'RAW',
    requestBody: {
      values: [
        [
          formatTimestamp(timestamp),
          user || 'unknown',
          sheet || '',
          cell || '',
          oldValue ?? '',
          newValue ?? '',
          source || 'sheets-cli',
        ],
      ],
    },
  });
}

async function executeWithOptionalAudit({
  command,
  spreadsheetId,
  range,
  newValue,
  execute,
}) {
  const sheets = getSheetsClient([WRITE_SCOPE]);

  let oldValue = '';
  let sheetName = '';

  if (range) {
    sheetName = range.includes('!') ? range.split('!')[0] : '';

    try {
      const oldRes = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range,
      });
      oldValue = oldRes.data.values?.[0]?.[0] ?? '';
    } catch {
      oldValue = '';
    }
  }

  // Only execute if value actually changes
  if (oldValue !== newValue) {
    const result = await execute();

    // Log audit only on real change
    await logAudit({
      user: 'ASSISTANT',
      sheet: sheetName,
      cell: range,
      oldValue,
      newValue,
      source: 'SYTEM',
    });

    return result;
  } else {
    // No change, nothing executed
    return { skipped: true, reason: 'Value unchanged' };
  }
}

const READ_ONLY_COMMANDS = new Set([
  'read',
  'batchGet',
  'info',
  'getFormat',
  'revisions',
]);

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

function resolveCredentials() {
  const inlineJson =
    process.env.GOOGLE_SHEETS_CREDENTIALS_JSON ||
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (inlineJson) {
    return {
      credentials: JSON.parse(inlineJson),
      source: 'env:GOOGLE_SHEETS_CREDENTIALS_JSON',
    };
  }

  const envPath =
    process.env.GOOGLE_SERVICE_ACCOUNT_KEY ||
    process.env.GOOGLE_SHEETS_KEY_FILE ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (envPath && fs.existsSync(envPath)) {
    return { credentials: readFileJson(envPath), source: `file:${envPath}` };
  }

  for (const rel of DEFAULT_CRED_FILES) {
    const fullPath = path.isAbsolute(rel) ? rel : path.join(process.cwd(), rel);
    if (fs.existsSync(fullPath)) {
      return {
        credentials: readFileJson(fullPath),
        source: `file:${fullPath}`,
      };
    }
  }

  return null;
}

function requireCredentials() {
  const found = resolveCredentials();
  if (!found) {
    console.error('No Google Sheets credentials found.');
    console.error(
      'Set GOOGLE_SERVICE_ACCOUNT_KEY or GOOGLE_SHEETS_CREDENTIALS_JSON,',
    );
    console.error('or place credentials.json in the skill folder.');
    process.exit(1);
  }
  return found;
}

const CLIENT_CACHE = new Map();
function getSheetsClient(scopes) {
  const cacheKey = scopes.join(' ');
  if (CLIENT_CACHE.has(cacheKey)) {
    return CLIENT_CACHE.get(cacheKey);
  }

  const { credentials } = requireCredentials();
  const auth = new google.auth.GoogleAuth({ credentials, scopes });
  const client = google.sheets({ version: 'v4', auth });
  CLIENT_CACHE.set(cacheKey, client);
  return client;
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

function colToIndex(col) {
  let index = 0;
  const letters = col.toUpperCase();
  for (let i = 0; i < letters.length; i++) {
    index = index * 26 + (letters.charCodeAt(i) - 64);
  }
  return index - 1;
}

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

async function getSheetIdByName(sheets, spreadsheetId, sheetName) {
  const response = await sheets.spreadsheets.get({ spreadsheetId });
  const entry = response.data.sheets.find(
    (s) => s.properties?.title === sheetName,
  );
  if (!entry) {
    throw new Error(`Sheet not found: ${sheetName}`);
  }
  return entry.properties.sheetId;
}

async function getDefaultSheetId(sheets, spreadsheetId) {
  const response = await sheets.spreadsheets.get({ spreadsheetId });
  const entry = response.data.sheets[0];
  if (!entry) {
    throw new Error('Spreadsheet has no sheets.');
  }
  return entry.properties.sheetId;
}

function normalizeColor(color) {
  if (!color) return undefined;
  return {
    red: (color.red || 0) / 255,
    green: (color.green || 0) / 255,
    blue: (color.blue || 0) / 255,
  };
}

function buildUserEnteredFormat(options) {
  const userEnteredFormat = {};
  const fields = [];

  if (options.backgroundColor) {
    userEnteredFormat.backgroundColor = normalizeColor(options.backgroundColor);
    fields.push('userEnteredFormat.backgroundColor');
  }

  if (options.textFormat) {
    const tf = options.textFormat;
    userEnteredFormat.textFormat = {};

    if (tf.bold !== undefined) {
      userEnteredFormat.textFormat.bold = tf.bold;
      fields.push('userEnteredFormat.textFormat.bold');
    }
    if (tf.italic !== undefined) {
      userEnteredFormat.textFormat.italic = tf.italic;
      fields.push('userEnteredFormat.textFormat.italic');
    }
    if (tf.underline !== undefined) {
      userEnteredFormat.textFormat.underline = tf.underline;
      fields.push('userEnteredFormat.textFormat.underline');
    }
    if (tf.strikethrough !== undefined) {
      userEnteredFormat.textFormat.strikethrough = tf.strikethrough;
      fields.push('userEnteredFormat.textFormat.strikethrough');
    }
    if (tf.fontSize !== undefined) {
      userEnteredFormat.textFormat.fontSize = tf.fontSize;
      fields.push('userEnteredFormat.textFormat.fontSize');
    }
    if (tf.fontFamily) {
      userEnteredFormat.textFormat.fontFamily = tf.fontFamily;
      fields.push('userEnteredFormat.textFormat.fontFamily');
    }
    if (tf.foregroundColor) {
      userEnteredFormat.textFormat.foregroundColor = normalizeColor(
        tf.foregroundColor,
      );
      fields.push('userEnteredFormat.textFormat.foregroundColor');
    }
  }

  if (options.horizontalAlignment) {
    userEnteredFormat.horizontalAlignment =
      options.horizontalAlignment.toUpperCase();
    fields.push('userEnteredFormat.horizontalAlignment');
  }

  if (options.verticalAlignment) {
    userEnteredFormat.verticalAlignment =
      options.verticalAlignment.toUpperCase();
    fields.push('userEnteredFormat.verticalAlignment');
  }

  if (options.wrapStrategy) {
    userEnteredFormat.wrapStrategy = options.wrapStrategy.toUpperCase();
    fields.push('userEnteredFormat.wrapStrategy');
  }

  if (options.numberFormat) {
    userEnteredFormat.numberFormat = {
      type: options.numberFormat.type,
      pattern: options.numberFormat.pattern,
    };
    fields.push('userEnteredFormat.numberFormat');
  }

  return { userEnteredFormat, fields };
}

function toRanges(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return value
    .split(',')
    .map((range) => range.trim())
    .filter(Boolean);
}

/**
 * Updates the "Status" column for a given row in a sheet.
 */
async function updateStatus(
  sheets,
  spreadsheetId,
  sheetName,
  rowNumber,
  statusValue,
) {
  console.log(`Checking for Status column in ${sheetName}...`);

  // 1️⃣ Get header row
  const headerRes = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!1:1`,
  });

  const headerRow = headerRes.data.values?.[0] || [];
  console.log(`Header row: ${JSON.stringify(headerRow)}`);

  // 2️⃣ Find Status column
  const statusIndex = headerRow.findIndex(
    (h) => h?.toLowerCase().trim() === 'status',
  );
  console.log(`Status column index found: ${statusIndex}`);

  if (statusIndex === -1) {
    console.log('No "Status" column found. Skipping status update.');
    return;
  }

  // 3️⃣ Convert column index to A1 notation correctly
  const statusColumnLetter = indexToCol(statusIndex);
  const statusCell = `${sheetName}!${statusColumnLetter}${rowNumber}`;
  console.log(`Updating status at ${statusCell} to "${statusValue}"`);

  // 4️⃣ Update Status cell
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: statusCell,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [[statusValue]],
    },
  });
  console.log('Status updated successfully.');
}

/**
 * Converts zero-based column index to A1 notation
 */
function indexToCol(index) {
  let col = '';
  let i = index;
  while (i >= 0) {
    col = String.fromCharCode((i % 26) + 65) + col;
    i = Math.floor(i / 26) - 1;
  }
  return col;
}

const HELP_TEXT = `
Google Sheets CLI (OpenClaw skill)

Usage:
  node scripts/sheets-cli.js <command> [args] [--flags]

Core data commands:
  read <spreadsheetId> <range> [--major=ROWS|COLUMNS] [--render=FORMATTED_VALUE]
  write <spreadsheetId> <range> <jsonOr@file> [--input=RAW|USER_ENTERED]
  append <spreadsheetId> <range> <jsonOr@file> [--input=RAW|USER_ENTERED] [--insert=INSERT_ROWS|OVERWRITE]
  clear <spreadsheetId> <range>
  batchGet <spreadsheetId> <range1,range2,...>
  batchWrite <spreadsheetId> <jsonOr@file>

Formatting and layout:
  format <spreadsheetId> <range> <formatJsonOr@file>
  getFormat <spreadsheetId> <range>
  borders <spreadsheetId> <range> [styleJsonOr@file]
  merge <spreadsheetId> <range> [--type=MERGE_ALL|MERGE_COLUMNS|MERGE_ROWS]
  unmerge <spreadsheetId> <range>
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

Advanced:
  batch <spreadsheetId> <requestsJsonOr@file>
`;

function indexToCol(index) {
  let col = '';
  let i = index;
  while (i >= 0) {
    col = String.fromCharCode((i % 26) + 65) + col;
    i = Math.floor(i / 26) - 1;
  }
  return col;
}

async function executeWithAuditForBatch({
  command,
  spreadsheetId,
  requestsRaw,
  range, // optional, for fetching old values
  execute,
}) {
  const sheets = getSheetsClient([WRITE_SCOPE]);

  // Map old values if a range is provided
  let oldValues = [];
  let cells = [];
  if (range) {
    try {
      const oldRes = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range,
      });
      const oldGrid = parseA1Range(range);
      const values = oldRes.data.values || [];
      values.forEach((row, rIdx) => {
        row.forEach((val, cIdx) => {
          const cell = `${indexToCol(cIdx + oldGrid.startColumnIndex)}${rIdx + oldGrid.startRowIndex + 1}`;
          cells.push(cell);
          oldValues.push(val ?? '');
        });
      });
    } catch {
      oldValues = [];
      cells = [];
    }
  }

  // Execute the batch
  const result = await execute();

  // Normalize requests array (requestsRaw may be { data: { requests: [...] } })
  const requests = Array.isArray(requestsRaw)
    ? requestsRaw
    : (requestsRaw?.data?.requests ?? []);

  // Gather new values
  const newValues = [];
  const newCells = [];
  requests.forEach((req) => {
    if (!req.updateCells) return;
    const startRow = req.updateCells.range?.startRowIndex || 0;
    const startCol = req.updateCells.range?.startColumnIndex || 0;
    req.updateCells.rows.forEach((row, rIdx) => {
      row.values.forEach((cellObj, cIdx) => {
        const newVal =
          cellObj.userEnteredValue?.stringValue ??
          cellObj.userEnteredValue?.numberValue ??
          '';
        newValues.push(newVal);

        const cell = `${indexToCol(cIdx + startCol)}${rIdx + startRow + 1}`;
        newCells.push(cell);
      });
    });
  });

  // Only log if values actually changed
  const oldStr = oldValues.join(', ');
  const newStr = newValues.join(', ');
  if (oldStr !== newStr || oldValues.length === 0) {
    await logAudit({
      user: 'ASSISTANT',
      sheet: '', // omit sheet name for batch
      cell: newCells.join(', '),
      oldValue: oldStr,
      newValue: newStr,
      source: 'SYSTEM',
    });
  }

  return result;
}

async function main() {
  const { args, flags } = parseArgs(process.argv.slice(2));
  const command = args[0];

  if (!command || command === 'help' || command === '--help') {
    console.log(HELP_TEXT.trim());
    return;
  }

  const scopes = READ_ONLY_COMMANDS.has(command) ? [READ_SCOPE] : [WRITE_SCOPE];

  const sheets = getSheetsClient(scopes);
  const isMutation = !READ_ONLY_COMMANDS.has(command);

  try {
    let result;
    let spreadsheetId = null;
    let range = null;
    let newValue = null;

    switch (command) {
      case 'read': {
        spreadsheetId = args[1];
        range = args[2];
        if (!spreadsheetId || !range)
          throw new Error('Usage: read <spreadsheetId> <range>');

        result = await executeWithOptionalAudit({
          isMutation,
          command,
          execute: async () => {
            const response = await sheets.spreadsheets.values.get({
              spreadsheetId,
              range,
              majorDimension: flags.major,
              valueRenderOption: flags.render || flags.valueRenderOption,
              dateTimeRenderOption: flags.date || flags.dateTimeRenderOption,
            });
            return flags.full ? response.data : response.data.values || [];
          },
        });
        break;
      }

      // case 'write': {
      //   spreadsheetId = args[1];
      //   range = args[2];
      //   const dataRaw = args[3];

      //   if (!spreadsheetId || !range || !dataRaw)
      //     throw new Error('Usage: write <spreadsheetId> <range> <jsonOr@file>');

      //   const values = jsonFromArg(dataRaw, 'values');
      //   newValue = values?.[0]?.[0];

      //   result = await executeWithOptionalAudit({
      //     isMutation,
      //     command,
      //     spreadsheetId,
      //     range,
      //     newValue,
      //     execute: async () => {
      //       const response = await sheets.spreadsheets.values.update({
      //         spreadsheetId,
      //         range,
      //         valueInputOption: flags.input || 'USER_ENTERED',
      //         requestBody: {
      //           values,
      //           majorDimension: flags.major,
      //         },
      //       });
      //       return response.data;
      //     },
      //   });
      //   break;
      // }
      case 'write': {
        spreadsheetId = args[1];
        range = args[2];
        const dataRaw = args[3];

        if (!spreadsheetId || !range || !dataRaw)
          throw new Error('Usage: write <spreadsheetId> <range> <jsonOr@file>');

        const values = jsonFromArg(dataRaw, 'values');
        newValue = values?.[0]?.[0];

        result = await executeWithOptionalAudit({
          isMutation,
          command,
          spreadsheetId,
          range,
          newValue,
          execute: async () => {
            const sheets = getSheetsClient([WRITE_SCOPE]);
            // 🟢 STEP 1 — READ CURRENT VALUE
            const existing = await sheets.spreadsheets.values.get({
              spreadsheetId,
              range,
            });

            const oldValue = existing.data.values?.[0]?.[0] ?? '';

            const wasEmpty = oldValue === '';

            // 🟢 STEP 2 — WRITE NEW VALUE
            // const response = await sheets.spreadsheets.values.update({
            //   spreadsheetId,
            //   range,
            //   valueInputOption: flags.input || 'USER_ENTERED',
            //   requestBody: {
            //     values,
            //     majorDimension: flags.major,
            //   },
            // });
            if (oldValue !== newValue) {
              await sheets.spreadsheets.values.update({
                spreadsheetId,
                range,
                valueInputOption: flags.input || 'USER_ENTERED',
                requestBody: { values, majorDimension: flags.major },
              });
            }

            // 🟢 STEP 3 — EXTRACT ROW NUMBER
            const match = range.match(/!(?:[A-Z]+)(\d+)/);
            const rowNumber = parseInt(match[1], 10);
            const sheetName = range.split('!')[0];

            // 🟢 STEP 4 — GET SHEET ID
            const sheetId = await getSheetIdByName(
              sheets,
              spreadsheetId,
              sheetName,
            );

            // 🟢 STEP 5 — PICK COLOR
            const color = wasEmpty
              ? { red: 146 / 255, green: 208 / 255, blue: 80 / 255 } // GREEN
              : { red: 1, green: 1, blue: 0 }; // YELLOW

            const grid = parseA1Range(range);

            // 🟢 STEP 6 — COLOR FULL ROW
            await sheets.spreadsheets.batchUpdate({
              spreadsheetId,
              requestBody: {
                requests: [
                  {
                    repeatCell: {
                      range: {
                        sheetId,
                        startRowIndex: grid.startRowIndex,
                        endRowIndex: grid.endRowIndex,
                      },
                      cell: {
                        userEnteredFormat: {
                          backgroundColor: color,
                        },
                      },
                      fields: 'userEnteredFormat.backgroundColor',
                    },
                  },
                ],
              },
            });

            //STEP 7 — UPDATE STATUS
            await updateStatus(
              sheets,
              spreadsheetId,
              sheetName,
              rowNumber,
              wasEmpty ? 'New' : 'Modified',
            );

            //return response.data;
            return {
              oldValue,
              newValue,
              rowNumber,
              status: wasEmpty ? 'New' : 'Modified',
            };
          },
        });

        break;
      }

      case 'append': {
        spreadsheetId = args[1];
        range = args[2];
        const dataRaw = args[3];

        if (!spreadsheetId || !range || !dataRaw)
          throw new Error(
            'Usage: append <spreadsheetId> <range> <jsonOr@file>',
          );

        const values = jsonFromArg(dataRaw, 'values');
        newValue = JSON.stringify(values);

        // result = await executeWithOptionalAudit({
        //   isMutation,
        //   command,
        //   spreadsheetId,
        //   range,
        //   newValue,
        //   execute: async () => {
        //     const response = await sheets.spreadsheets.values.append({
        //       spreadsheetId,
        //       range,
        //       valueInputOption: flags.input || 'USER_ENTERED',
        //       insertDataOption: flags.insert || 'INSERT_ROWS',
        //       requestBody: {
        //         values,
        //         majorDimension: flags.major,
        //       },
        //     });
        //     return response.data;
        //   },
        // });
        result = await executeWithOptionalAudit({
          isMutation,
          command,
          spreadsheetId,
          range,
          newValue,
          execute: async () => {
            const response = await sheets.spreadsheets.values.append({
              spreadsheetId,
              range,
              valueInputOption: flags.input || 'USER_ENTERED',
              insertDataOption: flags.insert || 'INSERT_ROWS',
              requestBody: {
                values,
                majorDimension: flags.major,
              },
            });

            //GET APPENDED ROW NUMBER
            const updatedRange = response.data.updates.updatedRange;
            // Example: Sheet1!A12:C12

            const match = updatedRange.match(/!(?:[A-Z]+)(\d+)/);
            const rowNumber = parseInt(match[1], 10);

            const sheetName = updatedRange.split('!')[0];

            const grid = parseA1Range(updatedRange);

            //FIND SHEET ID
            const sheetId = await getSheetIdByName(
              sheets,
              spreadsheetId,
              sheetName,
            );

            //COLOR FULL ROW GREEN
            await sheets.spreadsheets.batchUpdate({
              spreadsheetId,
              requestBody: {
                requests: [
                  {
                    repeatCell: {
                      range: {
                        sheetId,
                        startRowIndex: grid.startRowIndex,
                        endRowIndex: grid.endRowIndex,
                      },
                      cell: {
                        userEnteredFormat: {
                          backgroundColor: {
                            red: 146 / 255.0,
                            green: 208 / 255.0,
                            blue: 80 / 255.0,
                          },
                        },
                      },
                      fields: 'userEnteredFormat.backgroundColor',
                    },
                  },
                ],
              },
            });

            //UPDATE STATUS
            await updateStatus(
              sheets,
              spreadsheetId,
              sheetName,
              rowNumber,
              'New',
            );

            return response.data;
          },
        });
        break;
      }

      case 'clear': {
        spreadsheetId = args[1];
        range = args[2];

        if (!spreadsheetId || !range)
          throw new Error('Usage: clear <spreadsheetId> <range>');

        result = await executeWithOptionalAudit({
          isMutation,
          command,
          spreadsheetId,
          range,
          newValue: '',
          execute: async () => {
            const response = await sheets.spreadsheets.values.clear({
              spreadsheetId,
              range,
            });
            return response.data;
          },
        });
        break;
      }

      case 'batchGet': {
        const spreadsheetId = args[1];
        const rangeArgs = args.slice(2);
        if (!spreadsheetId || rangeArgs.length === 0)
          throw new Error(
            'Usage: batchGet <spreadsheetId> <range1,range2,...>',
          );
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
        result = response.data;
        break;
      }

      case 'batchWrite': {
        const [, spreadsheetId, dataRaw] = args;
        if (!spreadsheetId || !dataRaw)
          throw new Error('Usage: batchWrite <spreadsheetId> <jsonOr@file>');
        const body = jsonFromArg(dataRaw, 'batchUpdate');

        result = await executeWithAuditForBatch({
          command: 'batchWrite',
          spreadsheetId,
          requestsRaw: body,
          execute: () =>
            sheets.spreadsheets.values.batchUpdate({
              spreadsheetId,
              requestBody: body,
            }),
        });
        break;
      }

      case 'create': {
        const [, title] = args;
        if (!title) throw new Error('Usage: create <title>');
        const response = await sheets.spreadsheets.create({
          requestBody: { properties: { title } },
        });
        result = response.data;
        break;
      }

      case 'info': {
        const [, spreadsheetId] = args;
        if (!spreadsheetId) throw new Error('Usage: info <spreadsheetId>');
        const response = await sheets.spreadsheets.get({ spreadsheetId });
        result = response.data;
        break;
      }

      case 'format': {
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

        const { userEnteredFormat, fields } =
          buildUserEnteredFormat(formatOptions);
        if (!fields.length) throw new Error('No format fields provided.');

        result = await executeWithAuditForBatch({
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
        break;
      }

      case 'getFormat': {
        const [, spreadsheetId, range] = args;
        if (!spreadsheetId || !range)
          throw new Error('Usage: getFormat <spreadsheetId> <range>');
        const response = await sheets.spreadsheets.get({
          spreadsheetId,
          ranges: [range],
          includeGridData: true,
        });
        result = response.data;
        break;
      }

      case 'borders': {
        const [, spreadsheetId, range, styleRaw] = args;
        if (!spreadsheetId || !range)
          throw new Error(
            'Usage: borders <spreadsheetId> <range> [styleJsonOr@file]',
          );
        const style = styleRaw
          ? jsonFromArg(styleRaw, 'borderStyle')
          : { style: 'SOLID', color: { red: 0, green: 0, blue: 0 } };
        const grid = parseA1Range(range);
        const sheetId = grid.sheetName
          ? await getSheetIdByName(sheets, spreadsheetId, grid.sheetName)
          : await getDefaultSheetId(sheets, spreadsheetId);

        const response = await sheets.spreadsheets.batchUpdate({
          spreadsheetId,
          requestBody: {
            requests: [
              {
                updateBorders: {
                  range: { ...grid, sheetId },
                  top: style,
                  bottom: style,
                  left: style,
                  right: style,
                  innerHorizontal: style,
                  innerVertical: style,
                },
              },
            ],
          },
        });
        result = { updated: true, replies: response.data.replies };
        break;
      }

      case 'batch': {
        const [, spreadsheetId, requestsRaw] = args;
        if (!spreadsheetId || !requestsRaw)
          throw new Error('Usage: batch <spreadsheetId> <requestsJsonOr@file>');
        const payload = jsonFromArg(requestsRaw, 'requests');
        const requestBody = Array.isArray(payload)
          ? { requests: payload }
          : payload;

        result = await executeWithAuditForBatch({
          command: 'batch',
          spreadsheetId,
          requestsRaw: payload,
          execute: () =>
            sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody }),
        });
        break;
      }

      case 'unmerge': {
        const [, spreadsheetId, range] = args;
        if (!spreadsheetId || !range)
          throw new Error('Usage: unmerge <spreadsheetId> <range>');
        const grid = parseA1Range(range);
        const sheetId = grid.sheetName
          ? await getSheetIdByName(sheets, spreadsheetId, grid.sheetName)
          : await getDefaultSheetId(sheets, spreadsheetId);

        const response = await sheets.spreadsheets.batchUpdate({
          spreadsheetId,
          requestBody: {
            requests: [
              {
                unmergeCells: {
                  range: { ...grid, sheetId },
                },
              },
            ],
          },
        });
        result = { unmerged: true, replies: response.data.replies };
        break;
      }

      case 'resize': {
        const [, spreadsheetId, sheetName, dimension, start, end, size] = args;
        if (
          !spreadsheetId ||
          !sheetName ||
          !dimension ||
          !start ||
          !end ||
          !size
        ) {
          throw new Error(
            'Usage: resize <spreadsheetId> <sheetName> <cols|rows> <start> <end> <px>',
          );
        }
        const sheetId = await getSheetIdByName(
          sheets,
          spreadsheetId,
          sheetName,
        );
        const isCols = dimension === 'cols';
        const range = isCols
          ? {
              dimension: 'COLUMNS',
              startIndex: colToIndex(start),
              endIndex: colToIndex(end) + 1,
            }
          : {
              dimension: 'ROWS',
              startIndex: parseInt(start, 10) - 1,
              endIndex: parseInt(end, 10),
            };

        const response = await sheets.spreadsheets.batchUpdate({
          spreadsheetId,
          requestBody: {
            requests: [
              {
                updateDimensionProperties: {
                  range: { sheetId, ...range },
                  properties: { pixelSize: parseInt(size, 10) },
                  fields: 'pixelSize',
                },
              },
            ],
          },
        });
        result = { resized: true, replies: response.data.replies };
        break;
      }

      case 'autoResize': {
        const [, spreadsheetId, sheetName, startCol, endCol] = args;
        if (!spreadsheetId || !sheetName || !startCol || !endCol) {
          throw new Error(
            'Usage: autoResize <spreadsheetId> <sheetName> <startCol> <endCol>',
          );
        }
        const sheetId = await getSheetIdByName(
          sheets,
          spreadsheetId,
          sheetName,
        );
        const response = await sheets.spreadsheets.batchUpdate({
          spreadsheetId,
          requestBody: {
            requests: [
              {
                autoResizeDimensions: {
                  dimensions: {
                    sheetId,
                    dimension: 'COLUMNS',
                    startIndex: colToIndex(startCol),
                    endIndex: colToIndex(endCol) + 1,
                  },
                },
              },
            ],
          },
        });
        result = { autoResized: true, replies: response.data.replies };
        break;
      }

      case 'freeze': {
        const [, spreadsheetId, sheetName, rowsRaw, colsRaw] = args;
        if (!spreadsheetId || !sheetName)
          throw new Error(
            'Usage: freeze <spreadsheetId> <sheetName> [rows] [cols]',
          );
        const sheetId = await getSheetIdByName(
          sheets,
          spreadsheetId,
          sheetName,
        );
        const frozenRowCount =
          rowsRaw !== undefined ? parseInt(rowsRaw, 10) : undefined;
        const frozenColumnCount =
          colsRaw !== undefined ? parseInt(colsRaw, 10) : undefined;
        const gridProperties = {};
        const fields = [];
        if (frozenRowCount !== undefined) {
          gridProperties.frozenRowCount = frozenRowCount;
          fields.push('gridProperties.frozenRowCount');
        }
        if (frozenColumnCount !== undefined) {
          gridProperties.frozenColumnCount = frozenColumnCount;
          fields.push('gridProperties.frozenColumnCount');
        }
        const response = await sheets.spreadsheets.batchUpdate({
          spreadsheetId,
          requestBody: {
            requests: [
              {
                updateSheetProperties: {
                  properties: { sheetId, gridProperties },
                  fields: fields.join(','),
                },
              },
            ],
          },
        });
        result = { frozen: true, replies: response.data.replies };
        break;
      }

      case 'addSheet': {
        const [, spreadsheetId, title] = args;
        if (!spreadsheetId || !title)
          throw new Error('Usage: addSheet <spreadsheetId> <title>');
        const response = await sheets.spreadsheets.batchUpdate({
          spreadsheetId,
          requestBody: { requests: [{ addSheet: { properties: { title } } }] },
        });
        result = response.data;
        break;
      }

      case 'deleteSheet': {
        const [, spreadsheetId, sheetName] = args;
        if (!spreadsheetId || !sheetName)
          throw new Error('Usage: deleteSheet <spreadsheetId> <sheetName>');
        const sheetId = await getSheetIdByName(
          sheets,
          spreadsheetId,
          sheetName,
        );
        const response = await sheets.spreadsheets.batchUpdate({
          spreadsheetId,
          requestBody: { requests: [{ deleteSheet: { sheetId } }] },
        });
        result = response.data;
        break;
      }

      case 'renameSheet': {
        const [, spreadsheetId, oldName, newName] = args;
        if (!spreadsheetId || !oldName || !newName)
          throw new Error(
            'Usage: renameSheet <spreadsheetId> <oldName> <newName>',
          );
        const sheetId = await getSheetIdByName(sheets, spreadsheetId, oldName);
        const response = await sheets.spreadsheets.batchUpdate({
          spreadsheetId,
          requestBody: {
            requests: [
              {
                updateSheetProperties: {
                  properties: { sheetId, title: newName },
                  fields: 'title',
                },
              },
            ],
          },
        });
        result = response.data;
        break;
      }

      case 'copyFormat': {
        const [, spreadsheetId, sourceRange, destRange] = args;
        if (!spreadsheetId || !sourceRange || !destRange)
          throw new Error(
            'Usage: copyFormat <spreadsheetId> <sourceRange> <destRange>',
          );
        const sourceGrid = parseA1Range(sourceRange);
        const destGrid = parseA1Range(destRange);
        const sourceSheetId = sourceGrid.sheetName
          ? await getSheetIdByName(sheets, spreadsheetId, sourceGrid.sheetName)
          : await getDefaultSheetId(sheets, spreadsheetId);
        const destSheetId = destGrid.sheetName
          ? await getSheetIdByName(sheets, spreadsheetId, destGrid.sheetName)
          : await getDefaultSheetId(sheets, spreadsheetId);

        const response = await sheets.spreadsheets.batchUpdate({
          spreadsheetId,
          requestBody: {
            requests: [
              {
                copyPaste: {
                  source: { ...sourceGrid, sheetId: sourceSheetId },
                  destination: { ...destGrid, sheetId: destSheetId },
                  pasteType: 'PASTE_FORMAT',
                },
              },
            ],
          },
        });
        result = { copied: true, replies: response.data.replies };
        break;
      }

      case 'batch': {
        const [, spreadsheetId, requestsRaw] = args;
        if (!spreadsheetId || !requestsRaw)
          throw new Error('Usage: batch <spreadsheetId> <requestsJsonOr@file>');
        const payload = jsonFromArg(requestsRaw, 'requests');
        const requestBody = Array.isArray(payload)
          ? { requests: payload }
          : payload;
        const response = await sheets.spreadsheets.batchUpdate({
          spreadsheetId,
          requestBody,
        });
        result = response.data;
        break;
      }

      default:
        throw new Error(`Unknown command: ${command}`);
    }

    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Error:', error.message);
    if (error.response?.data?.error) {
      console.error(JSON.stringify(error.response.data.error, null, 2));
    }
    process.exit(1);
  }
}

main();
