'use strict';

const { INVENTORY_SPREADSHEET_ID } = require('../config');
const {
    generateReconciliationReport,
} = require('../services/reconciliationReport/reconciliationReportPdf');
const {
    sendReconciliationEmail,
} = require('../services/email/sendReconciliationEmail');

async function reconciliationReport({ sheets, args, flags }) {
    const spreadsheetId =
        args[1] || flags.spreadsheetId || INVENTORY_SPREADSHEET_ID;
    const sheetName = 'Rent Reconciliation';
    const range = `${sheetName}!A5:J500`; // Fetch data from row 5 down to 500

    if (!spreadsheetId) {
        throw new Error(
            'Spreadsheet ID is required. Use as first argument or set INVENTORY_SPREADSHEET_ID in config.',
        );
    }

    console.log(`Fetching data from ${sheetName} sheet...`);

    // 1. Fetch data from Google Sheets
    const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range,
    });

    const rows = response.data.values || [];

    if (rows.length === 0) {
        console.warn(`No data found in ${range}.`);
        return { status: 'warning', message: 'No reconciliation data found.' };
    }

    // 2. Filter out completely empty rows or rows without a status
    const validData = rows.filter((row) => row.length > 0 && row[0]);

    if (validData.length === 0) {
        console.warn('No valid reconciliation records found.');
        return { status: 'warning', message: 'No valid records to report.' };
    }

    console.log(`Found ${validData.length} records. Generating report...`);

    // 3. Generate PDF Report (as buffer)
    const pdfBuffer = await generateReconciliationReport(validData);

    // 4. Send Email
    const dateStr = new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });

    console.log(`Emailing report to self...`);
    await sendReconciliationEmail(pdfBuffer, dateStr);

    return {
        status: 'success',
        message: `Report generated and emailed for ${validData.length} records.`,
        stats: {
            total: validData.length,
            matches: validData.filter((r) => r[0] === 'MATCH').length,
        },
    };
}

module.exports = { reconciliationReport };
