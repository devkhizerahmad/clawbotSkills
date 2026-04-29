'use strict';

function getInventoryMutationAuditSource({ sheetName, rowCount = 1 }) {
  if ((sheetName || '').toLowerCase() !== 'inventory') {
    return null;
  }

  return rowCount > 1
    ? 'INVENTORY_BIG_MUTATION'
    : 'INVENTORY_SMALL_MUTATION';
}

module.exports = { getInventoryMutationAuditSource };
