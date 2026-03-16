'use strict';

const { jsPDF } = require('jspdf');
const fs = require('fs');
const path = require('path');

const HEADERS = [
  'Status',
  'Tenant Name',
  'Pays As',
  'Email',
  'Phone',
  'Apartment',
  'Room',
  'Expected Rent',
  'Actual Amount',
  'Difference',
];

// Aesthetic Constants
const COLORS = {
  primary: [44, 62, 80], // Dark Blue
  secondary: [231, 76, 60], // Coral/Red
  success: [46, 204, 113], // Emerald/Green
  text: [52, 73, 94], // Darker Blue/Grey
  muted: [149, 165, 166], // Grey
  white: [255, 255, 255],
  background: [248, 249, 250], // Lightest Grey
};

/**
 * Generates a Rent Reconciliation report PDF.
 * @param {Array<Array<string>>} data - The reconciliation data (rows).
 * @param {string} [outputPath] - The file path to save the PDF.
 */
async function generateReconciliationReport(data, outputPath) {
  // Use Landscape orientation for many columns
  const pdf = new jsPDF('l', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 10;
  const contentWidth = pageWidth - margin * 2;
  let yPos = 15;

  // 1. Header Section
  // Logo placeholder or Logo if found
  const logoPath = path.resolve(__dirname, '../../../../assets/hive-logo.png');
  if (fs.existsSync(logoPath)) {
    const imgData = fs.readFileSync(logoPath);
    pdf.addImage(imgData, 'PNG', margin, yPos, 40, 15);
  } else {
    // Fallback if logo not found
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(16);
    pdf.setTextColor(...COLORS.primary);
    pdf.text('HIVE NY', margin, yPos + 8);
  }

  // Title
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(20);
  pdf.setTextColor(...COLORS.primary);
  pdf.text('Rent Reconciliation Report', pageWidth / 2, yPos + 8, {
    align: 'center',
  });

  // Date
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(...COLORS.muted);
  const dateStr = new Date().toLocaleString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  pdf.text(`Generated: ${dateStr}`, pageWidth - margin, yPos + 8, {
    align: 'right',
  });

  yPos += 25;

  // 2. Summary Statistics
  const stats = data.reduce(
    (acc, row) => {
      if (row[0] === 'MATCH') acc.matched++;
      else acc.mismatched++;
      return acc;
    },
    { matched: 0, mismatched: 0 },
  );

  pdf.setFontSize(12);
  pdf.setTextColor(...COLORS.text);
  pdf.text(`Overview:`, margin, yPos);

  pdf.setFontSize(10);
  pdf.text(`Total Records: ${data.length}`, margin + 5, yPos + 8);
  pdf.setTextColor(...COLORS.success);
  pdf.text(`Matches: ${stats.matched}`, margin + 50, yPos + 8);
  pdf.setTextColor(...COLORS.secondary);
  pdf.text(`Mismatches: ${stats.mismatched}`, margin + 85, yPos + 8);

  yPos += 20;

  // 3. Table Layout
  const colWidths = [22, 35, 25, 50, 30, 40, 15, 25, 25, 25]; // Approximate weights
  const totalWeight = colWidths.reduce((a, b) => a + b, 0);
  const scaledWidths = colWidths.map((w) => (w / totalWeight) * contentWidth);

  // Draw Header Row
  pdf.setFillColor(...COLORS.primary);
  pdf.rect(margin, yPos, contentWidth, 10, 'F');

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(9);
  pdf.setTextColor(...COLORS.white);

  let currentX = margin;
  HEADERS.forEach((header, i) => {
    pdf.text(header, currentX + 2, yPos + 7);
    currentX += scaledWidths[i];
  });

  yPos += 10;

  // 4. Data Rows
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);

  data.forEach((row, rowIndex) => {
    // Check for page break
    if (yPos > pageHeight - 20) {
      pdf.addPage('l', 'mm', 'a4');
      yPos = 15;

      // Redraw Table Header
      // pdf.setFillColor(...COLORS.primary);
      // pdf.rect(margin, yPos, contentWidth, 10, 'F');
      // pdf.setFont('helvetica', 'bold');
      // pdf.setTextColor(...COLORS.white);
      // let headX = margin;
      // HEADERS.forEach((h, i) => {
      //   pdf.text(h, headX + 2, yPos + 7);
      //   headX += scaledWidths[i];
      // });
      // yPos += 10;
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8);
    }

    // Zebra Striping
    if (rowIndex % 2 === 0) {
      pdf.setFillColor(...COLORS.background);
      pdf.rect(margin, yPos, contentWidth, 8, 'F');
    }

    let cellX = margin;
    row.forEach((cell, i) => {
      const text = String(cell || '');

      // Row Styling based on Status
      if (i === 0) {
        if (text === 'MATCH') pdf.setTextColor(...COLORS.success);
        else pdf.setTextColor(...COLORS.secondary);
        pdf.setFont('helvetica', 'bold');
      } else {
        pdf.setTextColor(...COLORS.text);
        pdf.setFont('helvetica', 'normal');
      }

      // Truncate if text too wide
      const maxWidth = scaledWidths[i] - 4;
      let cellText = text;
      if (pdf.getTextWidth(cellText) > maxWidth) {
        while (
          pdf.getTextWidth(cellText + '...') > maxWidth &&
          cellText.length > 0
        ) {
          cellText = cellText.substring(0, cellText.length - 1);
        }
        cellText += '...';
      }

      pdf.text(cellText, cellX + 2, yPos + 5.5);
      cellX += scaledWidths[i];
    });

    yPos += 8;
  });

  // 5. Footer and Page Numbers
  const pageCount = pdf.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    pdf.setPage(i);
    pdf.setFontSize(8);
    pdf.setTextColor(...COLORS.muted);
    pdf.text(
      `Page ${i} of ${pageCount} | HIVE NY Rent Reconciliation`,
      pageWidth / 2,
      pageHeight - 8,
      { align: 'center' },
    );
  }

  // 6. Save PDF
  const finalPath =
    outputPath ||
    path.join(process.cwd(), `Reconciliation_Report_${Date.now()}.pdf`);
  const buffer = Buffer.from(pdf.output('arraybuffer'));
  return buffer;
  //fs.writeFileSync(finalPath, buffer);
}

// standalone execution support
if (require.main === module) {
  const sampleData = [
    [
      'MATCH',
      'Usman',
      'usman',
      'zayanyaseen99@gmail.com',
      '3,271,630,656',
      '90 Washington 24M',
      '1',
      '1200',
      '$1,200.00',
      '$0.00',
    ],
    [
      'MATCH',
      'Vineet',
      'vineet',
      'vineet@example.com',
      '917-622-9847',
      '442 5th Ave',
      '2',
      '2000',
      '$2,000.00',
      '$0.00',
    ],
    [
      'MISMATCH',
      'John Smith',
      'jsmith',
      'john.smith@example.com',
      '555-0123',
      '789 Broadway',
      'B',
      '1800',
      '$1,750.00',
      '-$50.00',
    ],
  ];
  generateReconciliationReport(sampleData)
    .then((path) => console.log(`PDF successfully generated at: ${path}`))
    .catch((err) => console.error(`Error generating PDF: ${err.message}`));
}

module.exports = { generateReconciliationReport };
