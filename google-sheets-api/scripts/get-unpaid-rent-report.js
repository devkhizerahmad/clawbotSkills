require("dotenv").config();
const { parseArgs } = require("./src/utils/parseArgs");
const { getUnpaidRentReport } = require("./src/commands/getUnpaidRentReport");

async function main() {
  try {
    const { args, flags } = parseArgs(process.argv.slice(2));
    // The command name is implicit here. The first arg from user is the month.
    const commandArgs = ["get_unpaid_rent_report", ...args];

    const result = await getUnpaidRentReport({
      args: commandArgs,
      flags,
    });
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error("Error:", error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
require("dotenv").config();
const { parseArgs } = require("./src/utils/parseArgs");
const { getUnpaidRentReport } = require("./src/commands/getUnpaidRentReport");

async function main() {
  try {
    const { args, flags } = parseArgs(process.argv.slice(2));
    // The command name is implicit here. The first arg from user is the month.
    const commandArgs = ["get_unpaid_rent_report", ...args];

    const result = await getUnpaidRentReport({
      args: commandArgs,
      flags,
    });
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error("Error:", error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
require("dotenv").config();
const { parseArgs } = require("./src/utils/parseArgs");
const { getUnpaidRentReport } = require("./src/commands/getUnpaidRentReport");

async function main() {
  try {
    const { args, flags } = parseArgs(process.argv.slice(2));
    // The command name is implicit here. The first arg from user is the month.
    const commandArgs = ["get_unpaid_rent_report", ...args];

    const result = await getUnpaidRentReport({
      args: commandArgs,
      flags,
    });
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error("Error:", error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
require("dotenv").config();
const { parseArgs } = require("./src/utils/parseArgs");
const { getUnpaidRentReport } = require("./src/commands/getUnpaidRentReport");

async function main() {
  try {
    const { args, flags } = parseArgs(process.argv.slice(2));
    // The command name is implicit here. The first arg from user is the month.
    const commandArgs = ["get_unpaid_rent_report", ...args];

    const result = await getUnpaidRentReport({
      args: commandArgs,
      flags,
    });
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error("Error:", error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
require("dotenv").config();
const { parseArgs } = require("./src/utils/parseArgs");
const { getUnpaidRentReport } = require("./src/commands/getUnpaidRentReport");

async function main() {
  try {
    const { args, flags } = parseArgs(process.argv.slice(2));
    // The command name is implicit here. The first arg from user is the month.
    const commandArgs = ["get_unpaid_rent_report", ...args];

    const result = await getUnpaidRentReport({
      args: commandArgs,
      flags,
    });
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error("Error:", error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
