'use strict';

/**
 * Range Verification Test
 * This test verifies that ONLY cell X is colored, not the entire row
 * Run with: node scripts/test-cleaning-range.js
 */

const { getSheetsClient } = require('../src/auth');
const { WRITE_SCOPE, CLEANING_SPREADSHEET_ID } = require('../src/config');

async function testRangeVerification() {
  console.log('🔍 Cleaning Format Range Verification Test\n');
  console.log('=' .repeat(60));
  
  try {
  const sheets = getSheetsClient([WRITE_SCOPE]);
  const spreadsheetId = CLEANING_SPREADSHEET_ID;
  const testRow = 100; // Use high row number
    
  console.log(`Setting up test on row ${testRow}...\n`);
    
    // Step 1: Get sheet ID
  const sheetResp = await sheets.spreadsheets.get({ spreadsheetId });
  const cleaningSheet = sheetResp.data.sheets.find(s => s.properties.title === 'Cleaning');
  const sheetId = cleaningSheet.properties.sheetId;
    
  console.log(`✓ Sheet ID: ${sheetId}`);
    
    // Step 2: Apply YELLOW to cell X{testRow} only
  console.log(`\n📝 Applying YELLOW to cell X${testRow}...`);
    
  const yellow = { red: 1, green: 1, blue: 0 };
    
   await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{
          repeatCell: {
            range: {
             sheetId,
              startRowIndex: testRow - 1,
              endRowIndex: testRow,
              startColumnIndex: 23, // Column X
              endColumnIndex: 24,   // Only column X
            },
            cell: {
              userEnteredFormat: {
                backgroundColor: yellow,
              },
            },
            fields: 'userEnteredFormat.backgroundColor',
          },
        }],
      },
    });
    
  console.log(`✓ Color applied to X${testRow}`);
    
    // Step 3: Verify formatting on cell X{testRow}
  console.log(`\n🔍 Verifying cell X${testRow} formatting...`);
    
  const xCellResp = await sheets.spreadsheets.get({
      spreadsheetId,
      ranges: [`Cleaning!X${testRow}`],
      fields: 'sheets(data.rowData.values(userEnteredFormat.backgroundColor))',
    });
    
  const xCellData = xCellResp.data.sheets[0]?.data[0]?.rowData?.[0]?.values?.[0];
  const xCellColor = xCellData?.userEnteredFormat?.backgroundColor;
    
   if (xCellColor) {
    console.log(`✓ Cell X${testRow} has background color:`);
    console.log(`  RGB: (${(xCellColor.red * 255).toFixed(0)}, ${(xCellColor.green * 255).toFixed(0)}, ${(xCellColor.blue * 255).toFixed(0)})`);
     
     // Check if yellow
     if (xCellColor.red > 0.9 && xCellColor.green > 0.9 && xCellColor.blue < 0.1) {
      console.log('  ✅ Color is YELLOW (correct!)');
     } else {
      console.log('  ⚠️  Color is not yellow');
     }
   } else {
    console.log(`⚠️  Cell X${testRow} has no background color`);
   }
    
    // Step 4: Verify formatting on cell A{testRow} (should NOT be colored)
  console.log(`\n🔍 Verifying cell A${testRow} (should NOT be colored)...`);
    
  const aCellResp = await sheets.spreadsheets.get({
      spreadsheetId,
      ranges: [`Cleaning!A${testRow}`],
      fields: 'sheets(data.rowData.values(userEnteredFormat.backgroundColor))',
    });
    
  const aCellData = aCellResp.data.sheets[0]?.data[0]?.rowData?.[0]?.values?.[0];
  const aCellColor = aCellData?.userEnteredFormat?.backgroundColor;
    
   if (aCellColor) {
    console.log(`⚠️  WARNING: Cell A${testRow} HAS background color (should be empty)!`);
    console.log(`  RGB: (${(aCellColor.red * 255).toFixed(0)}, ${(aCellColor.green * 255).toFixed(0)}, ${(aCellColor.blue * 255).toFixed(0)})`);
    console.log('  ❌ This indicates the ENTIRE ROW is being colored, not just column X!');
   } else {
    console.log(`✓ Cell A${testRow} has NO background color (correct!)`);
   }
    
    // Step 5: Verify formatting on cell Y{testRow} (should NOT be colored)
  console.log(`\n🔍 Verifying cell Y${testRow} (should NOT be colored)...`);
    
  const yCellResp = await sheets.spreadsheets.get({
      spreadsheetId,
      ranges: [`Cleaning!Y${testRow}`],
      fields: 'sheets(data.rowData.values(userEnteredFormat.backgroundColor))',
    });
    
  const yCellData = yCellResp.data.sheets[0]?.data[0]?.rowData?.[0]?.values?.[0];
  const yCellColor = yCellData?.userEnteredFormat?.backgroundColor;
    
   if (yCellColor) {
    console.log(`⚠️  WARNING: Cell Y${testRow} HAS background color (should be empty)!`);
    console.log('  ❌ This indicates the ENTIRE ROW is being colored!');
   } else {
    console.log(`✓ Cell Y${testRow} has NO background color (correct!)`);
   }
    
    // Final Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST SUMMARY:');
  console.log('=' .repeat(60));
    
   if (xCellColor && !aCellColor && !yCellColor) {
    console.log('✅ PASS: Only cell X is colored (CORRECT!)');
    console.log('   ✓ X column: COLORED');
    console.log('   ✓ A column: NOT colored');
    console.log('   ✓ Y column: NOT colored');
    console.log('\n🎉 The range is working correctly!');
   } else if (xCellColor && aCellColor && yCellColor) {
    console.log('❌ FAIL: Entire row is colored (WRONG!)');
    console.log('   ✗ X column: COLORED');
    console.log('   ✗ A column: COLORED (should NOT be)');
    console.log('   ✗ Y column: COLORED (should NOT be)');
    console.log('\n⚠️  PROBLEM: The code is coloring the entire row instead of just column X!');
    console.log('⚠️  Check for:');
    console.log('   • Google Apps Script triggers on the sheet');
    console.log('   • Conditional formatting rules');
    console.log('   • Other automation modifying the range');
   } else {
    console.log('⚠️  PARTIAL: Unexpected result');
    console.log(`   X colored: ${!!xCellColor}`);
    console.log(`   A colored: ${!!aCellColor}`);
    console.log(`   Y colored: ${!!yCellColor}`);
   }
    
  console.log('\n');
    
  } catch (error) {
  console.error('\n❌ TEST FAILED:', error.message);
    if (error.response?.data?.error) {
    console.error('Details:', JSON.stringify(error.response.data.error, null, 2));
    }
    throw error;
  }
}

if (require.main === module) {
  testRangeVerification();
}

module.exports = { testRangeVerification };
