import { generateAgreementPdf } from './generate-agreement.js';

const dummyData = {
  tenantName: 'John Doe',
  sublessorName: 'Jane Smith',
  propertyAddress: '123 Main St, New York, NY 10018',
  rent: '2500',
  proRateRent: '500',
  securityDeposit: '2500',
  leaseStartDate: '2026-03-01',
  leaseEndDate: '2027-02-28',
  agreementDate: '2026-02-23',
};

console.log('Generating dummy PDF...');
generateAgreementPdf(dummyData, true)
  .then(() => {
    console.log('Success!');
  })
  .catch((err) => {
    console.error('Failed to generate PDF:', err);
  });
