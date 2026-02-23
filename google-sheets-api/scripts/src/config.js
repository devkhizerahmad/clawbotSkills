'use strict';

const path = require('path');

const READ_SCOPE = 'https://www.googleapis.com/auth/spreadsheets.readonly';
const WRITE_SCOPE = 'https://www.googleapis.com/auth/spreadsheets';

const DEFAULT_CRED_FILES = [
  'service-account.json',
  'credentials.json',
  'google-service-account.json',
  path.join(
    process.env.HOME || '',
    '.config/google-sheets/credentials.json' || '../../credentials.json',
  ),
];

const AUDIT_SPREADSHEET_ID = '1x7Ch_AOuLk6Zht2ef0Q--2K_QueKvcAft-P6d0sx76A';
const AUDIT_SHEET_NAME = 'Audit_Log';

const EMAIL_USER = 'devkhizerahmad@gmail.com';
const EMAIL_PASS = 'aief unbt nkfa smrj';
const EMAIL_RECIPIENT = 'devkhizerahmad@gmail.com';

const CLEANING_SPREADSHEET_ID = '1RobrLNYSmMUyq53dUcdmj2ePaU2YkagqLqgIgx7M4OU';
const CLEANING_SHEET_NAME = 'Cleaning';
const CLEANING_DATE_COLUMN = 'X';
const CLEANING_DATE_COLOR = {
  red: 202 / 255,
  green: 237 / 255,
  blue: 251 / 255,
}; // #caedfb

// ===== EMAIL CONFIGURATION =====
const EMAIL_CONFIG = {
  service: 'gmail', // or 'outlook', 'yahoo'
  user: EMAIL_USER, // your-email@gmail.com
  pass: EMAIL_PASS, // app password
  recipient: EMAIL_RECIPIENT,
};

const READ_ONLY_COMMANDS = new Set([
  'read',
  'batchGet',
  'info',
  'getFormat',
  'revisions',
]);

const HELP_TEXT = `
  Google Sheets CLI (OpenClaw skill)
  
  Usage:
    node scripts/sheets-cli.js <command> [args] [--flags]
  
  Core data commands:
    read <spreadsheetId> <range> [--major=ROWS|COLUMNS] [--render=FORMATTED_VALUE]
    write <spreadsheetId> <range> <jsonOr@file> [--input=RAW|USER_ENTERED]
    append <spreadsheetId> <range> <jsonOr@file> [--input=RAW|USER_ENTERED] [--insert=INSERT_ROWS|OVERWRITE]
    clear <spreadsheetId> <range>
    batchGet <spreadsheetId> <range1,range2,...>
    batchWrite <spreadsheetId> <jsonOr@file>
    highlight <spreadsheetId> <range>
    unhighlight <spreadsheetId> <range>
  
  Formatting and layout:
    format <spreadsheetId> <range> <formatJsonOr@file>
    getFormat <spreadsheetId> <range>
    borders <spreadsheetId> <range> [styleJsonOr@file]
    merge <spreadsheetId> <range> [--type=MERGE_ALL|MERGE_COLUMNS|MERGE_ROWS]
    unmerge <spreadsheetId> <range>
    resize <spreadsheetId> <sheetName> <cols|rows> <start> <end> <px>
    autoResize <spreadsheetId> <sheetName> <startCol> <endCol>
    freeze <spreadsheetId> <sheetName> [rows] [cols]
  
  Sheet management:
    create <title>
    info <spreadsheetId>
    addSheet <spreadsheetId> <title>
    deleteSheet <spreadsheetId> <sheetName>
    renameSheet <spreadsheetId> <oldName> <newName>
    copyFormat <spreadsheetId> <sourceRange> <destRange>
  
  Advanced:
    batch <spreadsheetId> <requestsJsonOr@file>
  
  Date operations:
    allUpdatesCleaning <spreadsheetId> <add|subtract> <amount> <days|weeks|months|years>
  `;

module.exports = {
  READ_SCOPE,
  WRITE_SCOPE,
  DEFAULT_CRED_FILES,
  AUDIT_SPREADSHEET_ID,
  AUDIT_SHEET_NAME,
  EMAIL_CONFIG,
  CLEANING_SPREADSHEET_ID,
  CLEANING_SHEET_NAME,
  CLEANING_DATE_COLUMN,
  CLEANING_DATE_COLOR,
  READ_ONLY_COMMANDS,
  HELP_TEXT,
};
