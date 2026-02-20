'use strict';

async function create({ sheets, args }) {
  const [, title] = args;
  if (!title) throw new Error('Usage: create <title>');
  const response = await sheets.spreadsheets.create({
    requestBody: { properties: { title } },
  });
  return response.data;
}

module.exports = { create };
