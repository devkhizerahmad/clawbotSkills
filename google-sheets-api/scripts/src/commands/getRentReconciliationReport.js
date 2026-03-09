"use strict";

const { getMongoClient } = require("../db/mongo");

/**
 * Formats a raw database record into a structured object for display,
 * matching the format of the Rent Reconciliation Report.
 * @param {object} record - The raw record from MongoDB.
 * @returns {object} A formatted record with standardized keys.
 */
function formatRecordForDisplay(record) {
  const getValue = (key) => {
    const recordKey = Object.keys(record).find(
      (k) =>
        k.toLowerCase().replace(/\s/g, "") ===
        key.toLowerCase().replace(/\s/g, "")
    );
    return recordKey ? record[recordKey] : undefined;
  };

  const expected = getValue("Expected Rent");
  const actual = getValue("Actual Amount") || getValue("Actual Payment");
  let difference = getValue("Difference");

  if (
    difference === undefined &&
    typeof expected === "number" &&
    typeof actual === "number"
  ) {
    difference = actual - expected;
  }

  return {
    "Payment Status": getValue("Status"),
    "Tenant Name": getValue("Tenant Name"),
    Email: getValue("Email"),
    Phone: getValue("Phone"),
    "Unit / Room": `${getValue("Apartment") || getValue("Unit") || ""} / ${
      getValue("Room") || ""
    }`.replace(/^ \/ | \/ $/g, ""),
    "Expected Rent": expected,
    "Actual Payment": actual,
    Difference: difference,
  };
}

async function getRentReconciliationReport({ args, flags }) {
  const month = args[1] || flags.month;
  const filterArg = args[2] ? args[2].toLowerCase() : null;
  const applyFilter = filterArg === "unpaid" || filterArg === "missing";

  if (!month) {
    throw new Error(
      `A month must be provided. Usage: ... get_rent_reconciliation_report <month> [unpaid|missing] (e.g., "YYYY-MM")`
    );
  }

  if (!/^\d{4}-\d{2}$/.test(month)) {
    throw new Error(
      'Invalid month format. Please use YYYY-MM (e.g., "2026-03").'
    );
  }

  const [year, monthNum] = month.split("-").map(Number);

  // Convert month number to month name (e.g., "March 2026")
  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  const monthName = monthNames[monthNum - 1];
  const monthFieldName = `${monthName} ${year}`;

  console.log(`[Query] Fetching reconciliation records for: ${monthFieldName}`);

  let mongoClient;
  try {
    mongoClient = await getMongoClient();
    const db = mongoClient.db();
    const collection = db.collection("rent_reconciliation");

    // Query for documents where the month field exists (e.g., "March 2026")
    const query = { [monthFieldName]: { $exists: true } };
    const document = await collection.findOne(query);

    // Extract records from the month field
    let records = [];
    if (document && document[monthFieldName]) {
      records = document[monthFieldName];
      console.log(
        `[Result] Found ${records.length} total records for ${monthFieldName}`
      );
    } else {
      console.log(`[Result] No records found for ${monthFieldName}`);
    }

    if (applyFilter) {
      console.log(`[Filter] Filtering for 'unpaid' or 'missing' status...`);
      records = records.filter((record) => {
        const statusValue = record.Status || record.status;
        const lowerStatus = statusValue
          ? String(statusValue).trim().toLowerCase()
          : null;
        return !lowerStatus || lowerStatus === "unpaid" || lowerStatus === "missing";
      });
      console.log(`[Filter] Found ${records.length} matching records.`);
    }

    const formattedRecords = records.map(formatRecordForDisplay);

    return {
      success: true,
      month,
      filter: filterArg || "all",
      recordCount: formattedRecords.length,
      records: formattedRecords,
    };
  } finally {
    await mongoClient?.close();
  }
}

module.exports = { getRentReconciliationReport };
