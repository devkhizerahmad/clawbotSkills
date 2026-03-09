#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');

// Load environment variables
require('dotenv').config();

// MongoDB connection
const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI;
const DB_NAME = 'rent_reconciliation_db';
const COLLECTION_NAME = 'rent_reconciliation';

async function generateRentReconciliationPDF() {
  console.log('[PDF] Generating rent reconciliation PDF...');

  try {
    // Check MongoDB URI
    if (!MONGO_URI) {
      throw new Error('MongoDB URI not found in environment variables (checked MONGODB_URI and MONGO_URI)');
    }

    console.log(`[MongoDB] URI length: ${MONGO_URI.length}`);
    console.log(`[MongoDB] URI starts with: ${MONGO_URI.substring(0, 30)}...`);

    // Connect to MongoDB
    console.log('[MongoDB] Connecting to database...');
    const client = new MongoClient(MONGO_URI);
    await client.connect();
    console.log('[MongoDB] Connected successfully');

    const db = client.db(DB_NAME);
    const collection = db.collection(COLLECTION_NAME);

    // Fetch March 2026 data
    console.log('[Query] Fetching March 2026 data...');
    const result = await collection.findOne({
      "March 2026": { $exists: true }
    });

    if (!result || !result["March 2026"]) {
      console.error('[Error] No data found for March 2026');
      await client.close();
      process.exit(1);
    }

    const tenants = result["March 2026"];
    console.log(`[Result] Found ${tenants.length} tenant records`);

    // Filter unpaid tenants (status is "missing")
    const unpaidTenants = tenants.filter(t => t.status === 'missing');
    const paidTenants = tenants.filter(t => t.status === 'match');

    console.log(`[Filter] Found ${unpaidTenants.length} unpaid tenants`);
    console.log(`[Filter] Found ${paidTenants.length} paid tenants`);

    // Calculate totals
    const totalExpected = tenants.reduce((sum, t) => sum + t.expectedRent, 0);
    const totalPaid = tenants.reduce((sum, t) => sum + t.actualAmount, 0);
    const totalOutstanding = unpaidTenants.reduce((sum, t) => sum + (t.expectedRent - t.actualAmount), 0);

    // Generate HTML content
    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Rent Reconciliation Report - March 2026</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 20px;
            color: #333;
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
            border-bottom: 2px solid #333;
            padding-bottom: 20px;
        }
        .header h1 {
            margin: 0;
            color: #1a1a1a;
        }
        .header p {
            margin: 5px 0 0;
            color: #666;
        }
        .summary {
            background: #f5f5f5;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 30px;
        }
        .summary h2 {
            margin-top: 0;
            color: #333;
        }
        .summary-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 20px;
            margin-top: 15px;
        }
        .summary-item {
            background: white;
            padding: 15px;
            border-radius: 6px;
            text-align: center;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .summary-item h3 {
            margin: 0;
            font-size: 24px;
            color: #1a73e8;
        }
        .summary-item p {
            margin: 5px 0 0;
            color: #666;
            font-size: 12px;
        }
        .section {
            margin-bottom: 40px;
        }
        .section h2 {
            color: #333;
            border-bottom: 2px solid #1a73e8;
            padding-bottom: 10px;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 15px;
        }
        th {
            background: #1a73e8;
            color: white;
            padding: 12px;
            text-align: left;
            font-weight: bold;
        }
        td {
            padding: 10px;
            border-bottom: 1px solid #ddd;
        }
        tr:hover {
            background: #f5f5f5;
        }
        .unpaid {
            color: #d93025;
            font-weight: bold;
        }
        .paid {
            color: #188038;
            font-weight: bold;
        }
        .property-group {
            margin-bottom: 20px;
            background: #f9f9f9;
            padding: 15px;
            border-radius: 6px;
        }
        .property-name {
            font-weight: bold;
            font-size: 16px;
            color: #1a73e8;
            margin-bottom: 10px;
        }
        .amount {
            text-align: right;
            font-weight: bold;
        }
        .negative {
            color: #d93025;
        }
        .positive {
            color: #188038;
        }
        .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #ddd;
            text-align: center;
            color: #666;
            font-size: 12px;
        }
        @media print {
            body {
                margin: 0;
                padding: 20px;
            }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>Rent Reconciliation Report</h1>
        <p>March 2026</p>
        <p>Generated: ${new Date().toLocaleDateString()}</p>
    </div>

    <div class="summary">
        <h2>Summary</h2>
        <div class="summary-grid">
            <div class="summary-item">
                <h3>${tenants.length}</h3>
                <p>Total Tenants</p>
            </div>
            <div class="summary-item">
                <h3>$${totalExpected.toLocaleString()}</h3>
                <p>Expected Rent</p>
            </div>
            <div class="summary-item">
                <h3>$${totalPaid.toLocaleString()}</h3>
                <p>Collected</p>
            </div>
            <div class="summary-item">
                <h3 class="negative">$${totalOutstanding.toLocaleString()}</h3>
                <p>Outstanding</p>
            </div>
        </div>
        <div class="summary-grid" style="margin-top: 20px;">
            <div class="summary-item">
                <h3>${paidTenants.length}</h3>
                <p>Paid</p>
            </div>
            <div class="summary-item">
                <h3 class="negative">${unpaidTenants.length}</h3>
                <p>Unpaid</p>
            </div>
        </div>
    </div>

    <div class="section">
        <h2>Unpaid Tenants (${unpaidTenants.length})</h2>
        <table>
            <thead>
                <tr>
                    <th>Tenant</th>
                    <th>Address</th>
                    <th>Room</th>
                    <th>Expected</th>
                    <th>Paid</th>
                    <th>Difference</th>
                    <th>Status</th>
                </tr>
            </thead>
            <tbody>
                ${unpaidTenants.map(t => `
                <tr>
                    <td>${t.tenantName}</td>
                    <td>${t.apt || t.address}</td>
                    <td>${t.roomNo}</td>
                    <td class="amount">$${t.expectedRent.toLocaleString()}</td>
                    <td class="amount">$${t.actualAmount.toLocaleString()}</td>
                    <td class="amount negative">$${t.difference.toLocaleString()}</td>
                    <td class="unpaid">${t.status.toUpperCase()}</td>
                </tr>
                `).join('')}
            </tbody>
        </table>
    </div>

    <div class="section">
        <h2>Paid Tenants (${paidTenants.length})</h2>
        <table>
            <thead>
                <tr>
                    <th>Tenant</th>
                    <th>Address</th>
                    <th>Room</th>
                    <th>Expected</th>
                    <th>Paid</th>
                    <th>Status</th>
                </tr>
            </thead>
            <tbody>
                ${paidTenants.map(t => `
                <tr>
                    <td>${t.tenantName}</td>
                    <td>${t.apt || t.address}</td>
                    <td>${t.roomNo}</td>
                    <td class="amount">$${t.expectedRent.toLocaleString()}</td>
                    <td class="amount positive">$${t.actualAmount.toLocaleString()}</td>
                    <td class="paid">${t.status.toUpperCase()}</td>
                </tr>
                `).join('')}
            </tbody>
        </table>
    </div>

    <div class="section">
        <h2>Unpaid by Property</h2>
        ${(() => {
          const byProperty = {};
          unpaidTenants.forEach(t => {
            const prop = t.apt || t.address;
            if (!byProperty[prop]) byProperty[prop] = [];
            byProperty[prop].push(t);
          });

          return Object.entries(byProperty).map(([prop, tenants]) => `
            <div class="property-group">
                <div class="property-name">${prop}</div>
                <table>
                    <thead>
                        <tr>
                            <th>Tenant</th>
                            <th>Room</th>
                            <th>Expected</th>
                            <th>Outstanding</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tenants.map(t => `
                        <tr>
                            <td>${t.tenantName}</td>
                            <td>${t.roomNo}</td>
                            <td class="amount">$${t.expectedRent.toLocaleString()}</td>
                            <td class="amount negative">$${Math.abs(t.difference).toLocaleString()}</td>
                        </tr>
                        `).join('')}
                    </tbody>
                    <tfoot>
                        <tr style="background: #fce8e6;">
                            <td colspan="2"><strong>Property Total:</strong></td>
                            <td class="amount"><strong>$${tenants.reduce((sum, t) => sum + t.expectedRent, 0).toLocaleString()}</strong></td>
                            <td class="amount negative"><strong>$${tenants.reduce((sum, t) => sum + Math.abs(t.difference), 0).toLocaleString()}</strong></td>
                        </tr>
                    </tfoot>
                </table>
            </div>
          `).join('');
        })()}
    </div>

    <div class="footer">
        <p>Rent Reconciliation Report - March 2026 | Generated by OpenClaw</p>
    </div>
</body>
</html>
    `;

    // Save HTML file
    const outputPath = path.resolve(process.cwd(), 'rent-reconciliation-march-2026.html');
    fs.writeFileSync(outputPath, html);
    console.log(`[Success] HTML report saved to: ${outputPath}`);

    await client.close();

    console.log(`
[PDF Generation Instructions]

The report has been saved as HTML at:
${outputPath}

To convert to PDF:

Option 1 - Using Chrome (Mac/Linux):
  google-chrome --headless --print-to-pdf=rent-reconciliation-march-2026.pdf rent-reconciliation-march-2026.html

Option 2 - Using Chrome (Windows):
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" --headless --print-to-pdf="${outputPath.replace('.html', '.pdf')}" "${outputPath}"

Option 3 - Using wkhtmltopdf:
  wkhtmltopdf ${outputPath} rent-reconciliation-march-2026.pdf

Option 4 - Using Node.js (pdfkit):
  npm install pdfkit
  Then run: node generate-pdf.js
    `);

    return html;

  } catch (error) {
    console.error('[Error]', error.message);
    process.exit(1);
  }
}

// Run
generateRentReconciliationPDF();
