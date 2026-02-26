const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

async function getHeaders() {
  const credPath =
    'c:\\Users\\MudasserRasool\\.openclaw\\workspace\\skills\\google-sheets-api\\service-account.json';
  const credentials = JSON.parse(fs.readFileSync(credPath, 'utf8'));
  const scopes = ['https://www.googleapis.com/auth/spreadsheets.readonly'];

  const auth = new google.auth.GoogleAuth({ credentials, scopes });
  const sheets = google.sheets({ version: 'v4', auth });
  const spreadsheetId = '1RobrLNYSmMUyq53dUcdmj2ePaU2YkagqLqgIgx7M4OU';

  try {
    const inventory = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Inventory!1:2',
    });
    console.log('--- Inventory Headers ---');
    console.log(JSON.stringify(inventory.data.values, null, 2));
    // const inventoryData = await sheets.spreadsheets.values.get({
    //   spreadsheetId,
    //   range: 'Inventory Data!A2:K5',
    // });
    // console.log('--- Inventory Data ---');
    // console.log(JSON.stringify(inventoryData.data.values, null, 2));
    // const cleaning = await sheets.spreadsheets.values.get({
    //   spreadsheetId,
    //   range: 'Cleaning!1:2',
    // });
    // console.log('--- Cleaning Headers ---');
    // console.log(JSON.stringify(cleaning.data.values, null, 2));
    // const rentTracker = await sheets.spreadsheets.values.get({
    //   spreadsheetId,
    //   range: 'Rent Tracker!A2:I5',
    // });
    // console.log('--- Rent Tracker Headers ---');
    // console.log(JSON.stringify(rentTracker.data.values, null, 2));
  } catch (err) {
    console.error(err.message);
  }
}

getHeaders();
