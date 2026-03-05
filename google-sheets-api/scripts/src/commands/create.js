'use strict';

const { logAudit } = require('../services/audit/logAudit');

async function create({ sheets, args, command }) {
  const [, title] = args;
  if (!title) throw new Error('Usage: create <title>');
  
  const response = await sheets.spreadsheets.create({
    requestBody: { properties: { title } },
  });
  
  // Log audit entry for spreadsheet creation
  await logAudit({
    user: 'ASSISTANT',
    sheet: title,
    cell: 'N/A',
    oldValue: 'N/A',
    newValue: `Spreadsheet created with ID: ${response.data.spreadsheetId}`,
    source: 'SYSTEM',
  });
  
  return response.data;
}

module.exports = { create };
