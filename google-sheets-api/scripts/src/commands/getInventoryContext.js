'use strict';

async function getInventoryContext({ sheets, args }) {
  const spreadsheetId = args[1];
  const sheetName = 'Inventory';
  
  if (!spreadsheetId) {
    throw new Error('Usage: get-inventory-context <spreadsheetId>');
  }

  // 1. Fetch raw data from the top rows
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!A1:Z500`,
  });
  
  const rows = res.data.values || [];
  let headerRowIdx = -1;
  const colMap = { who: -1, roomType: -1, unitCrossStreet: -1 };

  // 2. Detect Columns dynamically
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    let foundCount = 0;
    
    row.forEach((cell, idx) => {
      const val = (cell || '').toString().toLowerCase().trim();
      if (val === 'who' || val === "who's" || val === 'whos') { 
        colMap.who = idx; 
        foundCount++; 
      } else if (val === 'room type') { 
        colMap.roomType = idx; 
        foundCount++; 
      } else if (val.includes('unit cross street')) { 
        colMap.unitCrossStreet = idx; 
        foundCount++; 
      }
    });

    if (foundCount >= 2) { // Found headers (at least 2 matches is a strong signal)
      headerRowIdx = i;
      break;
    }
  }

  if (headerRowIdx === -1) {
    throw new Error("Could not detect required Inventory columns ('Who', 'Room Type', 'Unit Cross Street').");
  }

  // 3. Extract Data & Calculate Range
  const extractedData = [];
  const startRow = headerRowIdx + 2; // +1 to convert 0-indexed to 1-indexed, +1 to skip header row
  let lastPopulatedRow = startRow - 1;

  for (let i = headerRowIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    
    const who = colMap.who !== -1 ? (row[colMap.who] || '').trim() : '';
    const roomType = colMap.roomType !== -1 ? (row[colMap.roomType] || '').trim() : '';
    const unitCrossStreet = colMap.unitCrossStreet !== -1 ? (row[colMap.unitCrossStreet] || '').trim() : '';
    
    if (who || roomType || unitCrossStreet) {
      extractedData.push({ 
        rowIndex: i + 1, 
        'Who': who, 
        'Room Type': roomType, 
        'Unit Cross Street': unitCrossStreet 
      });
      lastPopulatedRow = i + 1;
    }
  }

  // Helper to convert index to Column letter (0 -> A, 1 -> B, etc.)
  const numToChar = (n) => {
    let ordA = 'A'.charCodeAt(0);
    let ordZ = 'Z'.charCodeAt(0);
    let len = ordZ - ordA + 1;
  
    let s = "";
    while(n >= 0) {
        s = String.fromCharCode(n % len + ordA) + s;
        n = Math.floor(n / len) - 1;
    }
    return s;
  };

  const validIndices = [colMap.who, colMap.roomType, colMap.unitCrossStreet].filter(i => i !== -1);
  const startCol = numToChar(Math.min(...validIndices));
  const endCol = numToChar(Math.max(...validIndices));

  // 4. Return Payload
  return {
    success: true,
    sheet: sheetName,
    dynamicRangeDetected: `${sheetName}!${startCol}${startRow}:${endCol}${Math.max(lastPopulatedRow, startRow)}`,
    columnsDetected: {
      who: colMap.who !== -1 ? numToChar(colMap.who) : null,
      roomType: colMap.roomType !== -1 ? numToChar(colMap.roomType) : null,
      unitCrossStreet: colMap.unitCrossStreet !== -1 ? numToChar(colMap.unitCrossStreet) : null
    },
    data: extractedData
  };
}

module.exports = { getInventoryContext };
