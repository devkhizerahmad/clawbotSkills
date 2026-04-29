'use strict';

const { getInventoryContext } = require('./src/commands/getInventoryContext');

// Helper to create a mocked sheets object
function createMockSheets(mockRows) {
  return {
    spreadsheets: {
      values: {
        get: async () => ({
          data: {
            values: mockRows
          }
        })
      }
    }
  };
}

async function runMockTests() {
  console.log('🧪 Running Mock Tests for "get-inventory-context" logic...\n');

  // ===============================================
  // SCENARIO 1: NORMAL DATA (Based on user provided data)
  // ===============================================
  console.log('--- SCENARIO 1: Normal Data ---');
  const normalDataRows = [
    // Putting empty rows to simulate headers starting later
    [],
    ["Random Header", "Ignore this"],
    ["Unit Cross Street", "Neighborhood", "Room Type", "Who's", "Availability", "Rent"],
    ["John Mechlaran", "Some Value", "Room 1", "usman", "15-Feb", "$ 50,000"],
    ["10 Hanover 11W", "FiDi", "Room 1", "Juyoung Kim", "1-Apr", "$ 1,975"],
    ["90 Washington 24M", "FiDi", "Room 2", "Usman", "11-Nov", "$ 2,000"],
    ["The Epic 125 W 31st St", "", "Room 1", "Gian", "1-May", "$ -"],
    ["The Epic 125 W 31st St", "", "Room 3", "", "", ""],
    ["90 Washington Street New York NY 10006", "", "Room 2", "Zayan", "11-Nov", "$1,200"],
    ["90 Washington Street New York NY 10006", "", "Room 3", "Zayan", "11-Nov", "$1,200"],
    ["123 Fake Street", "", "Room 1", "John Dummy Doe", "1-Jun", "$2,000"],
    ["", "Room", "Room", "$", "$"],
    [],
    [] // empty trailing rows
  ];

  try {
    const res1 = await getInventoryContext({
      sheets: createMockSheets(normalDataRows),
      args: ['get-inventory-context', 'MOCK_ID']
    });
    console.log(`✅ Passed! Detected range: ${res1.dynamicRangeDetected}`);
    console.log(`Extracted ${res1.data.length} valid rows.`);
    console.log('Sample Data (First 2 rows):', res1.data.slice(0, 2));
  } catch (e) {
    console.log(`❌ Failed: ${e.message}`);
  }

  // ===============================================
  // SCENARIO 2: LESS DATA (Headers and only 1 row)
  // ===============================================
  console.log('\n--- SCENARIO 2: Less Data ---');
  const lessDataRows = [
    ["Unit Cross Street", "Room Type", "Who"],
    ["Only One Apartment", "Master", "Solo Tenant"]
  ];

  try {
    const res2 = await getInventoryContext({
      sheets: createMockSheets(lessDataRows),
      args: ['get-inventory-context', 'MOCK_ID']
    });
    console.log(`✅ Passed! Detected range: ${res2.dynamicRangeDetected}`);
    console.log(`Extracted ${res2.data.length} valid rows.`);
    console.log('Sample Data:', res2.data);
  } catch (e) {
    console.log(`❌ Failed: ${e.message}`);
  }

  // ===============================================
  // SCENARIO 3: MORE DATA WITH GAPS & EXTRA EMPTY ROWS
  // ===============================================
  console.log('\n--- SCENARIO 3: More Data (With Gaps) ---');
  const moreDataRows = [
    ["Unit Cross Street", "Neighborhood", "Room Type", "Who's"],
  ];
  // Add 100 empty rows
  for(let i=0; i<100; i++) moreDataRows.push(["", "", "", ""]);
  // Add some populated rows
  moreDataRows.push(["Gap Apartment 1", "NY", "Room 1", "Gap User 1"]);
  moreDataRows.push(["Gap Apartment 2", "NY", "Room 1", "Gap User 2"]);
  // Add more empty rows
  for(let i=0; i<50; i++) moreDataRows.push(["", "", "", ""]);

  try {
    const res3 = await getInventoryContext({
      sheets: createMockSheets(moreDataRows),
      args: ['get-inventory-context', 'MOCK_ID']
    });
    console.log(`✅ Passed! Detected range: ${res3.dynamicRangeDetected}`);
    console.log(`Extracted ${res3.data.length} valid rows out of ${moreDataRows.length} total raw rows.`);
    console.log('Sample Data (Last row extracted):', res3.data[res3.data.length - 1]);
  } catch (e) {
    console.log(`❌ Failed: ${e.message}`);
  }
}

runMockTests();
