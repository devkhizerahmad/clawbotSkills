// src/utils/sheets.js

function colToIndex(col) {
  let index = 0;
  const letters = col.toUpperCase();
  for (let i = 0; i < letters.length; i++) {
    index = index * 26 + (letters.charCodeAt(i) - 64);
  }
  return index - 1;
}

function indexToCol(index) {
  let col = '';
  let i = index;
  while (i >= 0) {
    col = String.fromCharCode((i % 26) + 65) + col;
    i = Math.floor(i / 26) - 1;
  }
  return col;
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
  const entry = response.data.sheets.find((s) => s.properties?.title === sheetName);
  if (!entry) throw new Error(`Sheet not found: ${sheetName}`);
  return entry.properties.sheetId;
}

async function getDefaultSheetId(sheets, spreadsheetId) {
  const response = await sheets.spreadsheets.get({ spreadsheetId });
  const entry = response.data.sheets[0];
  if (!entry) throw new Error('Spreadsheet has no sheets.');
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
    if (tf.bold !== undefined) { userEnteredFormat.textFormat.bold = tf.bold; fields.push('userEnteredFormat.textFormat.bold'); }
    if (tf.italic !== undefined) { userEnteredFormat.textFormat.italic = tf.italic; fields.push('userEnteredFormat.textFormat.italic'); }
    if (tf.underline !== undefined) { userEnteredFormat.textFormat.underline = tf.underline; fields.push('userEnteredFormat.textFormat.underline'); }
    if (tf.strikethrough !== undefined) { userEnteredFormat.textFormat.strikethrough = tf.strikethrough; fields.push('userEnteredFormat.textFormat.strikethrough'); }
    if (tf.fontSize !== undefined) { userEnteredFormat.textFormat.fontSize = tf.fontSize; fields.push('userEnteredFormat.textFormat.fontSize'); }
    if (tf.fontFamily) { userEnteredFormat.textFormat.fontFamily = tf.fontFamily; fields.push('userEnteredFormat.textFormat.fontFamily'); }
    if (tf.foregroundColor) { userEnteredFormat.textFormat.foregroundColor = normalizeColor(tf.foregroundColor); fields.push('userEnteredFormat.textFormat.foregroundColor'); }
  }

  if (options.horizontalAlignment) {
    userEnteredFormat.horizontalAlignment = options.horizontalAlignment.toUpperCase();
    fields.push('userEnteredFormat.horizontalAlignment');
  }
  if (options.verticalAlignment) {
    userEnteredFormat.verticalAlignment = options.verticalAlignment.toUpperCase();
    fields.push('userEnteredFormat.verticalAlignment');
  }
  if (options.wrapStrategy) {
    userEnteredFormat.wrapStrategy = options.wrapStrategy.toUpperCase();
    fields.push('userEnteredFormat.wrapStrategy');
  }
  if (options.numberFormat) {
    userEnteredFormat.numberFormat = { type: options.numberFormat.type, pattern: options.numberFormat.pattern };
    fields.push('userEnteredFormat.numberFormat');
  }

  return { userEnteredFormat, fields };
}

async function updateStatus(sheets, spreadsheetId, sheetName, rowNumber, statusValue) {
  try {
    const headerRes = await sheets.spreadsheets.values.get({ spreadsheetId, range: `${sheetName}!1:1` });
    const headerRow = headerRes.data.values?.[0] || [];
    const statusIndex = headerRow.findIndex((h) => h?.toLowerCase().trim() === 'status');

    if (statusIndex === -1) return;

    const statusColumnLetter = indexToCol(statusIndex);
    const statusCell = `${sheetName}!${statusColumnLetter}${rowNumber}`;

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: statusCell,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [[statusValue]] },
    });
  } catch (error) {
    console.error('Error updating status:', error.message);
  }
}

function toRanges(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return value.split(',').map((range) => range.trim()).filter(Boolean);
}

module.exports = {
  colToIndex,
  indexToCol,
  parseA1Range,
  getSheetIdByName,
  getDefaultSheetId,
  normalizeColor,
  buildUserEnteredFormat,
  updateStatus,
  toRanges,
};