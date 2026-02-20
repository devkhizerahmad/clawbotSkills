'use strict';

function toRanges(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return value
    .split(',')
    .map((range) => range.trim())
    .filter(Boolean);
}

module.exports = { toRanges };
