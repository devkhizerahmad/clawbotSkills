'use strict';

const {
  READ_SCOPE,
  WRITE_SCOPE,
  READ_ONLY_COMMANDS,
  HELP_TEXT,
} = require('./config');
const { getSheetsClient, DRIVE_READ_SCOPE } = require('./auth');
const { parseArgs } = require('./utils/parseArgs');
const commands = require('./commands/index');

async function main() {
  const { args, flags } = parseArgs(process.argv.slice(2));
  const command = args[0];

  if (!command || command === 'help' || command === '--help') {
    console.log(HELP_TEXT.trim());
    return;
  }

  const handler = commands[command];
  if (!handler) {
    console.error(`Unknown command: ${command}`);
    process.exit(1);
  }

  const scopes = READ_ONLY_COMMANDS.has(command) ? [READ_SCOPE] : [WRITE_SCOPE];
  if (command === 'add-apartment') {
    scopes.push(DRIVE_READ_SCOPE);
  }
  const sheets = getSheetsClient(scopes);
  const isMutation = !READ_ONLY_COMMANDS.has(command);

  try {
    const result = await handler({
      sheets,
      args,
      flags,
      command,
      isMutation,
    });

    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Error:', error.message);
    if (error.response?.data?.error) {
      console.error(JSON.stringify(error.response.data.error, null, 2));
    }
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { main };
