'use strict';

const { google } = require('googleapis');
const { getSheetsClient } = require('./src/auth'); // can't use directly because it returns a sheets client
const fs = require('fs');
const path = require('path');
const { DEFAULT_CRED_FILES } = require('./src/config');
const { readFileJson } = require('./src/utils/readFileJson');

function resolveCredentials() {
  for (const rel of DEFAULT_CRED_FILES) {
    const fullPath = path.isAbsolute(rel) ? rel : path.join(process.cwd(), rel);
    if (fs.existsSync(fullPath)) {
      return {
        credentials: readFileJson(fullPath),
        source: `file:${fullPath}`,
      };
    }
  }
  return null;
}

async function listFiles() {
  const { credentials } = resolveCredentials();
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  });
  const drive = google.drive({ version: 'v3', auth });

  const folderId = '1iRfjl7Fao3MHxgi6SQgIUFp3QSCKxKm_';
  try {
    const res = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: 'files(id, name, mimeType)',
    });
    console.log('Files in folder:');
    console.log(JSON.stringify(res.data.files, null, 2));
  } catch (err) {
    console.error('Error listing files:', err.message);
  }
}

listFiles();
