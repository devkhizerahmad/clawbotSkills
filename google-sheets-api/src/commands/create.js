const { getSheetsClient } = require('../services/google');
const { SCOPES } = require('../config');

async function execute(args, flags) {
  const title = args[1];
  if (!title) throw new Error('Usage: create <title>');
  const sheets = getSheetsClient([SCOPES.WRITE]);
  const response = await sheets.spreadsheets.create({ requestBody: { properties: { title } } });
  return response.data;
}
module.exports = { execute };