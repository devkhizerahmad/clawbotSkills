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
  const amount = leaseStr.match(/amount (\d+)/i)?.[1]?.trim();

  // Prorate
  const prorateRaw = leaseStr.match(/prorate (\d+)/i)?.[1]?.trim();

  // Contact
  const contact = leaseStr.match(/number\s*(?:is)?\s*(\d+)/i)?.[1]?.trim();

  // Email
  const email = leaseStr
    .match(/email\s*(?:is)?\s*([^\s$.]+@[^\s$.]+\.[^\s$.]+)/i)?.[1]
    ?.trim();

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
  };

  const pdfPath = await generateAgreementPdf(agreementData, true);

  // 2. Send Email
  if (email) {
    console.log(`Sending agreement to ${email}...`);
    await sendAgreementEmail(email, tenantName, pdfPath);
  } else {
    console.log('No email provided, skipping email sending.');
  }

  // 3. Ask for Confirmation
  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const confirmed = await new Promise((resolve) => {
    readline.question(
      '\nHas the agreement been signed? (yes/no): ',
      (answer) => {
        readline.close();
        resolve(answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y');
      },
    );
  });

  if (!confirmed) {
    return {
      success: false,
      message: 'Lease update cancelled by user (agreement not signed).',
      pdfPath,
    };
  }

  console.log('\nConfirmed! Updating sheets...');
  const sheetName = 'Inventory';

  // 4. Search for the address in the Inventory sheet
  console.log(`Searching for apartment: ${apartment} in ${sheetName}...`);
  const invResp = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!A:A`,
  });

  const rows = invResp.data.values || [];
  let rowIndex = -1;

  for (let i = 0; i < rows.length; i++) {
    if (
      rows[i][0] &&
      rows[i][0].toLowerCase().includes(apartment.toLowerCase())
    ) {
      rowIndex = i + 1; // 1-indexed
      break;
    }
  }

  if (rowIndex === -1) {
    throw new Error(
      `Apartment "${apartment}" not found in ${sheetName} sheet.`,
    );
  }

  console.log(
    `Found apartment at row ${rowIndex}. Updating Inventory Sheet...`,
  );

  // 5. Update Inventory Sheet
  const updates = [
    { range: `${sheetName}!D${rowIndex}`, values: [[tenantName]] },
    { range: `${sheetName}!E${rowIndex}`, values: [[startDate]] },
    { range: `${sheetName}!F${rowIndex}`, values: [[`$${amount}`]] },
    { range: `${sheetName}!G${rowIndex}`, values: [[`$${prorate}`]] },
    { range: `${sheetName}!W${rowIndex}`, values: [['Occupied']] },
  ];

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      valueInputOption: 'USER_ENTERED',
      data: updates,
    },
  });

  // --- Update Cleaning Sheet ---
  try {
    const cleaningSheetName = 'Cleaning';
    const cleaningResp = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${cleaningSheetName}!C:C`,
    });
    const cleaningRows = cleaningResp.data.values || [];
    let cleaningRowIndex = -1;
    for (let i = 0; i < cleaningRows.length; i++) {
      if (
        cleaningRows[i][0] &&
        cleaningRows[i][0].toLowerCase().includes(apartment.toLowerCase())
      ) {
        cleaningRowIndex = i + 1;
        break;
      }
    }

    if (cleaningRowIndex !== -1 && room) {
      console.log(`Updating Cleaning sheet for Room ${room}...`);
      const roomNum = parseInt(room, 10);
      const contactVal = contact || email || '';
      // Room 1: AD(29), AE(30) | Room 2: AG(32), AH(33) | Room 3: AJ(35), AK(36)
      const tenantColLetters = ['AD', 'AG', 'AJ'];
      const contactColLetters = ['AE', 'AH', 'AK'];

      if (roomNum >= 1 && roomNum <= 3) {
        const tCol = tenantColLetters[roomNum - 1];
        const cCol = contactColLetters[roomNum - 1];
        await sheets.spreadsheets.values.batchUpdate({
          spreadsheetId,
          requestBody: {
            valueInputOption: 'USER_ENTERED',
            data: [
              {
                range: `${cleaningSheetName}!${tCol}${cleaningRowIndex}`,
                values: [[tenantName]],
              },
              {
                range: `${cleaningSheetName}!${cCol}${cleaningRowIndex}`,
                values: [[contactVal]],
              },
            ],
          },
        });
      }
    }
  } catch (err) {
    console.error('Failed to update Cleaning sheet:', err.message);
  }

  // --- Update Rent Tracker Sheet ---
  try {
    const rentSheetName = 'Rent Tracker';
    const rentResp = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${rentSheetName}!B:C`,
    });
    const rentRows = rentResp.data.values || [];
    let rentRowIndex = -1;
    for (let i = 0; i < rentRows.length; i++) {
      const rowApt = rentRows[i][0] || '';
      const rowRoom = rentRows[i][1] || '';
      if (
        rowApt.toLowerCase().includes(apartment.toLowerCase()) &&
        rowRoom == room
      ) {
        rentRowIndex = i + 1;
        break;
      }
    }

    if (rentRowIndex !== -1) {
      console.log(`Updating Rent Tracker sheet row ${rentRowIndex}...`);
      // D: Who, E: Rent, G: Email, H: Phone
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId,
        requestBody: {
          valueInputOption: 'USER_ENTERED',
          data: [
            {
              range: `${rentSheetName}!D${rentRowIndex}`,
              values: [[tenantName]],
            },
            {
              range: `${rentSheetName}!E${rentRowIndex}`,
              values: [[`$${amount}`]],
            },
            {
              range: `${rentSheetName}!G${rentRowIndex}`,
              values: [[email || '']],
            },
            {
              range: `${rentSheetName}!H${rentRowIndex}`,
              values: [[contact || '']],
            },
          ],
        },
      });
    }
  } catch (err) {
    console.error('Failed to update Rent Tracker sheet:', err.message);
  }

  // --- Update Inventory Data Sheet ---
  try {
    const invDataSheetName = 'Inventory Data';
    const invDataResp = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${invDataSheetName}!B:C`,
    });
    const invDataRows = invDataResp.data.values || [];
    let invDataRowIndex = -1;
    let currentApt = '';

    for (let i = 0; i < invDataRows.length; i++) {
      const rowApt = invDataRows[i][0];
      const rowRoom = invDataRows[i][1];

      if (rowApt && rowApt.trim() !== '') {
        currentApt = rowApt.trim();
      }

      if (
        currentApt.toLowerCase().includes(apartment.toLowerCase()) &&
        rowRoom == room
      ) {
        invDataRowIndex = i + 1;
        break;
      }
    }

    if (invDataRowIndex !== -1) {
      console.log(`Updating Inventory Data sheet row ${invDataRowIndex}...`);
      // D: Who (column 4), E: Total Rent (column 5)
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId,
        requestBody: {
          valueInputOption: 'USER_ENTERED',
          data: [
            {
              range: `${invDataSheetName}!D${invDataRowIndex}`,
              values: [[tenantName]],
            },
            {
              range: `${invDataSheetName}!E${invDataRowIndex}`,
              values: [[`$${amount}`]],
            },
          ],
        },
      });
    }
  } catch (err) {
    console.error('Failed to update Inventory Data sheet:', err.message);
  }

  // 6. Audit Log
  await logAudit(sheets, spreadsheetId, {
    sheet: sheetName,
    cell: `D${rowIndex}:W${rowIndex}`,
    oldValue: 'Available',
    newValue: `Leased to ${tenantName} ($${amount})`,
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
