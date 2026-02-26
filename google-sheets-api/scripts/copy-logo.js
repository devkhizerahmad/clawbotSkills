const fs = require('fs');
const path = require('path');

const source =
  'c:\\Users\\MudasserRasool\\.openclaw\\workspace\\skills\\google-sheets-api\\assets\\hive-logo.png';
const dest =
  'c:\\Users\\MudasserRasool\\.openclaw\\workspace\\skills\\google-sheets-api\\assets\\hive-logo.png';

try {
  fs.copyFileSync(source, dest);
  console.log('Logo copied successfully');
} catch (err) {
  console.error('Error copying logo:', err.message);
}
