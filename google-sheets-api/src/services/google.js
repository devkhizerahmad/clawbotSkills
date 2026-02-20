// src/services/google.js
const { google } = require("googleapis");
const fs = require("fs");
const path = require("path");
const { DEFAULT_CRED_FILES } = require("../config");

const CLIENT_CACHE = new Map();

function resolveCredentials() {
  const inlineJson =
    process.env.GOOGLE_SHEETS_CREDENTIALS_JSON ||
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (inlineJson) {
    return {
      credentials: JSON.parse(inlineJson),
      source: "env:GOOGLE_SHEETS_CREDENTIALS_JSON",
    };
  }

  const envPath =
    process.env.GOOGLE_SERVICE_ACCOUNT_KEY ||
    process.env.GOOGLE_SHEETS_KEY_FILE ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (envPath && fs.existsSync(envPath)) {
    return {
      credentials: JSON.parse(fs.readFileSync(envPath, "utf8")),
      source: `file:${envPath}`,
    };
  }

  for (const rel of DEFAULT_CRED_FILES) {
    const fullPath = path.isAbsolute(rel) ? rel : path.join(process.cwd(), rel);
    if (fs.existsSync(fullPath)) {
      return {
        credentials: JSON.parse(fs.readFileSync(fullPath, "utf8")),
        source: `file:${fullPath}`,
      };
    }
  }
  return null;
}

function getSheetsClient(scopes) {
  const cacheKey = scopes.join(" ");
  if (CLIENT_CACHE.has(cacheKey)) {
    return CLIENT_CACHE.get(cacheKey);
  }

  const found = resolveCredentials();
  if (!found) {
    console.error("No Google Sheets credentials found.");
    process.exit(1);
  }

  const auth = new google.auth.GoogleAuth({
    credentials: found.credentials,
    scopes,
  });
  const client = google.sheets({ version: "v4", auth });
  CLIENT_CACHE.set(cacheKey, client);
  return client;
}

module.exports = { getSheetsClient };
