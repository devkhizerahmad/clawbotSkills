'use strict';

const { cleaningCache } = require('../utils/cleaningCache');
const { tenantMapping } = require('../utils/tenantMapping');

async function cacheStats({ sheets, args, flags, command, isMutation }) {
  const action = args[1] || 'stats';

  if (action === 'stats') {
    const cacheStats = cleaningCache.getStats();
    const mappingStats = tenantMapping.getStats();

    return {
      success: true,
      action: 'stats',
      data: {
        cache: cacheStats,
        mapping: mappingStats,
      },
    };
  }

  if (action === 'clear') {
    cleaningCache.clear();
    await tenantMapping.delete();
    return {
      success: true,
      action: 'clear',
      message: 'Cleaning cache and tenant mapping have been cleared.',
    };
  }

  if (action === 'clear-cache') {
    cleaningCache.clear();
    return {
      success: true,
      action: 'clear-cache',
      message: 'Cleaning cache has been cleared.',
    };
  }

  if (action === 'clear-mapping') {
    await tenantMapping.delete();
    return {
      success: true,
      action: 'clear-mapping',
      message: 'Tenant mapping has been cleared.',
    };
  }

  return {
    success: false,
    error: `Unknown action: ${action}. Use 'stats', 'clear', 'clear-cache', or 'clear-mapping'.`,
  };
}

// Mark this command as read-only (doesn't need Google Sheets API)
cacheStats.isReadOnly = true;

module.exports = { cacheStats };
