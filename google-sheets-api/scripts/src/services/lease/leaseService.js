'use strict';

const { logAudit } = require('../audit/logAudit');

/**
 * Updates all relevant sheets for a new lease.
 * @param {Object} params
 * @param {Object} params.sheets - Google Sheets client
 * @param {string} params.spreadsheetId
 * @param {Object} params.data - Lease data (tenantName, propertyAddress, rent, proRateRent, startDate, endDate, room, contact, email)
 */
async function updateLeaseSheets({ sheets, spreadsheetId, data, auditUser = 'LEASE_SERVICE' }) {
  const {
    tenantName,
    propertyAddress: apartment,
    rent: amount,
    proRateRent: prorate,
    leaseStartDate: startDate,
    leaseEndDate: endDate,
    room,
    contact,
    email,
  } = data;

  const sheetName = 'Inventory';

  // 1. Search for the address in the Inventory sheet
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

  // Get current values before updating for audit log
  const currentValuesResp = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!D${rowIndex}:U${rowIndex}`,
  });
  const currentValues = currentValuesResp.data.values?.[0] || [];
  const oldValueStr = currentValues.length > 0 
    ? `Tenant: ${currentValues[0] || 'N/A'}, Status: ${currentValues[4] || 'N/A'}`
    : 'No data';

  // 2. Update Inventory Sheet
  // Column U is "Status", E is "Availability"
  const updates = [
    { range: `${sheetName}!D${rowIndex}`, values: [[tenantName]] },
    { range: `${sheetName}!E${rowIndex}`, values: [[startDate]] },
    { range: `${sheetName}!F${rowIndex}`, values: [[`$${amount}`]] },
    { range: `${sheetName}!G${rowIndex}`, values: [[`$${prorate}`]] },
    { range: `${sheetName}!U${rowIndex}`, values: [['Occupied']] },
  ];

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      valueInputOption: 'USER_ENTERED',
      data: updates,
    },
  });

  // Audit Log for Inventory Sheet Update
  await logAudit({
    user: auditUser,
    sheet: sheetName,
    cell: `D${rowIndex}:U${rowIndex}`,
    oldValue: oldValueStr,
    newValue: `Tenant: ${tenantName}, Start: ${startDate}, Rent: $${amount}, Prorate: $${prorate}, Status: Occupied`,
    source: 'LEASE_SERVICE',
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
      const tenantColLetters = ['AD', 'AG', 'AJ'];
      const contactColLetters = ['AE', 'AH', 'AK'];

      if (roomNum >= 1 && roomNum <= 3) {
        const tCol = tenantColLetters[roomNum - 1];
        const cCol = contactColLetters[roomNum - 1];
        
        // Get current values for audit log
        const cleaningCurrentResp = await sheets.spreadsheets.values.get({
          spreadsheetId,
          range: `${cleaningSheetName}!${tCol}${cleaningRowIndex}:${cCol}${cleaningRowIndex}`,
        });
        const cleaningCurrentValues = cleaningCurrentResp.data.values?.[0] || [];
        const cleaningOldValueStr = cleaningCurrentValues.length > 0
          ? `Tenant: ${cleaningCurrentValues[0] || 'N/A'}, Contact: ${cleaningCurrentValues[1] || 'N/A'}`
          : 'No data';
        
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
        
        // Audit Log for Cleaning Sheet Update
        await logAudit({
          user: auditUser,
          sheet: cleaningSheetName,
          cell: `${tCol}${cleaningRowIndex}:${cCol}${cleaningRowIndex}`,
          oldValue: cleaningOldValueStr,
          newValue: `Room ${room}: Tenant: ${tenantName}, Contact: ${contactVal}`,
          source: 'LEASE_SERVICE',
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
      
      // Get current values for audit log
      const rentCurrentResp = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${rentSheetName}!D${rentRowIndex}:H${rentRowIndex}`,
      });
      const rentCurrentValues = rentCurrentResp.data.values?.[0] || [];
      const rentOldValueStr = rentCurrentValues.length > 0
        ? `Tenant: ${rentCurrentValues[0] || 'N/A'}, Rent: ${rentCurrentValues[1] || 'N/A'}`
        : 'No data';
      
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
      
      // Audit Log for Rent Tracker Sheet Update
      await logAudit({
        user: auditUser,
        sheet: rentSheetName,
        cell: `D${rentRowIndex}:H${rentRowIndex}`,
        oldValue: rentOldValueStr,
        newValue: `Room ${room}: Tenant: ${tenantName}, Rent: $${amount}, Email: ${email || 'N/A'}, Contact: ${contact || 'N/A'}`,
        source: 'LEASE_SERVICE',
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
      
      // Get current values for audit log
      const invDataCurrentResp = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${invDataSheetName}!D${invDataRowIndex}:E${invDataRowIndex}`,
      });
      const invDataCurrentValues = invDataCurrentResp.data.values?.[0] || [];
      const invDataOldValueStr = invDataCurrentValues.length > 0
        ? `Tenant: ${invDataCurrentValues[0] || 'N/A'}, Rent: ${invDataCurrentValues[1] || 'N/A'}`
        : 'No data';
      
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
      
      // Audit Log for Inventory Data Sheet Update
      await logAudit({
        user: auditUser,
        sheet: invDataSheetName,
        cell: `D${invDataRowIndex}:E${invDataRowIndex}`,
        oldValue: invDataOldValueStr,
        newValue: `Room ${room}: Tenant: ${tenantName}, Rent: $${amount}`,
        source: 'LEASE_SERVICE',
      });
    }
  } catch (err) {
    console.error('Failed to update Inventory Data sheet:', err.message);
  }

  // Final Audit Log for successful lease operation
  await logAudit({
    user: auditUser,
    sheet: 'Lease_Completion',
    cell: 'N/A',
    oldValue: 'Operation Started',
    newValue: `Lease completed successfully for ${tenantName} - Apartment: ${apartment}, Room: ${room || 'N/A'}, Rent: $${amount}, Period: ${startDate} to ${endDate || 'N/A'}`,
    source: 'LEASE_SERVICE',
  });

  return {
    success: true,
    message: `Apartment ${apartment} updated in sheets successfully.`,
  };
}

module.exports = { updateLeaseSheets };
