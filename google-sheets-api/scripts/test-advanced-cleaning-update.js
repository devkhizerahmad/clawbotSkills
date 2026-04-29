'use strict';

const { getSheetsClient } = require('./src/auth');
const {
  WRITE_SCOPE,
  CLEANING_SPREADSHEET_ID,
} = require('./src/config');
const { cleaningUpdate } = require('./src/commands/cleaningUpdate');

const TEST_PAYLOAD = {
  who: 'Vinny',
  contact: 'khizerahmad711@gmail.com',
  building: '85 John Apt 8E',
  cleaningDate: '10/10/2026',
  moveout: true,
};

async function testAdvancedCleaningUpdate() {
  console.log('Testing advanced cleaning-update command...');
  console.log('This test updates the live Cleaning sheet and triggers the move-out email flow.');
  console.log(`Target building: ${TEST_PAYLOAD.building}`);
  console.log(`New cleaning date: ${TEST_PAYLOAD.cleaningDate}`);
  console.log(`Move-out: ${TEST_PAYLOAD.moveout ? 'Yes' : 'No'}`);

  try {
    const sheets = getSheetsClient([WRITE_SCOPE]);

    const result = await cleaningUpdate({
      sheets,
      args: [
        'cleaning-update',
        CLEANING_SPREADSHEET_ID,
        JSON.stringify(TEST_PAYLOAD),
      ],
      flags: {
        user: 'TEST_ADV_CLEANING',
      },
      command: 'cleaning-update',
      isMutation: true,
    });

    console.log('\nCommand result:');
    console.log(JSON.stringify(result, null, 2));

    if (!result.success) {
      throw new Error(result.question || 'Advanced cleaning update did not succeed.');
    }

    if (result.flow !== 'advanced') {
      throw new Error(`Expected advanced flow, but received: ${result.flow}`);
    }

    const verificationRanges = [
      result.mappedRanges.who,
      result.mappedRanges.contact,
      result.mappedRanges.cleaningDate,
    ];

    const verification = await sheets.spreadsheets.values.batchGet({
      spreadsheetId: CLEANING_SPREADSHEET_ID,
      ranges: verificationRanges,
    });

    const values = verification.data.valueRanges || [];
    const whoValue = values[0]?.values?.[0]?.[0] || '';
    const contactValue = values[1]?.values?.[0]?.[0] || '';
    const dateValue = values[2]?.values?.[0]?.[0] || '';

    console.log('\nVerification after mutation:');
    console.log(`- Row: ${result.rowNumber}`);
    console.log(`- ${result.mappedRanges.who}: ${whoValue}`);
    console.log(`- ${result.mappedRanges.contact}: ${contactValue}`);
    console.log(`- ${result.mappedRanges.cleaningDate}: ${dateValue}`);

    console.log('\nExpected outcomes:');
    console.log('- The cleaning date should now be 10/10/2026');
    console.log('- The X-column cell should be formatted as move-out cleaning');
    console.log('- An email should be sent to khizerahmad711@gmail.com if email configuration is valid');
    console.log('- Audit logs should be created only for actual sheet mutations');

    console.log('\nAdvanced cleaning-update test completed successfully.');
  } catch (error) {
    console.error('\nAdvanced cleaning-update test failed:', error.message);
    if (error.response?.data?.error) {
      console.error(JSON.stringify(error.response.data.error, null, 2));
    }
    process.exitCode = 1;
  }
}

if (require.main === module) {
  testAdvancedCleaningUpdate();
}

module.exports = { testAdvancedCleaningUpdate };
