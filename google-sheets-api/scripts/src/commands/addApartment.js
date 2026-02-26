'use strict';

const {
  fetchApartmentByName,
} = require('../services/apartments/fetchApartment');
const { INVENTORY_SPREADSHEET_ID } = require('../config');
const { parseA1Range } = require('../utils/parseA1Range');
const { getSheetIdByName } = require('../services/sheets/getSheetIdByName');

const INVENTORY_DATA_HEADERS = [
  '#',
  'Apt ',
  'Room Type',
  'Who',
  ' Total Rent ',
  ' Amentities ',
  ' Gym ',
  ' Laundry in Building ',
  ' In Unit ',
  ' Elevator ',
  ' Doorman ',
];

const RENT_TRACKER_HEADERS = [
  '#',
  'Apt ',
  'Room',
  'Who',
  ' Rent Amount Due ',
  'Paid (Y/N)',
  ' Email ',
  ' Phone Number ',
  'Comments',
];

const HEADER_COLOR = {
  red: 218 / 255,
  green: 242 / 255,
  blue: 208 / 255,
}; // #daf2d0

function getNumericRoom(name) {
  if (typeof name === 'number') return name;
  const match = name.toString().match(/\d+/);
  return match ? parseInt(match[0], 10) : name;
}

/**
 * Finds apartment rows in a sheet data array.
 */
function findApartmentRows(rows, colIdx, apartmentName) {
  const apartmentLower = apartmentName.toLowerCase().trim();
  const matches = [];
  for (let i = 0; i < rows.length; i++) {
    const val =
      rows[i] && rows[i][colIdx]
        ? rows[i][colIdx].toString().toLowerCase()
        : '';
    if (val.includes(apartmentLower)) {
      matches.push(i);
    }
  }
  return matches;
}

/**
 * Matches new rooms to existing rows to preserve data.
 */
function preserveRows(newRooms, existingRows, sheetName, apartment) {
  return newRooms.map((room) => {
    const numericRoom = getNumericRoom(room.name);
    // Find matching existing row by room name in Col C (index 2)
    const existingMatch = existingRows.find((row) => {
      const existingRoomVal = row[2];
      return getNumericRoom(existingRoomVal) === numericRoom;
    });

    if (existingMatch) {
      const updatedRow = [...existingMatch];
      if (sheetName === 'Inventory') {
        updatedRow[0] = `=HYPERLINK("${apartment.driveLink}", "${apartment.name}")`;
        updatedRow[2] = `=HYPERLINK("${room.driveLink}", "${room.name}")`;
      } else if (sheetName === 'Inventory Data') {
        updatedRow[1] = `=HYPERLINK("${apartment.driveLink}", "${apartment.name}")`;
        updatedRow[2] = `=HYPERLINK("${room.driveLink}", "${getNumericRoom(room.name)}")`;
      } else if (sheetName === 'Rent Tracker') {
        updatedRow[1] = `=HYPERLINK("${apartment.driveLink}", "${apartment.name}")`;
        updatedRow[2] = `=HYPERLINK("${room.driveLink}", "${getNumericRoom(room.name)}")`;
      }
      return updatedRow;
    } else {
      const colCount = sheetName === 'Inventory' ? 21 : 25;
      const newRow = new Array(colCount).fill('');
      if (sheetName === 'Inventory') {
        newRow[0] = `=HYPERLINK("${apartment.driveLink}", "${apartment.name}")`;
        newRow[2] = `=HYPERLINK("${room.driveLink}", "${room.name}")`;
        newRow[20] = 'Available';
      } else if (sheetName === 'Inventory Data') {
        newRow[1] = `=HYPERLINK("${apartment.driveLink}", "${apartment.name}")`;
        newRow[2] = `=HYPERLINK("${room.driveLink}", "${getNumericRoom(room.name)}")`;
      } else if (sheetName === 'Rent Tracker') {
        newRow[1] = `=HYPERLINK("${apartment.driveLink}", "${apartment.name}")`;
        newRow[2] = `=HYPERLINK("${room.driveLink}", "${getNumericRoom(room.name)}")`;
      }
      return newRow;
    }
  });
}

/**
 * Apply borders to a specific grid range
 */
async function applyBorders(
  sheets,
  spreadsheetId,
  sheetId,
  startRow,
  endRow,
  startCol,
  endCol,
) {
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          updateBorders: {
            range: {
              sheetId,
              startRowIndex: startRow,
              endRowIndex: endRow,
              startColumnIndex: startCol,
              endColumnIndex: endCol,
            },
            top: { style: 'SOLID' },
            bottom: { style: 'SOLID' },
            left: { style: 'SOLID' },
            right: { style: 'SOLID' },
            innerHorizontal: { style: 'SOLID' },
            innerVertical: { style: 'SOLID' },
          },
        },
      ],
    },
  });
}

async function addApartment({ sheets, args, flags }) {
  const apartmentName = args.slice(1).join(' ').trim();
  if (!apartmentName) {
    throw new Error('Please provide an apartment name.');
  }

  console.log(`Searching for "${apartmentName}" in Google Drive...`);
  const apartment = await fetchApartmentByName(apartmentName);

  if (!apartment) {
    throw new Error(
      `No apartment found in Drive with name matching "${apartmentName}"`,
    );
  }

  console.log(`Found apartment: ${apartment.name}`);
  const rooms = (apartment.roomTypes || []).sort((a, b) => {
    const numA = getNumericRoom(a.name);
    const numB = getNumericRoom(b.name);
    return (numA || 0) - (numB || 0);
  });

  const spreadsheetId = INVENTORY_SPREADSHEET_ID;

  // --- 1. Find Inventory Table Coordinates ---
  console.log('Detecting table coordinates...');
  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });

  let inventorySheetTitle = 'Inventory';
  let inventorySheetId = null;
  let inventoryTableStartRow = 0; // 0-indexed

  // Check Named Ranges
  const namedRanges = spreadsheet.data.namedRanges || [];
  const targetNamedRange = namedRanges.find(
    (nr) => nr.name === 'Unit_Availability_Details',
  );

  if (targetNamedRange) {
    const r = targetNamedRange.range;
    inventoryTableStartRow = r.startRowIndex || 0;
    inventorySheetId = r.sheetId;
    inventorySheetTitle =
      spreadsheet.data.sheets.find(
        (s) => s.properties.sheetId === inventorySheetId,
      )?.properties.title || 'Inventory';
    console.log(
      `Table found via named range on "${inventorySheetTitle}" starting at row ${inventoryTableStartRow + 1}`,
    );
  } else {
    // Fallback scanner: Find "Unit Cross Street"
    const scanRange = 'Inventory!A1:U50';
    const scanRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: scanRange,
    });
    const scanRows = scanRes.data.values || [];
    let foundIdx = -1;
    for (let i = 0; i < scanRows.length; i++) {
      const row = scanRows[i] || [];
      if (
        row.some(
          (cell) =>
            cell &&
            typeof cell === 'string' &&
            cell.toLowerCase().includes('unit cross street'),
        )
      ) {
        foundIdx = i;
        break;
      }
    }

    if (foundIdx !== -1) {
      inventoryTableStartRow = foundIdx;
      console.log(`Found headers at Row ${foundIdx + 1} via scanner.`);
    } else {
      console.warn('Could not detect headers. Defaulting to Row 1.');
    }
    inventorySheetId = await getSheetIdByName(
      sheets,
      spreadsheetId,
      'Inventory',
    );
    inventorySheetTitle = 'Inventory';
  }

  // --- Fetch Data Blocks ---
  console.log('Fetching current state of sheets...');
  const allRanges = [
    `${inventorySheetTitle}!A${inventoryTableStartRow + 1}:U500`,
    'Inventory Data!A:U',
    'Rent Tracker!A:U',
  ];
  const batchRes = await sheets.spreadsheets.values.batchGet({
    spreadsheetId,
    ranges: allRanges,
  });

  const inventoryRows = batchRes.data.valueRanges[0].values || [];
  const inventoryDataRows = batchRes.data.valueRanges[1].values || [];
  const rentTrackerRows = batchRes.data.valueRanges[2].values || [];

  // --- Update Inventory Table ---
  console.log(
    `Processing Inventory table on sheet "${inventorySheetTitle}"...`,
  );
  const inventoryMatches = findApartmentRows(inventoryRows, 0, apartment.name);

  if (inventoryMatches.length > 0) {
    // Update Logic
    if (inventoryMatches.length === rooms.length) {
      console.log(
        'Apartment already exists with correct room count. Skipping Inventory update.',
      );
    } else {
      console.log(
        `Updating apartment: changing room count from ${inventoryMatches.length} to ${rooms.length}...`,
      );
      const existingRows = inventoryMatches.map((idx) => inventoryRows[idx]);
      const updatedRows = preserveRows(
        rooms,
        existingRows,
        'Inventory',
        apartment,
      );

      const startIdx = inventoryTableStartRow + inventoryMatches[0];
      const endIdx =
        inventoryTableStartRow + inventoryMatches[inventoryMatches.length - 1];

      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              deleteDimension: {
                range: {
                  sheetId: inventorySheetId,
                  dimension: 'ROWS',
                  startIndex: startIdx,
                  endIndex: endIdx + 1,
                },
              },
            },
            {
              insertDimension: {
                range: {
                  sheetId: inventorySheetId,
                  dimension: 'ROWS',
                  startIndex: startIdx,
                  endIndex: startIdx + updatedRows.length,
                },
              },
            },
          ],
        },
      });
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${inventorySheetTitle}!A${startIdx + 1}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: updatedRows },
      });
      // Apply borders to updated area
      await applyBorders(
        sheets,
        spreadsheetId,
        inventorySheetId,
        startIdx,
        startIdx + updatedRows.length,
        0,
        21,
      );
    }
  } else {
    // Add Logic
    console.log('Searching for first available row in table...');
    let firstEmptyIdxInRows = -1;
    for (let i = 1; i < 500; i++) {
      const row = inventoryRows[i] || [];
      const valA = row[0] ? row[0].toString().trim() : '';
      if (valA === '') {
        firstEmptyIdxInRows = i;
        break;
      }
    }

    const newRows =
      rooms.length > 0
        ? rooms.map((room) => {
            const row = new Array(21).fill('');
            row[0] = `=HYPERLINK("${apartment.driveLink}", "${apartment.name}")`;
            row[2] = `=HYPERLINK("${room.driveLink}", "${room.name}")`;
            row[20] = 'Available';
            return row;
          })
        : [
            [
              `=HYPERLINK("${apartment.driveLink}", "${apartment.name}")`,
              '',
              '',
              '',
              '',
              '',
              '',
              '',
              '',
              '',
              '',
              '',
              '',
              '',
              '',
              '',
              '',
              '',
              '',
              '',
              'Available',
            ],
          ];

    if (firstEmptyIdxInRows !== -1) {
      const startRowOnSheet = inventoryTableStartRow + firstEmptyIdxInRows + 1;
      console.log(`Found empty row! Writing to Row ${startRowOnSheet}...`);
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${inventorySheetTitle}!A${startRowOnSheet}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: newRows },
      });
      // Apply borders to new area
      await applyBorders(
        sheets,
        spreadsheetId,
        inventorySheetId,
        startRowOnSheet - 1,
        startRowOnSheet - 1 + newRows.length,
        0,
        21,
      );
    } else {
      console.log('No empty rows found. Appending to bottom...');
      const appendRes = await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `${inventorySheetTitle}!A${inventoryTableStartRow + 1}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: newRows },
      });
      const grid = parseA1Range(appendRes.data.updates.updatedRange);
      await applyBorders(
        sheets,
        spreadsheetId,
        inventorySheetId,
        grid.startRowIndex,
        grid.endRowIndex,
        0,
        21,
      );
    }
  }

  // --- Block Based Helpers ---
  const applyBlockFormatting = async (
    sheetName,
    sheetId,
    startRowIdx,
    endRowIdx,
    colCount,
  ) => {
    const requests = [
      {
        repeatCell: {
          range: {
            sheetId,
            startRowIndex: startRowIdx + 1,
            endRowIndex: endRowIdx,
            startColumnIndex: 0,
            endColumnIndex: colCount,
          },
          cell: {
            userEnteredFormat: {
              horizontalAlignment: 'CENTER',
              verticalAlignment: 'MIDDLE',
              borders: {
                top: { style: 'SOLID' },
                bottom: { style: 'SOLID' },
                left: { style: 'SOLID' },
                right: { style: 'SOLID' },
              },
            },
          },
          fields:
            'userEnteredFormat(horizontalAlignment,verticalAlignment,borders)',
        },
      },
      {
        repeatCell: {
          range: {
            sheetId,
            startRowIndex: startRowIdx + 1,
            endRowIndex: startRowIdx + 2,
            startColumnIndex: 0,
            endColumnIndex: colCount,
          },
          cell: {
            userEnteredFormat: {
              backgroundColor: HEADER_COLOR,
              textFormat: { bold: true },
            },
          },
          fields: 'userEnteredFormat(backgroundColor,textFormat.bold)',
        },
      },
      {
        mergeCells: {
          range: {
            sheetId,
            startRowIndex: startRowIdx + 2,
            endRowIndex: endRowIdx,
            startColumnIndex: 0,
            endColumnIndex: 1,
          },
          mergeType: 'MERGE_ALL',
        },
      },
      {
        mergeCells: {
          range: {
            sheetId,
            startRowIndex: startRowIdx + 2,
            endRowIndex: endRowIdx,
            startColumnIndex: 1,
            endColumnIndex: 2,
          },
          mergeType: 'MERGE_ALL',
        },
      },
    ];
    if (sheetName === 'Inventory Data')
      requests.push({
        updateDimensionProperties: {
          range: { sheetId, dimension: 'COLUMNS', startIndex: 1, endIndex: 2 },
          properties: { pixelSize: 250 },
          fields: 'pixelSize',
        },
      });
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests },
    });
  };

  const processBlockSheet = async (sheetName, headers, dataRows) => {
    console.log(`Processing ${sheetName}...`);
    const matches = findApartmentRows(dataRows, 1, apartment.name);
    const sheetId = await getSheetIdByName(sheets, spreadsheetId, sheetName);
    if (matches.length > 0) {
      const firstRoomIdx = matches[0];
      let rowCount = 1;
      for (let i = firstRoomIdx + 1; i < dataRows.length; i++) {
        const row = dataRows[i] || [];
        const rowAbove = dataRows[firstRoomIdx] || [];
        if ((!row[1] || rowAbove[1] === row[1]) && row[2]) rowCount++;
        else break;
      }
      if (rowCount === rooms.length)
        return console.log(`${sheetName} matches. Skipping.`);
      const existingRows = dataRows.slice(
        firstRoomIdx,
        firstRoomIdx + rowCount,
      );
      const updatedRoomRows = preserveRows(
        rooms,
        existingRows,
        sheetName,
        apartment,
      );
      const existingId = existingRows[0] ? existingRows[0][0] : null;
      if (existingId) updatedRoomRows[0][0] = existingId;
      const newBlock = [
        new Array(headers.length).fill(''),
        headers,
        ...updatedRoomRows,
      ];
      const startIdx = Math.max(0, firstRoomIdx - 2);
      const endIdx = firstRoomIdx + rowCount;
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              deleteDimension: {
                range: {
                  sheetId,
                  dimension: 'ROWS',
                  startIndex: startIdx,
                  endIndex: endIdx,
                },
              },
            },
            {
              insertDimension: {
                range: {
                  sheetId,
                  dimension: 'ROWS',
                  startIndex: startIdx,
                  endIndex: startIdx + newBlock.length,
                },
              },
            },
          ],
        },
      });
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${sheetName}!A${startIdx + 1}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: newBlock },
      });
      await applyBlockFormatting(
        sheetName,
        sheetId,
        startIdx,
        startIdx + newBlock.length,
        headers.length,
      );
    } else {
      let lastId = 0;
      for (let i = dataRows.length - 1; i >= 0; i--) {
        const val = parseInt(dataRows[i] ? dataRows[i][0] : '', 10);
        if (!isNaN(val)) {
          lastId = val;
          break;
        }
      }
      const newBlock = [
        new Array(headers.length).fill(''),
        headers,
        ...rooms.map((room, index) => {
          const row = new Array(headers.length).fill('');
          if (index === 0) {
            row[0] = lastId + 1;
            row[1] = `=HYPERLINK("${apartment.driveLink}", "${apartment.name}")`;
          }
          row[2] = `=HYPERLINK("${room.driveLink}", "${getNumericRoom(room.name)}")`;
          return row;
        }),
      ];
      const res = await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `${sheetName}!A:A`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: newBlock },
      });
      const grid = parseA1Range(res.data.updates.updatedRange);
      await applyBlockFormatting(
        sheetName,
        sheetId,
        grid.startRowIndex,
        grid.endRowIndex,
        headers.length,
      );
    }
  };

  await processBlockSheet(
    'Inventory Data',
    INVENTORY_DATA_HEADERS,
    inventoryDataRows,
  );
  await processBlockSheet(
    'Rent Tracker',
    RENT_TRACKER_HEADERS,
    rentTrackerRows,
  );

  return {
    success: true,
    message: `Apartment "${apartment.name}" sync successful with borders applied.`,
    apartment: { name: apartment.name, rooms: rooms.length },
  };
}

module.exports = { addApartment };
