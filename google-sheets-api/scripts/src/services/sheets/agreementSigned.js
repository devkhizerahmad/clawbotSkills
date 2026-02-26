"use strict";

const { logAudit } = require("../audit/logAudit");
const { INVENTORY_SPREADSHEET_ID } = require("../../config");

/**
 * Process a signed lease agreement and update all relevant sheets
 * This is called by the webhook when an agreement is signed
 */
async function agreementSigned(sheets, leaseData) {
  const {
    tenantName,
    apartment,
    room,
    startDate,
    endDate,
    amount,
    prorate,
    contact,
    email,
    spreadsheetId = INVENTORY_SPREADSHEET_ID,
    signedAt,
  } = leaseData;

  console.log("\n=== Processing Signed Agreement ===");
  console.log("Tenant:", tenantName);
  console.log("Apartment:", apartment);
  console.log("Room:", room);
  console.log("Start:", startDate, "| End:", endDate);
  console.log("Amount:", amount, "| Prorate:", prorate);
  console.log("Contact:", contact, "| Email:", email);
  console.log("Signed at:", signedAt);

  const sheetName = "Inventory";
  const prorateValue = prorate || amount;

  // 1. Search for the apartment in the Inventory sheet
  console.log(`\nSearching for apartment: ${apartment} in ${sheetName}...`);
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
      `Apartment "${apartment}" not found in ${sheetName} sheet.`
    );
  }

  console.log(`Found apartment at row ${rowIndex}. Updating sheets...`);

  // 2. Update Inventory Sheet
  console.log("Updating Inventory Sheet...");
  const updates = [
    { range: `${sheetName}!D${rowIndex}`, values: [[tenantName]] },
    { range: `${sheetName}!E${rowIndex}`, values: [[startDate]] },
    { range: `${sheetName}!F${rowIndex}`, values: [[`$${amount}`]] },
    { range: `${sheetName}!G${rowIndex}`, values: [[`$${prorateValue}`]] },
    { range: `${sheetName}!W${rowIndex}`, values: [["Occupied"]] },
  ];

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      valueInputOption: "USER_ENTERED",
      data: updates,
    },
  });

  // 3. Update Cleaning Sheet
  try {
    const cleaningSheetName = "Cleaning";
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
      const contactVal = contact || email || "";
      // Room 1: AD(29), AE(30) | Room 2: AG(32), AH(33) | Room 3: AJ(35), AK(36)
      const tenantColLetters = ["AD", "AG", "AJ"];
      const contactColLetters = ["AE", "AH", "AK"];

      if (roomNum >= 1 && roomNum <= 3) {
        const tCol = tenantColLetters[roomNum - 1];
        const cCol = contactColLetters[roomNum - 1];
        await sheets.spreadsheets.values.batchUpdate({
          spreadsheetId,
          requestBody: {
            valueInputOption: "USER_ENTERED",
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
    console.error("Failed to update Cleaning sheet:", err.message);
  }

  // 4. Update Rent Tracker Sheet
  try {
    const rentSheetName = "Rent Tracker";
    const rentResp = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${rentSheetName}!B:C`,
    });
    const rentRows = rentResp.data.values || [];
    let rentRowIndex = -1;
    for (let i = 0; i < rentRows.length; i++) {
      const rowApt = rentRows[i][0] || "";
      const rowRoom = rentRows[i][1] || "";
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
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId,
        requestBody: {
          valueInputOption: "USER_ENTERED",
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
              values: [[email || ""]],
            },
            {
              range: `${rentSheetName}!H${rentRowIndex}`,
              values: [[contact || ""]],
            },
          ],
        },
      });
    }
  } catch (err) {
    console.error("Failed to update Rent Tracker sheet:", err.message);
  }

  // 5. Update Inventory Data Sheet
  try {
    const invDataSheetName = "Inventory Data";
    const invDataResp = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${invDataSheetName}!B:C`,
    });
    const invDataRows = invDataResp.data.values || [];
    let invDataRowIndex = -1;
    let currentApt = "";

    for (let i = 0; i < invDataRows.length; i++) {
      const rowApt = invDataRows[i][0];
      const rowRoom = invDataRows[i][1];

      if (rowApt && rowApt.trim() !== "") {
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
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId,
        requestBody: {
          valueInputOption: "USER_ENTERED",
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
    console.error("Failed to update Inventory Data sheet:", err.message);
  }

  // 6. Audit Log
  await logAudit(sheets, spreadsheetId, {
    sheet: sheetName,
    cell: `D${rowIndex}:W${rowIndex}`,
    oldValue: "Available",
    newValue: `Leased to ${tenantName} ($${amount}) - Signed via Webhook`,
    source: "WEBHOOK_AGREEMENT_SIGNED",
  });

  console.log("✅ All sheets updated successfully!");

  return {
    rowIndex,
    apartment,
    tenantName,
    amount,
    updatedSheets: ["Inventory", "Cleaning", "Rent Tracker", "Inventory Data"],
  };
}

module.exports = { agreementSigned };
