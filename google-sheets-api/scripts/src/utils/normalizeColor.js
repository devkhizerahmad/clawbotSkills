'use strict';

function normalizeColor(color) {
  if (!color) return undefined;
  return {
    red: (color.red || 0) / 255,
    green: (color.green || 0) / 255,
    blue: (color.blue || 0) / 255,
  };
}

module.exports = { normalizeColor };
