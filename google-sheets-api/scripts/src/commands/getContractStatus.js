'use strict';

const {
  getLeaseContractStatus,
} = require('../services/mongodb/mongodbService.js');

async function getContractStatus(context) {
  const email = context.args[1];
  if (!email) {
    throw new Error('Email is required as the first argument');
  }
  const status = await getLeaseContractStatus(email);
  return status;
}

module.exports = { getContractStatus };
