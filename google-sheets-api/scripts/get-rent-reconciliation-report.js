require("dotenv").config();
const { parseArgs } = require("./src/utils/parseArgs");
const {
  getRentReconciliationReport,
} = require("./src/commands/getRentReconciliationReport");

async function main() {
  try {
    const { args, flags } = parseArgs(process.argv.slice(2));
    const commandArgs = ["get_rent_reconciliation_report", ...args];

    const result = await getRentReconciliationReport({
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
