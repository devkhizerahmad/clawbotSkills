'use strict';

const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
const { DEFAULT_CRED_FILES } = require('./config');
const { readFileJson } = require('./utils/readFileJson');

const READ_SCOPE = 'https://www.googleapis.com/auth/spreadsheets.readonly';
const WRITE_SCOPE = 'https://www.googleapis.com/auth/spreadsheets';
const DRIVE_READ_SCOPE = 'https://www.googleapis.com/auth/drive.readonly';

const CLIENT_CACHE = new Map();

function resolveCredentials() {
  const inlineJson =
    process.env.GOOGLE_SHEETS_CREDENTIALS_JSON ||
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (inlineJson) {
    return {
      credentials: JSON.parse(inlineJson),
      source: 'env:GOOGLE_SHEETS_CREDENTIALS_JSON',
    };
  }

  const envPath =
    process.env.GOOGLE_SERVICE_ACCOUNT_KEY ||
    process.env.GOOGLE_SHEETS_KEY_FILE ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (envPath && fs.existsSync(envPath)) {
    return { credentials: readFileJson(envPath), source: `file:${envPath}` };
  }

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

function requireCredentials() {
  const found = resolveCredentials();
  if (!found) {
    console.error('No Google Sheets/Drive credentials found.');
    console.error(
      'Set GOOGLE_SERVICE_ACCOUNT_KEY or GOOGLE_SHEETS_CREDENTIALS_JSON,',
    );
    console.error('or place credentials.json in the skill folder.');
    process.exit(1);
  }
  return found;
}

function getSheetsClient(scopes) {
  const cacheKey = `sheets:${scopes.join(' ')}`;
  if (CLIENT_CACHE.has(cacheKey)) {
    return CLIENT_CACHE.get(cacheKey);
  }

  const { credentials } = requireCredentials();
  const auth = new google.auth.GoogleAuth({ credentials, scopes });
  const client = google.sheets({ version: 'v4', auth });
  CLIENT_CACHE.set(cacheKey, client);
  return client;
}

function getDriveClient(scopes) {
  const cacheKey = `drive:${scopes.join(' ')}`;
  if (CLIENT_CACHE.has(cacheKey)) {
    return CLIENT_CACHE.get(cacheKey);
  }

  const { credentials } = requireCredentials();
  const auth = new google.auth.GoogleAuth({ credentials, scopes });
  const client = google.drive({ version: 'v3', auth });
  CLIENT_CACHE.set(cacheKey, client);
  return client;
}

module.exports = {
  getSheetsClient,
  getDriveClient,
  DRIVE_READ_SCOPE,
};
