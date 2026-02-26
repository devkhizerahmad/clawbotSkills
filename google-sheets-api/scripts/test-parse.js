const args = [
  'lease',
  'Usman has leased apartment 90 Washington 24M Room 1 from 11/11/2026 to 12/12/2026 for amount 2000$ with prorate 200$(if not present take ammount). Usman contact number 12334567 and email zayanyaseen99@gmail.com.',
];
const commandArgs = args.slice(1);
const leaseStr = commandArgs.join(' ');

const tenantName = leaseStr.match(/^(.*?) has leased/i)?.[1]?.trim();
const apartment =
  leaseStr.match(/apartment (.*?) Room/i)?.[1]?.trim() ||
  leaseStr.match(/apartment (.*?) from/i)?.[1]?.trim();
const room = leaseStr.match(/Room (\d+)/i)?.[1]?.trim();
const startDate = leaseStr.match(/from (.*?) to/i)?.[1]?.trim();
const endDate = leaseStr.match(/to (.*?) for/i)?.[1]?.trim();
const amount = leaseStr.match(/amount (\d+)/i)?.[1]?.trim();
const prorateRaw = leaseStr.match(/prorate (\d+)/i)?.[1]?.trim();
const contact = leaseStr.match(/number (\d+)/i)?.[1]?.trim();
const email =
  leaseStr.match(/email ([^\s$.]+@[^\s$.]+\.[^\s$.]+)/i)?.[1]?.trim() ||
  leaseStr.match(/email ([^\s$.]+)/i)?.[1]?.trim();

console.log({
  tenantName,
  apartment,
  room,
  startDate,
  endDate,
  amount,
  prorateRaw,
  contact,
  email,
});
