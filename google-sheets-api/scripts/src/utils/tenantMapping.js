'use strict';

const fs = require('fs').promises;
const path = require('path');

/**
 * Hybrid Approach: Direct Row Mapping + Pre-Calculated Ranges + Persistent Storage
 * This eliminates almost all search time for known tenants
 */

class TenantMapping {
  constructor() {
    this.mapping = null;
    this.ranges = null;
    this.columnIndexes = null;
    this.timestamp = null;
    this.refreshInterval = 60 * 60 * 1000; // 1 hour
    this.storagePath = path.join(__dirname, '../../data/tenant-mapping.json');
  }

  /**
   * Check if mapping exists and is fresh
   */
  isValid() {
    if (!this.mapping || !this.timestamp) {
      return false;
    }
    const age = Date.now() - this.timestamp;
    return age < this.refreshInterval;
  }

  /**
   * Build mapping from sheet data
   * @param {Object} data - { headers, rows }
   * @param {Object} indexes - { whoColumnIndex, contactColumnIndex, buildingColumnIndex }
   */
  build(data, indexes) {
    const { headers, rows } = data;
    const { whoColumnIndex, contactColumnIndex, buildingColumnIndex } = indexes;

    this.mapping = new Map();
    this.ranges = new Map();
    this.columnIndexes = indexes;
    this.timestamp = Date.now();

    // Build mapping and pre-calculate ranges
    rows.forEach((row, rowIndex) => {
      if (rowIndex === 0) return; // Skip header row

      const rowNumber = rowIndex + 1;
      const who = row[whoColumnIndex];
      const contact = row[contactColumnIndex];
      const building = row[buildingColumnIndex];

      // Build mapping keys
      const keys = [];

      if (contact) {
        const normalizedContact = this.normalizeCell(contact);
        keys.push({ key: `email:${normalizedContact}`, type: 'email' });
      }

      if (who && building) {
        const normalizedWho = this.normalizeCell(who);
        const normalizedBuilding = this.normalizeCell(building);
        keys.push({
          key: `namebuilding:${normalizedWho}|${normalizedBuilding}`,
          type: 'namebuilding'
        });
      }

      if (building) {
        const normalizedBuilding = this.normalizeCell(building);
        keys.push({
          key: `building:${normalizedBuilding}|${rowNumber}`, // Unique per row
          type: 'building'
        });
      }

      // Pre-calculate ranges for this row
      const rangeData = {
        rowNumber,
        who,
        contact,
        building,
        cleaningDate: `Cleaning!X${rowNumber}`,
        who: `Cleaning!A${rowNumber}`,
        contact: `Cleaning!B${rowNumber}`,
        building: `Cleaning!C${rowNumber}`
      };

      // Store in mapping and ranges
      keys.forEach(({ key, type }) => {
        this.mapping.set(key, {
          rowNumber,
          who,
          contact,
          building,
          type
        });
        this.ranges.set(key, rangeData);
      });
    });

    return this.mapping;
  }

  /**
   * Find tenant by identifiers using mapping
   * @param {Object} identifiers - { who, contact, building }
   * @returns {Object|null} Found tenant data or null
   */
  find(identifiers) {
    if (!this.isValid()) {
      return null;
    }

    const { who, contact, building } = identifiers;

    // Try email first (most precise)
    if (contact) {
      const normalizedContact = this.normalizeCell(contact);
      const emailKey = `email:${normalizedContact}`;
      const found = this.mapping.get(emailKey);
      if (found) {
        return {
          ...found,
          range: this.ranges.get(emailKey)
        };
      }
    }

    // Try name + building
    if (who && building) {
      const normalizedWho = this.normalizeCell(who);
      const normalizedBuilding = this.normalizeCell(building);
      const nameKey = `namebuilding:${normalizedWho}|${normalizedBuilding}`;
      const found = this.mapping.get(nameKey);
      if (found) {
        return {
          ...found,
          range: this.ranges.get(nameKey)
        };
      }
    }

    // Try building only
    if (building) {
      const normalizedBuilding = this.normalizeCell(building);
      // Find all rows for this building
      const matches = [];
      for (const [key, value] of this.mapping.entries()) {
        if (key.startsWith(`building:${normalizedBuilding}|`)) {
          matches.push({
            ...value,
            range: this.ranges.get(key)
          });
        }
      }
      if (matches.length > 0) {
        return matches.length === 1 ? matches[0] : matches;
      }
    }

    return null;
  }

  /**
   * Get direct range for update
   * @param {Object} identifiers - { who, contact, building }
   * @returns {Object|null} Range data or null
   */
  getRange(identifiers) {
    const found = this.find(identifiers);
    if (found && !Array.isArray(found)) {
      return found.range;
    }
    return null;
  }

  /**
   * Check if multiple matches exist
   * @param {Object} identifiers - { who, contact, building }
   * @returns {boolean} True if multiple matches
   */
  hasMultipleMatches(identifiers) {
    const found = this.find(identifiers);
    return Array.isArray(found) && found.length > 1;
  }

  /**
   * Get all matches
   * @param {Object} identifiers - { who, contact, building }
   * @returns {Array} Array of matches
   */
  getAllMatches(identifiers) {
    const found = this.find(identifiers);
    if (Array.isArray(found)) {
      return found.map(m => ({
        rowNumber: m.rowNumber,
        preview: [m.who, m.contact, m.building]
      }));
    }
    if (found) {
      return [{
        rowNumber: found.rowNumber,
        preview: [found.who, found.contact, found.building]
      }];
    }
    return [];
  }

  /**
   * Save mapping to disk
   */
  async save() {
    try {
      // Ensure data directory exists
      const dataDir = path.dirname(this.storagePath);
      await fs.mkdir(dataDir, { recursive: true });

      // Serialize Map objects to arrays
      const serialized = {
        mapping: Array.from(this.mapping.entries()),
        ranges: Array.from(this.ranges.entries()),
        columnIndexes: this.columnIndexes,
        timestamp: this.timestamp
      };

      await fs.writeFile(
        this.storagePath,
        JSON.stringify(serialized, null, 2)
      );
      return true;
    } catch (error) {
      console.error('Failed to save tenant mapping:', error.message);
      return false;
    }
  }

  /**
   * Load mapping from disk
   */
  async load() {
    try {
      const data = await fs.readFile(this.storagePath, 'utf8');
      const parsed = JSON.parse(data);

      // Restore Map objects
      this.mapping = new Map(parsed.mapping);
      this.ranges = new Map(parsed.ranges);
      this.columnIndexes = parsed.columnIndexes;
      this.timestamp = parsed.timestamp;

      return true;
    } catch (error) {
      // File doesn't exist or is invalid - not an error
      return false;
    }
  }

  /**
   * Clear mapping
   */
  clear() {
    this.mapping = null;
    this.ranges = null;
    this.columnIndexes = null;
    this.timestamp = null;
  }

  /**
   * Delete mapping from disk
   */
  async delete() {
    try {
      await fs.unlink(this.storagePath);
      this.clear();
      return true;
    } catch (error) {
      // File doesn't exist - not an error
      return false;
    }
  }

  /**
   * Normalize cell value for comparison
   */
  normalizeCell(value) {
    return String(value || '').trim().toLowerCase();
  }

  /**
   * Get mapping statistics
   */
  getStats() {
    const now = Date.now();
    const age = this.timestamp ? now - this.timestamp : 0;
    const isExpired = age > this.refreshInterval;

    return {
      hasMapping: !!this.mapping,
      hasRanges: !!this.ranges,
      hasIndexes: !!this.columnIndexes,
      ageMs: age,
      ageSeconds: (age / 1000).toFixed(2),
      expiryMs: this.refreshInterval,
      isExpired,
      entries: this.mapping ? this.mapping.size : 0,
      ranges: this.ranges ? this.ranges.size : 0,
      storagePath: this.storagePath
    };
  }
}

// Singleton instance
const tenantMapping = new TenantMapping();

module.exports = { tenantMapping, TenantMapping };
