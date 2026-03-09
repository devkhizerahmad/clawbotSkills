"use strict";

const path = require("path");
const { getMongoClient } = require("../db/mongo");
const {
  generateReconciliationReport,
} = require("../services/reconciliationReport/reconciliationReport");
const { sendReportEmail } = require("../services/email/sendReportEmail");

const MONTH_NAMES = [
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

/**
 * Maps a raw MongoDB rent_reconciliation record to the field names
 * expected by the reconciliation PDF service.
 */
function mapRecordForPdf(record) {
  return {
    status: String(record.status || "").toUpperCase(),
    tenantName: record.tenantName || "",
    paysAs: record.paysAs || "",
    email: record.email || "",
    phone: String(record.phone || ""),
    apartment: record.apt || record.address || "",
    room: String(record.roomNo || ""),
    expectedRent: record.expectedRent,
    actualAmount: record.actualAmount,
    difference: record.difference,
  };
}

/**
 * Fetches rent reconciliation data from MongoDB for a given month and
 * generates a PDF report containing only unpaid / missing tenants,
 * using the same layout as the full Rent Reconciliation Report.
 */
async function getUnpaidRentReport({ args, flags }) {
  const month = args[1] || flags.month;

  if (!month) {
    throw new Error(
      'A month must be provided. Usage: get_unpaid_rent_report <month> (e.g., "YYYY-MM")'
    );
  }

  if (!/^\d{4}-\d{2}$/.test(month)) {
    throw new Error(
      'Invalid month format. Please use YYYY-MM (e.g., "2026-03").'
    );
  }

  const [year, monthNum] = month.split("-").map(Number);
  const monthFieldName = `${MONTH_NAMES[monthNum - 1]} ${year}`;

  console.log(`[Query] Fetching unpaid records for: ${monthFieldName}`);

  let mongoClient;
  try {
    mongoClient = await getMongoClient();
    const db = mongoClient.db();
    const collection = db.collection("rent_reconciliation");

    const document = await collection.findOne({
      [monthFieldName]: { $exists: true },
    });

    let allRecords = [];
    if (document && Array.isArray(document[monthFieldName])) {
      allRecords = document[monthFieldName];
      console.log(
        `[Query] Found ${allRecords.length} total records for ${monthFieldName}`
      );
    } else {
      console.log(`[Query] No records found for ${monthFieldName}`);
    }

    // Keep only unpaid / missing tenants
    const unpaid = allRecords.filter((r) => {
      const s = String(r.status || r.Status || "")
        .trim()
        .toLowerCase();
      return s === "missing" || s === "unpaid" || s === "mismatch";
    });

    console.log(
      `[Filter] ${unpaid.length} unpaid/missing records out of ${allRecords.length} total`
    );

    if (unpaid.length === 0) {
      console.log(
        `[Result] No unpaid or missing records found for ${monthFieldName}`
      );
      return {
        success: true,
        month,
        recordCount: 0,
        message: `No unpaid or missing records found for ${monthFieldName}`,
      };
    }

    // Map MongoDB fields → PDF service field names
    const pdfData = unpaid.map(mapRecordForPdf);

    // Generate PDF in the same format as the full reconciliation report
    const outputPath =
      flags.outputPath ||
      path.join(process.cwd(), `Unpaid_Rent_Report_${month}_${Date.now()}.pdf`);

    const result = await generateReconciliationReport(pdfData, outputPath);

    console.log(`[PDF] Report saved to: ${result.outputPath}`);
    console.log(`[PDF] ${result.rowCount} rows written`);

    const emailRecipient = "usmanbhullar383@gmail.com";
    try {
      const emailSubject = `Unpaid Rent Reconciliation Report (${month}) - ${new Date().toLocaleDateString()}`;
      const emailBody = `Please find the attached Unpaid Rent Reconciliation Report for ${month}, generated on ${new Date().toLocaleString()}.`;
      await sendReportEmail(
        emailRecipient,
        emailSubject,
        emailBody,
        result.outputPath
      );
      console.log(`Report email successfully sent to ${emailRecipient}.`);
    } catch (emailError) {
      console.error(`Failed to send report email: ${emailError.message}`);
      // Do not throw, as the primary goal (PDF generation) was successful.
    }

    // Format records for output — exact column order as requested
    const formattedRecords = unpaid.map((record) => ({
      Status: String(record.status || record.Status || "MISSING").toUpperCase(),
      "Tenant Name": record.tenantName || record["Tenant Name"] || "",
      "Pays As": record.paysAs || record["Pays As"] || "",
      Email: record.email || record["Email"] || "",
      Phone: String(record.phone || record["Phone"] || ""),
      Apartment: record.apt || record.address || record["Apartment"] || "",
      Room: String(record.roomNo || record["Room"] || ""),
      "Expected Rent": record.expectedRent ?? record["Expected Rent"] ?? 0,
      "Actual Amount":
        record.actualAmount ??
        record["Actual Amount"] ??
        record["Actual Payment"] ??
        0,
      Difference: record.difference ?? record["Difference"] ?? 0,
    }));

    return {
      success: true,
      month,
      recordCount: unpaid.length,
      outputPath: result.outputPath,
      records: formattedRecords,
      emailSentTo: emailRecipient,
    };
  } finally {
    await mongoClient?.close();
  }
}

module.exports = { getUnpaidRentReport };
