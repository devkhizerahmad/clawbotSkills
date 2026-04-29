'use strict';

/**
 * In-memory cache for sheet data with lookup indexes
 * This dramatically improves performance for repeated lookups
 */

class CleaningCache {
  constructor() {
    this.cache = null;
    this.timestamp = null;
    this.expiryMs = 5 * 60 * 1000; // 5 minutes
    this.indexes = null;
  }

  /**
   * Get cached data if still valid
   * @returns {Object|null} Cached data or null if expired
   */
  get() {
    if (!this.cache || !this.timestamp) {
      return null;
    }

    const now = Date.now();
    if (now - this.timestamp > this.expiryMs) {
      this.clear();
      return null;
    }

    return this.cache;
  }

  /**
   * Set cached data and build lookup indexes
   * @param {Object} data - The data to cache with headers and rows
   * @returns {Object} The cached data with indexes
   */
  set(data) {
    this.cache = data;
    this.timestamp = Date.now();
    this.indexes = this.buildIndexes(data);
    return this.cache;
  }

  /**
   * Clear the cache
   */
  clear() {
    this.cache = null;
    this.timestamp = null;
    this.indexes = null;
  }

  /**
   * Build lookup indexes for fast O(1) lookups
   * @param {Object} data - Data with headers and rows
   * @returns {Object} Index maps
   */
  buildIndexes(data) {
    const { headers, rows } = data;

    // Find column indexes
    const whoColumnIndex = this.findColumnIndex(headers, [
      (header) => header === 'who',
      (header) => header.includes('who'),
    ]);
    const contactColumnIndex = this.findColumnIndex(headers, [
      (header) => header.includes('contact') && !header.includes('room'),
      (header) => header.includes('email'),
      (header) => header.includes('phone'),
    ]);
    const buildingColumnIndex = this.findColumnIndex(headers, [
      (header) => header.includes('building'),
      (header) => header.includes('location'),
      (header) => header === 'apt',
      (header) => header.includes('apartment'),
      (header) => header.includes('unit'),
    ]);

    // Build indexes
    const index = {
      byEmail: new Map(),
      byNameBuilding: new Map(),
      byBuilding: new Map(),
    };

    rows.forEach((row, rowIndex) => {
      if (rowIndex === 0) return; // Skip header row

      const who = row[whoColumnIndex];
      const contact = row[contactColumnIndex];
      const building = row[buildingColumnIndex];

      // Index by email/contact (most unique)
      if (contact) {
        const normalizedContact = this.normalizeCell(contact);
        index.byEmail.set(normalizedContact, {
          rowNumber: rowIndex + 1,
          who: who,
          building: building,
          contact: contact,
        });
      }

      // Index by name + building combo
      if (who && building) {
        const key = `${this.normalizeCell(who)}|${this.normalizeCell(building)}`;
        index.byNameBuilding.set(key, {
          rowNumber: rowIndex + 1,
          contact: contact,
        });
      }

      // Index by building alone (for multi-room lookups)
      if (building) {
        const normalizedBuilding = this.normalizeCell(building);
        if (!index.byBuilding.has(normalizedBuilding)) {
          index.byBuilding.set(normalizedBuilding, []);
        }
        index.byBuilding.get(normalizedBuilding).push({
          rowNumber: rowIndex + 1,
          who: who,
          contact: contact,
        });
      }
    });

    return {
      index,
      columnIndexes: {
        whoColumnIndex,
        contactColumnIndex,
        buildingColumnIndex,
      },
    };
  }

  /**
   * Find column index by matching headers
   * @param {Array} headers - Array of header strings
   * @param {Array} matchers - Array of matcher functions
   * @returns {number} Column index or -1 if not found
   */
  findColumnIndex(headers, matchers) {
    return headers.findIndex((header) => {
      const normalized = String(header || '').trim().toLowerCase();
      return matchers.some((matcher) => matcher(normalized));
    });
  }

  /**
   * Normalize cell value for comparison
   * @param {string} value - Cell value
   * @returns {string} Normalized value
   */
  normalizeCell(value) {
    return String(value || '').trim().toLowerCase();
  }

  /**
   * Find matching rows using indexes (O(1) lookup)
   * @param {Object} identifiers - { who, contact, building }
   * @returns {Array} Array of matching rows
   */
  findMatches(identifiers) {
    if (!this.indexes) {
      throw new Error('Index not built. Call set() first.');
    }

    const { index } = this.indexes;
    const { who, contact, building } = identifiers;

    const matches = [];

    // Try exact email match first (most unique)
    if (contact) {
      const normalizedContact = this.normalizeCell(contact);
      const emailMatch = index.byEmail.get(normalizedContact);
      if (emailMatch) {
        matches.push({
          rowNumber: emailMatch.rowNumber,
          preview: [emailMatch.who, emailMatch.contact, emailMatch.building],
        });
      }
    }

    // Try name + building combo
    if (who && building) {
      const key = `${this.normalizeCell(who)}|${this.normalizeCell(building)}`;
      const nameBuildingMatch = index.byNameBuilding.get(key);
      if (nameBuildingMatch) {
        // Check if already added by email match
        const alreadyAdded = matches.some(m => m.rowNumber === nameBuildingMatch.rowNumber);
        if (!alreadyAdded) {
          matches.push({
            rowNumber: nameBuildingMatch.rowNumber,
            preview: [who, nameBuildingMatch.contact, building],
          });
        }
      }
    }

    // Fallback to building lookup
    if (building && matches.length === 0) {
      const normalizedBuilding = this.normalizeCell(building);
      const buildingMatches = index.byBuilding.get(normalizedBuilding);
      if (buildingMatches) {
        buildingMatches.forEach(match => {
          matches.push({
            rowNumber: match.rowNumber,
            preview: [match.who, match.contact, building],
          });
        });
      }
    }

    return matches;
  }

  /**
   * Get cache stats for debugging
   * @returns {Object} Cache statistics
   */
  getStats() {
    const now = Date.now();
    const age = this.timestamp ? now - this.timestamp : 0;
    const isExpired = age > this.expiryMs;

    return {
      hasCache: !!this.cache,
      hasIndexes: !!this.indexes,
      ageMs: age,
      ageSeconds: (age / 1000).toFixed(2),
      expiryMs: this.expiryMs,
      isExpired,
      indexesBuilt: this.indexes ? {
        byEmail: this.indexes.index.byEmail.size,
        byNameBuilding: this.indexes.index.byNameBuilding.size,
        byBuilding: this.indexes.index.byBuilding.size,
      } : null,
    };
  }
}

// Singleton instance
const cleaningCache = new CleaningCache();

module.exports = { cleaningCache, CleaningCache };
