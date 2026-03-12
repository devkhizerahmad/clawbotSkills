'use strict';

const { getSheetsClient } = require('./src/auth');
const { WRITE_SCOPE, CLEANING_SPREADSHEET_ID } = require('./src/config');
const { formatCleaningDateCell } = require('./src/services/email/formatCleaningDateCell');

async function testSimple() {
  console.log('🧪 Simple Cleaning Format Test\n');
  
  try {
   const sheets = getSheetsClient([WRITE_SCOPE]);
   const spreadsheetId = CLEANING_SPREADSHEET_ID;
    
    // Test 1: YELLOW on X5 (regular cleaning)
   console.log('Test 1: Applying YELLOW to cell Cleaning!X5');
    await formatCleaningDateCell(
     sheets,
      spreadsheetId,
      'Cleaning!X5',
      '(empty)',
      new Date().toISOString().split('T')[0],
      false
    );
   console.log('✅ YELLOW applied to X5\n');
    
    // Test 2: LIGHT BLUE on X6 (move-out)
   console.log('Test 2: Applying LIGHT BLUE to cell Cleaning!X6');
    await formatCleaningDateCell(
     sheets,
      spreadsheetId,
      'Cleaning!X6',
      '(empty)',
      new Date().toISOString().split('T')[0],
      true
    );
   console.log('✅ LIGHT BLUE applied to X6\n');
    
   console.log('SUCCESS! Check your Google Sheet:');
   console.log('  • Cell X5 should be YELLOW');
   console.log('  • Cell X6 should be LIGHT BLUE (#caedfb)');
   console.log('  • ONLY column X should be colored (not entire row)');
    
  } catch (error) {
   console.error('FAILED:', error.message);
    if (error.response?.data?.error) {
     console.error('Details:', JSON.stringify(error.response.data.error, null, 2));
    }
  }
}

if (require.main === module) {
  testSimple();
}

module.exports = { testSimple };
