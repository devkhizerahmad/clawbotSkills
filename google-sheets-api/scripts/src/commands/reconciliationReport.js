'use strict';

const { logAudit } = require('../services/audit/logAudit');
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

    // Get audit user from flags
    const auditUser = flags.user || 'RECONCILIATION_CMD';

    if (!spreadsheetId) {
        throw new Error(
            'Spreadsheet ID is required. Use as first argument or set INVENTORY_SPREADSHEET_ID in config.',
        );
    }

    // Audit log for operation start
    await logAudit({
        user: auditUser,
        sheet: 'Reconciliation_Operation',
        cell: 'N/A',
        oldValue: 'N/A',
        newValue: `Starting rent reconciliation report generation`,
        source: 'RECONCILIATION_CMD',
    });

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

    // Audit log for data fetch success
    await logAudit({
        user: auditUser,
        sheet: 'Reconciliation_Data',
        cell: 'N/A',
        oldValue: 'N/A',
        newValue: `Fetched ${validData.length} reconciliation records from ${sheetName}`,
        source: 'RECONCILIATION_CMD',
    });

    // 3. Generate PDF Report (as buffer)
    const pdfBuffer = await generateReconciliationReport(validData);

    // Audit log for PDF generation
    await logAudit({
        user: auditUser,
        sheet: 'Reconciliation_PDF',
        cell: 'N/A',
        oldValue: 'PDF not generated',
        newValue: `Generated reconciliation report PDF with ${validData.length} records`,
        source: 'RECONCILIATION_CMD',
    });

    // 4. Send Email
    const dateStr = new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });

    console.log(`Emailing report to self...`);
    await sendReconciliationEmail(pdfBuffer, dateStr, auditUser);

    // Audit log for email sent
    await logAudit({
        user: auditUser,
        sheet: 'Reconciliation_Email',
        cell: 'N/A',
        oldValue: 'Email not sent',
        newValue: `Reconciliation report emailed successfully with ${validData.length} records (${stats.matches} matches)`,
        source: 'RECONCILIATION_CMD',
    });

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
