'use strict';

// Test script to verify formatCleaningDateCell functionality
const { getSheetsClient } = require('./scripts/src/auth');
const { WRITE_SCOPE } = require('./scripts/src/config');
const { formatCleaningDateCell } = require('./scripts/src/services/email/formatCleaningDateCell');

async function testFormatCleaningDateCell() {
  console.log('Testing formatCleaningDateCell function...');
  
  try {
    const sheets = getSheetsClient([WRITE_SCOPE]);
    
    // Test parameters - using the actual cleaning spreadsheet
    const spreadsheetId = '1RobrLNYSmMUyq53dUcdmj2ePaU2YkagqLqgIgx7M4OU';
    const cell = 'Cleaning!X9'; // Test cell in X column, row 5
    const oldValue = '2022-01-16';
    const newValue = '2026-02-25';
    
    console.log(`Testing with cell: ${cell}`);
    console.log(`Old value: ${oldValue}`);
    console.log(`New value: ${newValue}`);
    
    // Call the function
    await formatCleaningDateCell(sheets, spreadsheetId, cell, oldValue, newValue);
    
    console.log('✅ Test completed successfully!');
    console.log('Check your Google Sheet to verify:');
    console.log('- Cell X5 should have light blue background color');
    console.log('- Email notification should have been sent');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response?.data?.error) {
      console.error('Error details:', JSON.stringify(error.response.data.error, null, 2));
    }
  }
}

// Run the test
if (require.main === module) {
  testFormatCleaningDateCell();
}

module.exports = { testFormatCleaningDateCell };


// node scripts/sheets-cli.js write "1RobrLNYSmMUyq53dUcdmj2ePaU2YkagqLqgIgx7M4OU" "Cleaning!X23" "@test-data.json"