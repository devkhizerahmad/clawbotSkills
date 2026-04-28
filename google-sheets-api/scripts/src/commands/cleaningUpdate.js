'use strict';

const {
  CLEANING_SPREADSHEET_ID,
  CLEANING_SHEET_NAME,
  CLEANING_DATE_COLUMN,
} = require('../config');
const { write } = require('./write');
const { jsonFromArg } = require('../utils/jsonFromArg');
const { indexToCol } = require('../utils/indexToCol');

function getField(payload, names) {
  for (const name of names) {
    if (payload[name] !== undefined && payload[name] !== null && payload[name] !== '') {
      return payload[name];
    }
  }
  return '';
}

function normalizeBoolean(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return ['true', '1', 'yes', 'y'].includes(normalized);
  }
  return false;
}

function buildCellValue(value) {
  return JSON.stringify([[value]]);
}

function findColumnIndex(headers, matchers) {
  return headers.findIndex((header) => {
    const normalized = String(header || '').trim().toLowerCase();
    return matchers.some((matcher) => matcher(normalized));
  });
}

function buildFollowUpQuestion({ missingFields, hasPartialAdvancedData, hasStandardRange }) {
  if (hasPartialAdvancedData && missingFields.length > 0) {
    return `The advanced cleaning flow is missing these fields: ${missingFields.join(', ')}. If you want to use the standard flow, please also provide a range such as "Cleaning!X10".`;
  }

  if (!hasStandardRange) {
    return 'The input is still ambiguous. Please either provide the complete fields: who, contact, building/location, cleaningDate; or provide the exact range for the standard flow, such as "Cleaning!X10".';
  }

  return 'A little more detail is needed for the cleaning update. Please provide the missing fields or the exact target range.';
}

async function runWriteFlow({ sheets, spreadsheetId, range, value, flags, command, isMutation }) {
  return write({
    sheets,
    args: ['write', spreadsheetId, range, buildCellValue(value)],
    flags,
    command,
    isMutation,
  });
}

async function cleaningUpdate({ sheets, args, flags, command, isMutation }) {
  const commandArgs = args.slice(1);
  let spreadsheetId = CLEANING_SPREADSHEET_ID;
  let payloadArg = commandArgs[0];

  if (
    commandArgs[0] &&
    commandArgs[0].length > 20 &&
    !commandArgs[0].includes(' ') &&
    commandArgs[1]
  ) {
    spreadsheetId = commandArgs[0];
    payloadArg = commandArgs[1];
  }

  if (!payloadArg) {
    throw new Error('Usage: cleaning-update [spreadsheetId] <jsonOr@file>');
  }

  const payload = jsonFromArg(payloadArg, 'cleaningUpdate payload');

  const who = getField(payload, ['who', 'personResponsible', 'person', 'name']);
  const contact = getField(payload, [
    'contact',
    'contactInformation',
    'contactInfo',
    'contacts',
    'email',
    'phone',
  ]);
  const building = getField(payload, [
    'building',
    'location',
    'buildingLocation',
    'apartment',
    'apt',
    'unit',
  ]);
  const cleaningDate = getField(payload, [
    'cleaningDate',
    'cleaning_date',
    'date',
    'value',
  ]);
  const range = getField(payload, ['range', 'cell', 'a1']);
  const isMoveout = normalizeBoolean(
    getField(payload, ['moveout', 'isMoveout', 'moveOut']),
  );

  const advancedFields = [
    { key: 'who', value: who },
    { key: 'contact', value: contact },
    { key: 'building/location', value: building },
    { key: 'cleaningDate', value: cleaningDate },
  ];

  const filledAdvancedFields = advancedFields.filter((field) => field.value);
  const missingAdvancedFields = advancedFields
    .filter((field) => !field.value)
    .map((field) => field.key);

  const hasPartialAdvancedData =
    filledAdvancedFields.length > 0 &&
    filledAdvancedFields.length < advancedFields.length;
  const hasCompleteAdvancedData =
    filledAdvancedFields.length === advancedFields.length;
  const hasStandardRange = !!range;

  if (!hasCompleteAdvancedData) {
    if (hasStandardRange && cleaningDate) {
      const result = await runWriteFlow({
        sheets,
        spreadsheetId,
        range,
        value: cleaningDate,
        flags: {
          ...flags,
          ...(isMoveout ? { moveout: true } : {}),
        },
        command,
        isMutation,
      });

      return {
        success: true,
        flow: 'standard',
        spreadsheetId,
        range,
        cleaningDate,
        result,
      };
    }

    const question = buildFollowUpQuestion({
      missingFields: missingAdvancedFields,
      hasPartialAdvancedData,
      hasStandardRange,
    });

    return {
      success: false,
      flow: 'clarification-required',
      followUpRequired: true,
      missingFields: missingAdvancedFields,
      question,
    };
  }

  const headerRes = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${CLEANING_SHEET_NAME}!1:1`,
  });
  const headers = headerRes.data.values?.[0] || [];

  const whoColumnIndex = findColumnIndex(headers, [
    (header) => header === 'who',
    (header) => header.includes('who'),
  ]);
  const contactColumnIndex = findColumnIndex(headers, [
    (header) => header.includes('contact') && !header.includes('room'),
  ]);
  const buildingColumnIndex = findColumnIndex(headers, [
    (header) => header.includes('building'),
    (header) => header.includes('location'),
    (header) => header === 'apt',
    (header) => header.includes('apartment'),
    (header) => header.includes('unit'),
  ]);

  if (whoColumnIndex === -1 || contactColumnIndex === -1) {
    throw new Error(
      'Could not resolve the "Who" or "Contact" column from the Cleaning sheet headers.',
    );
  }

  const effectiveBuildingColumnIndex =
    buildingColumnIndex === -1 ? 2 : buildingColumnIndex;

  const dataRes = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${CLEANING_SHEET_NAME}!A:AK`,
  });
  const rows = dataRes.data.values || [];
  const buildingNeedle = String(building).trim().toLowerCase();

  const matches = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] || [];
    const buildingCell = String(row[effectiveBuildingColumnIndex] || '')
      .trim()
      .toLowerCase();
    const rowText = row.join(' ').toLowerCase();

    if (
      (buildingCell && buildingCell.includes(buildingNeedle)) ||
      rowText.includes(buildingNeedle)
    ) {
      matches.push({
        rowNumber: i + 1,
        preview: row.slice(0, 6),
      });
    }
  }

  if (matches.length === 0) {
    return {
      success: false,
      flow: 'clarification-required',
      followUpRequired: true,
      question: `No matching row was found in the Cleaning sheet for "${building}". Please provide a more specific building/location value or share the exact range.`,
    };
  }

  if (matches.length > 1) {
    return {
      success: false,
      flow: 'clarification-required',
      followUpRequired: true,
      matches: matches.slice(0, 5),
      question: `Multiple rows were found for "${building}". Please confirm the exact building/location or range so the correct row can be updated.`,
    };
  }

  const targetRow = matches[0].rowNumber;
  const whoRange = `${CLEANING_SHEET_NAME}!${indexToCol(whoColumnIndex)}${targetRow}`;
  const contactRange = `${CLEANING_SHEET_NAME}!${indexToCol(contactColumnIndex)}${targetRow}`;
  const dateRange = `${CLEANING_SHEET_NAME}!${CLEANING_DATE_COLUMN}${targetRow}`;

  const whoResult = await runWriteFlow({
    sheets,
    spreadsheetId,
    range: whoRange,
    value: who,
    flags,
    command,
    isMutation,
  });

  const contactResult = await runWriteFlow({
    sheets,
    spreadsheetId,
    range: contactRange,
    value: contact,
    flags,
    command,
    isMutation,
  });

  const dateResult = await runWriteFlow({
    sheets,
    spreadsheetId,
    range: dateRange,
    value: cleaningDate,
    flags: {
      ...flags,
      ...(isMoveout ? { moveout: true } : {}),
    },
    command,
    isMutation,
  });

  return {
    success: true,
    flow: 'advanced',
    spreadsheetId,
    rowNumber: targetRow,
    mappedRanges: {
      who: whoRange,
      contact: contactRange,
      cleaningDate: dateRange,
    },
    results: {
      who: whoResult,
      contact: contactResult,
      cleaningDate: dateResult,
    },
  };
}

module.exports = { cleaningUpdate };
