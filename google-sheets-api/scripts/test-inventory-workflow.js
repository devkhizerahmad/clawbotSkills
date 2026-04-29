'use strict';

const { getSheetsClient } = require('./src/auth');
const { WRITE_SCOPE, INVENTORY_SPREADSHEET_ID } = require('./src/config');
const { getInventoryContext } = require('./src/commands/getInventoryContext');
const { write } = require('./src/commands/write');

async function testInventoryWorkflow() {
  console.log('🧪 Testing Advanced Inventory Workflow\n');
  
  try {
    const sheets = getSheetsClient([WRITE_SCOPE]);
    const spreadsheetId = INVENTORY_SPREADSHEET_ID;
    
    // ==========================================
    // STEP 1: Get Context Dynamically
    // ==========================================
    console.log('Step 1: Running get-inventory-context to find exact columns and rows...');
    
    // Mock the CLI args for get-inventory-context: [ 'get-inventory-context', spreadsheetId ]
    const contextResult = await getInventoryContext({
      sheets,
      args: ['get-inventory-context', spreadsheetId]
    });
    
    console.log('✅ Context Fetched Successfully!');
    console.log(`Detected Dynamic Range: ${contextResult.dynamicRangeDetected}`);
    console.log(`Columns Detected:`, contextResult.columnsDetected);
    
    if (contextResult.data.length === 0) {
      console.log('⚠️ No data rows found in Inventory. Skipping update test.');
      return;
    }

    // ==========================================
    // STEP 2: Find a Specific Scenario (Row to Update)
    // ==========================================
    // Scenario: We want to update the 'Who' column for the very first valid row we found.
    const testRow = contextResult.data[0];
    const targetRowIndex = testRow.rowIndex;
    const whoColChar = contextResult.columnsDetected.who;
    
    if (!whoColChar) {
      throw new Error("Could not find the 'Who' column to test an update.");
    }

    const targetCell = `Inventory!${whoColChar}${targetRowIndex}`;
    const newName = `Test User ${Math.floor(Math.random() * 1000)}`;

    console.log(`\nStep 2: Scenario - Updating first row's "Who" column.`);
    console.log(`Target Cell determined dynamically: ${targetCell}`);
    console.log(`Previous Value: "${testRow['Who'] || '(empty)'}"`);
    console.log(`New Value to Write: "${newName}"`);

    // ==========================================
    // STEP 3: Write and Trigger Audit Log
    // ==========================================
    console.log('\nStep 3: Running write command to update value and trigger Audit Log...');
    
    // Mock the CLI args for write: [ 'write', spreadsheetId, range, value ]
    // The write command internally calls executeWithOptionalAudit which updates Audit_Log
    const writeResult = await write({
      sheets,
      args: ['write', spreadsheetId, targetCell, newName],
      flags: { user: 'TEST_SCRIPT' }, // Logs as TEST_SCRIPT in Audit Log
      command: 'write',
      isMutation: true
    });

    console.log('✅ Write Completed Successfully!');
    console.log(`Result: ${JSON.stringify(writeResult, null, 2)}`);
    
    console.log('\n🎉 SUCCESS! Please check your Google Sheet:');
    console.log(`  • Cell ${targetCell} in "Inventory" should now say "${newName}"`);
    console.log(`  • The "Audit_Log" tab should have a new entry by "TEST_SCRIPT" showing the old and new value for ${targetCell}`);

  } catch (error) {
    console.error('\n❌ FAILED:', error.message);
    if (error.response?.data?.error) {
      console.error('Details:', JSON.stringify(error.response.data.error, null, 2));
    }
  }
}

if (require.main === module) {
  testInventoryWorkflow();
}

module.exports = { testInventoryWorkflow };
