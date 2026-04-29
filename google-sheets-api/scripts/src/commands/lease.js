'use strict';

const {
  generateAgreementPdf,
} = require('../services/generateAgreement/generateAgreement');
const { sendAgreementEmail } = require('../services/email/sendAgreementEmail');
const {
  saveLeaseContract,
  emailExists,
  saveContractEmail,
} = require('../services/mongodb/mongodbService');
const {
  hasEmailInLocal,
  addEmailInLocal,
} = require('../services/email/registerEmail');
const { updateLeaseSheets } = require('../services/lease/leaseService');
const { INVENTORY_SPREADSHEET_ID } = require('../config');

async function lease({ sheets, args, flags, command }) {
  const commandArgs = args.slice(1);
  let spreadsheetId = INVENTORY_SPREADSHEET_ID;
  let leaseStr = commandArgs.join(' ');
  leaseStr = leaseStr.replace(/\s+/g, ' ').trim();

  const auditUser = flags.user || 'LEASE_CMD';

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

  let tenantName = leaseStr.match(/^(.*?) has leased/i)?.[1]?.trim();

  if (!tenantName) {
    tenantName = leaseStr.match(/ to ([a-z .'-]+?) from/i)?.[1]?.trim();
  }

  const apartment =
    leaseStr.match(/apartment (.*?) Room/i)?.[1]?.trim() ||
    leaseStr.match(/apartment (.*?) to/i)?.[1]?.trim() ||
    leaseStr.match(/apartment (.*?) from/i)?.[1]?.trim();

  const room = leaseStr.match(/Room (\d+)/i)?.[1]?.trim();

  const startDate = leaseStr.match(/from (.*?) to/i)?.[1]?.trim();
  const endDate = leaseStr.match(
    /from\s+\d{1,2}\/\d{1,2}\/\d{4}\s+to\s+(\d{1,2}\/\d{1,2}\/\d{4})/i,
  )?.[1];
  const amountMatch = leaseStr.match(/(?:amount|for)\s*\$?(\d+)/i);
  const amount = amountMatch?.[1]?.trim();

  const prorateMatch = leaseStr.match(/prorate\s*\$?(\d+)/i);
  const prorateRaw = prorateMatch?.[1]?.trim();

  const contact = leaseStr
    .match(/(?:number|contact)\s*(?:is)?\s*(\d+)/i)?.[1]
    ?.trim();

  const emailMatch = leaseStr.match(
    /(?:email|emails)\s*(?:is)?\s*([^\s$.]+@[^\s$.]+\.[^\s$.]+)/i,
  );
  const email = emailMatch?.[1]?.trim();

  const prorate = prorateRaw;

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
  const pdfPath = await generateAgreementPdf(agreementData, true, false);

  // 2. Save Lease to MongoDB
  console.log('Saving lease to MongoDB...');
  const leaseId = await saveLeaseContract({
    ...agreementData,
    pdfPath,
  });

  // 3. Update Spreadsheets
  console.log('Updating spreadsheets...');
  await updateLeaseSheets({
    sheets,
    spreadsheetId,
    data: agreementData,
    auditUser,
  });

  // 4. Send Email
  const emailAlreadyExists = email ? await emailExists(email) : false;
  const emailAlreadyInLocal = email ? hasEmailInLocal(email) : false;

  if (email && !emailAlreadyExists && !emailAlreadyInLocal) {
    console.log(`Sending agreement to ${email}...`);

    await sendAgreementEmail(email, tenantName, pdfPath);
    console.log('Saving contract email to MongoDB...');
    await saveContractEmail(leaseId, email);
    console.log('Adding email to local registry...');
    addEmailInLocal(email);
    console.log('Email sent successfully');
    
    // NOTE: Email sending action is recorded via saveContractEmail audit log in mongodbService
  } else {
    console.log('No email provided or email already processed, skipping email sending.');
  }

  return {
    success: true,
    message: `Apartment ${apartment} leased to ${tenantName} successfully.`,
    pdfPath,
    emailSent: !!email && !emailAlreadyExists && !emailAlreadyInLocal,
  };
}

module.exports = { lease };
