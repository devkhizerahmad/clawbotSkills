// src/config.js
const path = require("path");

module.exports = {
  SCOPES: {
    READ: "https://www.googleapis.com/auth/spreadsheets.readonly",
    WRITE: "https://www.googleapis.com/auth/spreadsheets",
  },
  DEFAULT_CRED_FILES: [
    "service-account.json",
    "credentials.json",
    "google-service-account.json",
    path.join(process.env.HOME || "", ".config/google-sheets/credentials.json"),
  ],
  AUDIT: {
    SPREADSHEET_ID: "1x7Ch_AOuLk6Zht2ef0Q--2K_QueKvcAft-P6d0sx76A",
    SHEET_NAME: "Audit_Log",
  },
  CLEANING: {
    SPREADSHEET_ID: "1RobrLNYSmMUyq53dUcdmj2ePaU2YkagqLqgIgx7M4OU",
    SHEET_NAME: "Cleaning",
    DATE_COLUMN: "W",
    DATE_COLOR: { red: 202 / 255, green: 237 / 255, blue: 251 / 255 },
  },
  EMAIL: {
    SERVICE: "gmail",
    USER: "devkhizerahmad@gmail.com",
    PASS: "aief unbt nkfa smrj",
    RECIPIENT: "devkhizerahmad@gmail.com",
  },
  COLORS: {
    GREEN: { red: 146 / 255, green: 208 / 255, blue: 80 / 255 },
    YELLOW: { red: 1, green: 1, blue: 0 },
    RED: { red: 1, green: 0, blue: 0 },
    WHITE: { red: 1, green: 1, blue: 1 },
    BLACK: { red: 0, green: 0, blue: 0 },
  },
  READ_ONLY_COMMANDS: new Set([
    "read",
    "batchGet",
    "info",
    "getFormat",
    "revisions",
  ]),
};
