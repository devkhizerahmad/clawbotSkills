'use strict';

const { logAudit } = require('../services/audit/logAudit');
const {
  generateAgreementPdf,
} = require('../services/generateAgreement/generateAgreement');
const { sendAgreementEmail } = require('../services/email/sendAgreementEmail');
const { INVENTORY_SPREADSHEET_ID } = require('../config');

async function lease({ sheets, args, flags, command }) {
  const commandArgs = args.slice(1);
  let spreadsheetId = INVENTORY_SPREADSHEET_ID;
  let leaseStr = commandArgs.join(' ');
  leaseStr = leaseStr.replace(/\s+/g, ' ').trim();

  // Get audit user from flags
  const auditUser = flags.user || 'LEASE_CMD';

  // If first arg looks like a spreadsheet ID (long alphanumeric) and not lease text
  if (
    commandArgs[0] &&
    commandArgs[0].length > 20 &&
    !commandArgs[0].includes(' ')
  ) {
    spreadsheetId = commandArgs[0];
    leaseStr = commandArgs.slice(1).join(' ');
  }

  if (!leaseStr) {
    throw new Error('Please provide the lease details string.');
  }

  // Audit log for lease operation start
  await logAudit({
    user: auditUser,
    sheet: 'Lease_Start',
    cell: 'N/A',
    oldValue: 'N/A',
    newValue: `Starting lease command with details: ${leaseStr.substring(0, 100)}...`,
    source: 'LEASE_CMD',
  });

  // Regex Parsing
  // const tenantName = leaseStr.match(/^(.*?) has leased/i)?.[1]?.trim();
  // const apartment =
  //   leaseStr.match(/apartment (.*?) Room/i)?.[1]?.trim() ||
  //   leaseStr.match(/apartment (.*?) from/i)?.[1]?.trim();
  // const room = leaseStr.match(/Room (\d+)/i)?.[1]?.trim();
  // const startDate = leaseStr.match(/from (.*?) to/i)?.[1]?.trim();
  // const endDate = leaseStr.match(/to (.*?) for/i)?.[1]?.trim();
  // const amount = leaseStr.match(/amount (\d+)/i)?.[1]?.trim();
  // const prorateRaw = leaseStr.match(/prorate (\d+)/i)?.[1]?.trim();
  // const contact = leaseStr.match(/number (\d+)/i)?.[1]?.trim();
  // const email =
  //   leaseStr.match(/email ([^\s$.]+@[^\s$.]+\.[^\s$.]+)/i)?.[1]?.trim() ||
  //   leaseStr.match(/email ([^\s$.]+)/i)?.[1]?.trim();

  // const prorate = prorateRaw || amount;

  let tenantName = leaseStr.match(/^(.*?) has leased/i)?.[1]?.trim();

  // Try format 2: "Apartment ... to Usman"
  if (!tenantName) {
    tenantName = leaseStr.match(/ to ([a-z .'-]+?) from/i)?.[1]?.trim();
  }

  // Apartment extraction
  const apartment =
    leaseStr.match(/apartment (.*?) Room/i)?.[1]?.trim() ||
    leaseStr.match(/apartment (.*?) to/i)?.[1]?.trim() ||
    leaseStr.match(/apartment (.*?) from/i)?.[1]?.trim();

  // Room
  const room = leaseStr.match(/Room (\d+)/i)?.[1]?.trim();

  // Dates
  const startDate = leaseStr.match(/from (.*?) to/i)?.[1]?.trim();
  const endDate = leaseStr.match(
    /from\s+\d{1,2}\/\d{1,2}\/\d{4}\s+to\s+(\d{1,2}\/\d{1,2}\/\d{4})/i,
  )?.[1];
  // Rent
  const amountMatch = leaseStr.match(/(?:amount|for)\s*\$?(\d+)/i);
  const amount = amountMatch?.[1]?.trim();

  // Prorate
  const prorateMatch = leaseStr.match(/prorate\s*\$?(\d+)/i);
  const prorateRaw = prorateMatch?.[1]?.trim();

  // Contact
  const contact = leaseStr
    .match(/(?:number|contact)\s*(?:is)?\s*(\d+)/i)?.[1]
    ?.trim();

  // Email
  const emailMatch = leaseStr.match(
    /(?:email|emails)\s*(?:is)?\s*([^\s$.]+@[^\s$.]+\.[^\s$.]+)/i,
  );
  const email = emailMatch?.[1]?.trim();

  const prorate = prorateRaw || amount;

  if (!tenantName || !apartment || !startDate || !endDate || !amount) {
    throw new Error(
      'Could not parse all required lease details. Please check the string format.',
    );
  }

  console.log('Parsed details:');
  console.log('Tenant Name:', tenantName);
  console.log('Apartment:', apartment);
  console.log('Room:', room);
  console.log('Start Date:', startDate);
  console.log('End Date:', endDate);
  console.log('Amount:', amount);
  console.log('Prorate:', prorate);
  console.log('Contact:', contact);
  console.log('Email:', email);

  // Audit log for parsed lease details
  await logAudit({
    user: auditUser,
    sheet: 'Lease_Details',
    cell: 'N/A',
    oldValue: 'Raw Text',
    newValue: `Tenant: ${tenantName}, Apartment: ${apartment}, Room: ${room || 'N/A'}, Rent: $${amount}, Prorate: $${prorate}, Period: ${startDate} to ${endDate}, Contact: ${contact || 'N/A'}, Email: ${email || 'N/A'}`,
    source: 'LEASE_CMD',
  });

  // 1. Generate Agreement PDF First
  console.log('Generating agreement PDF...');
  const agreementData = {
    tenantName,
    sublessorName: 'Hive NY',
    propertyAddress: apartment,
    rent: amount,
    proRateRent: prorate,
    securityDeposit: amount,
    leaseStartDate: startDate,
    leaseEndDate: endDate,
    agreementDate: new Date().toISOString().split('T')[0],
    room,
    contact,
    email,
  };

  // Audit log for PDF generation start
  await logAudit({
    user: auditUser,
    sheet: 'Lease_PDF',
    cell: 'N/A',
    oldValue: 'Agreement not generated',
    newValue: `Generating lease agreement PDF for ${tenantName} - Apartment: ${apartment}, Rent: $${amount}, Deposit: $${amount}`,
    source: 'LEASE_CMD',
  });

  // const addSublesseeSignature =
  //   flags.addSublesseeSignature !== 'false' &&
  //   flags.addSublesseeSignature !== false;
  const pdfPath = await generateAgreementPdf(agreementData, true, false);

  // Audit log for PDF generation completion
  await logAudit({
    user: auditUser,
    sheet: 'Lease_PDF',
    cell: 'N/A',
    oldValue: 'PDF generation in progress',
    newValue: `PDF generated successfully: ${pdfPath}`,
    source: 'LEASE_CMD',
  });

  // 2. Send Email
  if (email) {
    console.log(`Sending agreement to ${email}...`);

    // // Audit log for email sending
    // await logAudit({
    //   user: auditUser,
    //   sheet: 'Lease_Email',
    //   cell: 'N/A',
    //   oldValue: 'Email pending',
    //   newValue: `Sending lease agreement to ${email} for ${tenantName}`,
    //   source: 'LEASE_CMD',
    // });

    await sendAgreementEmail(email, tenantName, pdfPath);

    // Audit log for email sent
    await logAudit({
      user: auditUser,
      sheet: 'Lease_Email',
      cell: 'N/A',
      oldValue: 'Email queued for sending',
      newValue: `Lease agreement sent successfully to ${email} for ${tenantName}`,
      source: 'LEASE_CMD',
    });
  } else {
    console.log('No email provided, skipping email sending.');

    // Audit log for skipped email
    await logAudit({
      user: auditUser,
      sheet: 'Lease_Email',
      cell: 'N/A',
      oldValue: 'Email field empty in lease details',
      newValue: 'Email sending skipped - no email provided',
      source: 'LEASE_CMD',
    });
  }

  // Final audit log for lease operation completion
  await logAudit({
    user: auditUser,
    sheet: 'Lease_Completion',
    cell: 'N/A',
    oldValue: 'Operation Started',
    newValue: `Lease operation completed successfully for ${tenantName} - Apartment: ${apartment}, Room: ${room || 'N/A'}, Rent: $${amount}, PDF: ${pdfPath}`,
    source: 'LEASE_CMD',
  });

  return {
    success: true,
    message: `Apartment ${apartment} leased to ${tenantName} successfully.`,
    pdfPath,
    emailSent: !!email,
  };
}

module.exports = { lease };
