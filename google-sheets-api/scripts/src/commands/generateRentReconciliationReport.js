"use strict";

const path = require("path");
const { INVENTORY_SPREADSHEET_ID } = require("../config");
const {
  generateReconciliationReport,
} = require("../services/reconciliationReport/reconciliationReport");
const { sendReportEmail } = require("../services/email/sendReportEmail");

const DEFAULT_RANGE = "'Rent Reconciliation'!A:J";

function resolveArgs(args, flags) {
  const spreadsheetId = args[1] || INVENTORY_SPREADSHEET_ID;
  const range = flags.range || flags.r || args[2] || DEFAULT_RANGE;
  const outputPathFlag = flags.output || flags.out;
  const outputPath = outputPathFlag || args[3];
  const date = flags.date;

  return { spreadsheetId, range, outputPath, date };
}

async function generateRentReconciliationReport({ sheets, args, flags }) {
  const { spreadsheetId, range, outputPath, date } = resolveArgs(args, flags);

  if (!spreadsheetId) {
    throw new Error(
      "Usage: generate_rent_reconciliation_report <spreadsheetId> [range] [outputPath]"
    );
  }

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
    valueRenderOption: "UNFORMATTED_VALUE",
  });

  let values = response.data.values || [];
  if (values.length === 0) {
    throw new Error(`No reconciliation data found in range: ${range}`);
  }

  if (date) {
    console.log(`Filtering report for date: ${date}`);
    const targetDate = new Date(date);
    if (isNaN(targetDate.getTime())) {
      throw new Error(
        `Invalid date provided: ${date}. Please use a valid date format like YYYY-MM-DD.`
      );
    }

    const headerRow = values[0];
    const dateColumnIndex = headerRow.findIndex(
      (header) => String(header).toLowerCase().trim() === "date"
    );

    if (dateColumnIndex === -1) {
      throw new Error(
        "A 'Date' column is required in the sheet to filter by date, but it was not found in the header row."
      );
    }

    const filteredData = values.slice(1).filter((row) => {
      const cellValue = row[dateColumnIndex];
      if (cellValue === null || cellValue === undefined || cellValue === "")
        return false;

      // Handle Google Sheets date serial numbers (UNFORMATTED_VALUE) and date strings
      const rowDate =
        typeof cellValue === "number"
          ? new Date(Date.UTC(1899, 11, 30) + cellValue * 24 * 60 * 60 * 1000)
          : new Date(cellValue);

      return (
        rowDate.getUTCFullYear() === targetDate.getUTCFullYear() &&
        rowDate.getUTCMonth() === targetDate.getUTCMonth() &&
        rowDate.getUTCDate() === targetDate.getUTCDate()
      );
    });

    if (filteredData.length === 0) {
      throw new Error(`No records found for the specified date: ${date}`);
    }

    values = [headerRow, ...filteredData];
  }

  const finalOutputPath =
    outputPath ||
    path.join(process.cwd(), `Reconciliation_Report_${Date.now()}.pdf`);

  const result = await generateReconciliationReport(values, finalOutputPath);

  const emailRecipient = "usmanbhullar383@gmail.com";
  try {
    const emailSubject = `Rent Reconciliation Report - ${new Date().toLocaleDateString()}`;
    const emailBody = `Please find the attached Rent Reconciliation Report, generated on ${new Date().toLocaleString()}.`;
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

  return {
    success: true,
    spreadsheetId,
    range,
    rowsRead: values.length,
    rowsIncluded: result.rowCount,
    outputPath: result.outputPath,
    fileSizeBytes: result.buffer.length,
    emailSentTo: emailRecipient,
  };
}

module.exports = { generateRentReconciliationReport };
