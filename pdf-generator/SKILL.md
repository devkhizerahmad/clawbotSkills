---
name: pdf-generator
description: Skill for generating professional sublease agreement PDFs using jsPDF.
---

# PDF Generation Skill

This skill allows for generating professional PDF agreements, specifically Sublease Agreements, using `jsPDF`.

## Setup

1. Install dependencies:
   ```bash
   npm install jspdf
   ```

## Usage

You can use the `generate-agreement.js` script to generate a PDF based on tenant and sublessor data.

### Example Data Structure

```javascript
{
  tenantName: "John Doe",
  sublessorName: "Jane Smith",
  propertyAddress: "123 Main St, New York, NY",
  rent: "2000",
  proRateRent: "500",
  securityDeposit: "2000",
  leaseStartDate: "2026-03-01",
  leaseEndDate: "2027-02-28",
  agreementDate: "2026-02-23"
}
```

## Implementation Details

The skill uses `helvetica` font with custom logic for:

- Letterhead inclusion (optional)
- Inline bolding of names and addresses
- Dynamic clause numbering and sub-clauses
- Integrated signature section

## API

The main function `generateAgreementPdf(data, includeLetterhead)` handles the entire generation process.
