"use strict";

const express = require("express");
const { getSheetsClient } = require("./src/auth");
const { agreementSigned } = require("./src/services/sheets/agreementSigned");
const { WEBHOOK_CONFIG, WRITE_SCOPE } = require("./src/config");

const app = express();
const PORT = WEBHOOK_CONFIG.port || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Webhook endpoint for agreement signing
app.post("/webhook/agreement-signed", async (req, res) => {
  try {
    console.log("\n=== Webhook Received: Agreement Signed ===");
    console.log("Headers:", JSON.stringify(req.headers, null, 2));
    console.log("Body:", JSON.stringify(req.body, null, 2));

    // Validate webhook secret if configured
    if (WEBHOOK_CONFIG.secret) {
      const signature =
        req.headers["x-webhook-signature"] || req.headers["authorization"];
      if (!signature || !signature.includes(WEBHOOK_CONFIG.secret)) {
        console.error("Invalid webhook signature");
        return res.status(401).json({ error: "Unauthorized" });
      }
    }

    // Extract lease data from webhook payload
    const leaseData = extractLeaseData(req.body);

    if (!leaseData.tenantName || !leaseData.apartment) {
      return res.status(400).json({
        error: "Missing required fields: tenantName and apartment",
      });
    }

    // Get authenticated sheets client
    const sheets = getSheetsClient([WRITE_SCOPE]);

    // Process the signed agreement
    const result = await agreementSigned(sheets, leaseData);

    console.log("Agreement processed successfully:", result);
    res.json({
      success: true,
      message: "Agreement signed and sheets updated",
      ...result,
    });
  } catch (error) {
    console.error("Webhook error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Extract lease data from various webhook formats
function extractLeaseData(body) {
  // Support multiple webhook formats (DocuSign, HelloSign, custom, etc.)
  return {
    tenantName: body.tenantName || body.tenant_name || body.signer_name,
    apartment: body.apartment || body.property_address,
    room: body.room || body.room_number,
    startDate: body.startDate || body.start_date || body.lease_start,
    endDate: body.endDate || body.end_date || body.lease_end,
    amount: body.amount || body.rent || body.monthly_rent,
    prorate: body.prorate || body.prorated_rent,
    contact: body.contact || body.phone || body.contact_number,
    email: body.email || body.tenant_email,
    spreadsheetId: body.spreadsheetId || body.spreadsheet_id,
    documentId: body.documentId || body.document_id,
    signedAt: body.signedAt || body.signed_at || new Date().toISOString(),
  };
}

// Start server
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🚀 Webhook server running on port ${PORT}`);
    console.log(
      `📍 Webhook URL: http://localhost:${PORT}/webhook/agreement-signed`
    );
    console.log(
      `🔒 Secret protection: ${WEBHOOK_CONFIG.secret ? "Enabled" : "Disabled"}`
    );
  });
}

module.exports = { app };
