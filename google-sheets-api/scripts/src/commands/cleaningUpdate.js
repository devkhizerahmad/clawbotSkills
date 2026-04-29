'use strict';

const {
  CLEANING_SPREADSHEET_ID,
  CLEANING_SHEET_NAME,
  CLEANING_DATE_COLUMN,
} = require('../config');
const { write } = require('./write');
const { jsonFromArg } = require('../utils/jsonFromArg');
const { indexToCol } = require('../utils/indexToCol');
const { cleaningCache } = require('../utils/cleaningCache');
const { tenantMapping } = require('../utils/tenantMapping');

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

function normalizeCell(value) {
  return String(value || '').trim().toLowerCase();
}

function rowMatchesIdentifier({ row, identifiers, indexes }) {
  if (identifiers.who) {
    const whoCell = normalizeCell(row[indexes.whoColumnIndex]);
    if (!whoCell.includes(identifiers.who)) {
      return false;
    }
  }

  if (identifiers.contact) {
    const contactCell = normalizeCell(row[indexes.contactColumnIndex]);
    if (!contactCell.includes(identifiers.contact)) {
      return false;
    }
  }

  if (identifiers.building) {
    const buildingCell = normalizeCell(row[indexes.buildingColumnIndex]);
    const rowText = row.map(normalizeCell).join(' ');
    if (!buildingCell.includes(identifiers.building) && !rowText.includes(identifiers.building)) {
      return false;
    }
  }

  return true;
}

function findMatchingRows({ rows, identifiers, indexes, fromCache }) {
  // Use indexed lookup if data came from cache (instant O(1) lookup)
  if (fromCache && cleaningCache.indexes) {
    return cleaningCache.findMatches(identifiers);
  }

  // Fall back to linear search for non-cached data or fallback logic
  const matches = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] || [];
    if (rowMatchesIdentifier({ row, identifiers, indexes })) {
      matches.push({
        rowNumber: i + 1,
        preview: row.slice(0, 6),
      });
    }
  }

  return matches;
}

async function getCleaningSheetContext({ sheets, spreadsheetId }) {
  // Check cache first
  const cached = cleaningCache.get();
  if (cached) {
    return {
      headers: cached.headers,
      rows: cached.rows,
      indexes: cached.indexes.columnIndexes,
      fromCache: true,
    };
  }

  // Cache miss - fetch from API
  const headerRes = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${CLEANING_SHEET_NAME}!1:1`,
  });
  const headers = headerRes.data.values?.[0] || [];

  const dataRes = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${CLEANING_SHEET_NAME}!A:AK`,
  });

  const data = {
    headers,
    rows: dataRes.data.values || [],
  };

  // Store in cache (this also builds the indexes)
  cleaningCache.set(data);

  // Return the indexes that were built
  const indexes = cleaningCache.indexes.columnIndexes;

  if (indexes.whoColumnIndex === -1 || indexes.contactColumnIndex === -1) {
    throw new Error(
      'Could not resolve the "Who" or "Contact" column from the Cleaning sheet headers.',
    );
  }

  // Update tenant mapping in background (non-blocking)
  // This ensures current logic continues without interruption
  updateTenantMappingInBackground(data, indexes);

  return {
    headers,
    rows: data.rows,
    indexes,
    fromCache: false,
  };
}

/**
 * Update tenant mapping in background (non-blocking)
 * This builds direct row mappings for instant lookups
 */
function updateTenantMappingInBackground(data, indexes) {
  setImmediate(async () => {
    try {
      // Try loading from disk first
      await tenantMapping.load();

      // Build new mapping from fresh data
      tenantMapping.build(data, indexes);

      // Save to disk for persistence
      await tenantMapping.save();

      console.log('Tenant mapping updated successfully');
    } catch (error) {
      console.error('Failed to update tenant mapping (non-blocking):', error.message);
      // Don't throw - this is background optimization
    }
  });
}

/**
 * Try to find row using tenant mapping (fastest - O(1))
 * @returns {Object|null} Found data or null
 */
function tryFindWithMapping(identifiers) {
  try {
    // Check if mapping is valid and fresh
    if (!tenantMapping.isValid()) {
      return null;
    }

    // Check for multiple matches
    if (tenantMapping.hasMultipleMatches(identifiers)) {
      return { multipleMatches: true, matches: tenantMapping.getAllMatches(identifiers) };
    }

    // Get direct range
    const range = tenantMapping.getRange(identifiers);
    if (range) {
      return { found: true, range };
    }

    return null;
  } catch (error) {
    // If mapping fails, fall back to cache
    return null;
  }
}

function buildFollowUpQuestion({
  missingFields,
  hasPartialAdvancedData,
  hasIdentifierLookupData,
}) {
  if (hasPartialAdvancedData && missingFields.length > 0) {
    return `The advanced cleaning flow is missing these fields: ${missingFields.join(', ')}. If you do not have all advanced fields, please provide cleaningDate with at least one of who, contact/email, or building/location so I can resolve the row from the Cleaning sheet.`;
  }

  if (hasIdentifierLookupData) {
    return 'I can search the Cleaning sheet by who, contact/email, or building/location, but I still need cleaningDate to perform the update.';
  }

  return 'A little more detail is needed for the cleaning update. Please either provide complete advanced fields, or provide cleaningDate with at least one of who, contact/email, or building/location.';
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
  const hasIdentifierLookupData = !!(who || contact || building);

  if (!hasCompleteAdvancedData) {
    if (cleaningDate && hasIdentifierLookupData) {
      const identifiers = {
        who: normalizeCell(who),
        contact: normalizeCell(contact),
        building: normalizeCell(building),
      };

      // NEW: Try tenant mapping first (fastest - O(1))
      const mappingResult = tryFindWithMapping(identifiers);

      if (mappingResult) {
        if (mappingResult.multipleMatches) {
          return {
            success: false,
            flow: 'clarification-required',
            followUpRequired: true,
            matches: mappingResult.matches.slice(0, 5),
            question: 'Multiple rows matched the provided who/contact/building details. Please provide one more identifier so the correct row can be updated.',
          };
        }

        if (mappingResult.found && mappingResult.range) {
          const { range } = mappingResult;
          const dateResult = await runWriteFlow({
            sheets,
            spreadsheetId,
            range: range.cleaningDate,
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
            flow: 'mapping', // New flow name
            spreadsheetId,
            rowNumber: range.rowNumber,
            mappedRanges: {
              cleaningDate: range.cleaningDate,
            },
            lookup: {
              who: range.who,
              contact: range.contact,
            },
            results: {
              cleaningDate: dateResult,
            },
          };
        }
      }

      // FALLBACK: Use cache + index (fast - O(1) with cache)
      const { rows, indexes, fromCache } = await getCleaningSheetContext({ sheets, spreadsheetId });
      const matches = findMatchingRows({
        rows,
        identifiers,
        indexes,
        fromCache,
      });

      if (matches.length === 0) {
        return {
          success: false,
          flow: 'clarification-required',
          followUpRequired: true,
          question: 'No matching row was found in the Cleaning sheet from the provided who/contact/building details. Please provide a more specific value.',
        };
      }

      if (matches.length > 1) {
        return {
          success: false,
          flow: 'clarification-required',
          followUpRequired: true,
          matches: matches.slice(0, 5),
          question: 'Multiple rows matched the provided who/contact/building details. Please provide one more identifier so the correct row can be updated.',
        };
      }

      const targetRow = matches[0].rowNumber;
      const resolvedPayload = {
        ...payload,
        rowNumber: targetRow,
        row: targetRow,
        whoColumnNumber: indexes.whoColumnIndex + 1,
        contactColumnNumber: indexes.contactColumnIndex + 1,
        buildingColumnNumber: indexes.buildingColumnIndex + 1,
        whoRange: `${CLEANING_SHEET_NAME}!${indexToCol(indexes.whoColumnIndex)}${targetRow}`,
        contactRange: `${CLEANING_SHEET_NAME}!${indexToCol(indexes.contactColumnIndex)}${targetRow}`,
        cleaningDateRange: `${CLEANING_SHEET_NAME}!${CLEANING_DATE_COLUMN}${targetRow}`,
      };

      const dateResult = await runWriteFlow({
        sheets,
        spreadsheetId,
        range: resolvedPayload.cleaningDateRange,
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
        flow: 'lookup',
        spreadsheetId,
        payload: resolvedPayload,
        rowNumber: targetRow,
        mappedRanges: {
          cleaningDate: resolvedPayload.cleaningDateRange,
        },
        lookup: {
          who: resolvedPayload.whoRange,
          contact: resolvedPayload.contactRange,
        },
        results: {
          cleaningDate: dateResult,
        },
      };
    }

    const question = buildFollowUpQuestion({
      missingFields: missingAdvancedFields,
      hasPartialAdvancedData,
      hasIdentifierLookupData,
    });

    return {
      success: false,
      flow: 'clarification-required',
      followUpRequired: true,
      missingFields: missingAdvancedFields,
      question,
    };
  }

  // Advanced flow (complete data provided)
  const { rows, indexes, fromCache } = await getCleaningSheetContext({ sheets, spreadsheetId });
  const matches = findMatchingRows({
    rows,
    identifiers: {
      who: normalizeCell(who),
      contact: normalizeCell(contact),
      building: normalizeCell(building),
    },
    indexes,
    fromCache,
  });

  if (matches.length === 0) {
    return {
      success: false,
      flow: 'clarification-required',
      followUpRequired: true,
      question: `No matching row was found in the Cleaning sheet for who="${who}", contact="${contact}", building="${building}". Please provide more specific details.`,
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
  const whoRange = `${CLEANING_SHEET_NAME}!${indexToCol(indexes.whoColumnIndex)}${targetRow}`;
  const contactRange = `${CLEANING_SHEET_NAME}!${indexToCol(indexes.contactColumnIndex)}${targetRow}`;
  const dateRange = `${CLEANING_SHEET_NAME}!${CLEANING_DATE_COLUMN}${targetRow}`;

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
      cleaningDate: dateRange,
    },
    lookup: {
      who: whoRange,
      contact: contactRange,
    },
    results: {
      cleaningDate: dateResult,
    },
  };
}

module.exports = { cleaningUpdate };
