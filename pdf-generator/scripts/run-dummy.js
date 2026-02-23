import { generateAgreementPdf } from './generate-agreement.js';

// Dummy data for testing
const dummyData = {
  tenantName: "John Doe",
  sublessorName: "Jane Smith",
  propertyAddress: "456 Park Avenue, New York, NY 10022",
  rent: "2500",
  proRateRent: "800",
  securityDeposit: "2500",
  leaseStartDate: "2026-03-01",
  leaseEndDate: "2027-02-28",
  agreementDate: "2026-02-23"
};

// Generate PDF with letterhead
await generateAgreementPdf(dummyData, true);

console.log('✅ PDF generated successfully with dummy data!');