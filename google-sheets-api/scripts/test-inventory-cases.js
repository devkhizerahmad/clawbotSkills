'use strict';
require('dotenv').config();

const { getSheetsClient } = require('./src/auth');
const { WRITE_SCOPE, INVENTORY_SPREADSHEET_ID } = require('./src/config');
const { getInventoryContext } = require('./src/commands/getInventoryContext');
const { write } = require('./src/commands/write');

async function testInventoryCases() {
  console.log('🧪 Testing Specific Inventory Scenarios\n');
  
  const normalize = (value) => (value || '').toString().trim().toLowerCase();
  const stripTestSuffix = (value) =>
    (value || '').toString().replace(/(?:\s+\(Tested\))+$/i, '').trim();

  try {
    if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
      process.env.GOOGLE_SERVICE_ACCOUNT_KEY = 'c:\\Users\\MudasserRasool\\.openclaw\\workspace\\skills\\google-sheets-api\\service-account.json';
    }
    const sheets = getSheetsClient([WRITE_SCOPE]);
    const spreadsheetId = INVENTORY_SPREADSHEET_ID;
    
    // ==========================================
    // STEP 1: Get Context Dynamically
    // ==========================================
    console.log('Step 1: Running get-inventory-context...');
    const contextResult = await getInventoryContext({
      sheets,
      args: ['get-inventory-context', spreadsheetId]
    });
    
    console.log('✅ Context Fetched Successfully!');
    const whoColChar = contextResult.columnsDetected.who;
    
    if (!whoColChar) {
      throw new Error("Could not find the 'Who's' column.");
    }

    const testScenarios = [
      { unit: '10 Hanover 11W', room: 'Room 1', expectedWho: 'Juyoung Kim' },
      { unit: 'The Epic 125 W 31st St', room: 'Room 1', expectedWho: 'Gian' },
      { unit: '123 Fake Street', room: 'Room 1', expectedWho: 'John Dummy Doe' }
    ];

    for (const scenario of testScenarios) {
      console.log(`\n==========================================`);
      console.log(`Test Case: Searching for "${scenario.unit}" - "${scenario.room}"`);
      
      // Find the row in the context data
      const targetRow = contextResult.data.find(row => 
        normalize(row['Unit Cross Street']) === normalize(scenario.unit) && 
        normalize(row['Room Type']) === normalize(scenario.room)
      );

      if (!targetRow) {
        console.log(`⚠️  Could not find data for ${scenario.unit} - ${scenario.room}. Skipping...`);
        continue;
      }

      console.log(`Found at Row: ${targetRow.rowIndex}`);
      console.log(`Current 'Who's' value: "${targetRow['Who']}"`);
      
      const targetCell = `Inventory!${whoColChar}${targetRow.rowIndex}`;
      const newName = `${stripTestSuffix(targetRow['Who'])} (Tested)`;

      console.log(`Updating Cell: ${targetCell} to "${newName}"`);

      // Write command (This automatically triggers the Audit Log)
      const writeResult = await write({
        sheets,
        args: ['write', spreadsheetId, targetCell, newName],
        flags: { user: 'SCENARIO_TESTER' },
        command: 'write',
        isMutation: true
      });

      console.log(`✅ Update successful! Status: ${writeResult.status}`);
      console.log(`Check Audit_Log for an entry by "SCENARIO_TESTER" updating ${targetCell}`);
    }

    console.log('\n🎉 All test cases completed!');

  } catch (error) {
    console.error('\n❌ FAILED:', error.message);
    if (error.response?.data?.error) {
      console.error('Details:', JSON.stringify(error.response.data.error, null, 2));
    }
  }
}

if (require.main === module) {
  testInventoryCases();
}

module.exports = { testInventoryCases };
