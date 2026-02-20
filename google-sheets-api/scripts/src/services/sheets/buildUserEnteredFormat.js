'use strict';

const { normalizeColor } = require('../../utils/normalizeColor');

function buildUserEnteredFormat(options) {
  const userEnteredFormat = {};
  const fields = [];

  if (options.backgroundColor) {
    userEnteredFormat.backgroundColor = normalizeColor(options.backgroundColor);
    fields.push('userEnteredFormat.backgroundColor');
  }

  if (options.textFormat) {
    const tf = options.textFormat;
    userEnteredFormat.textFormat = {};

    if (tf.bold !== undefined) {
      userEnteredFormat.textFormat.bold = tf.bold;
      fields.push('userEnteredFormat.textFormat.bold');
    }
    if (tf.italic !== undefined) {
      userEnteredFormat.textFormat.italic = tf.italic;
      fields.push('userEnteredFormat.textFormat.italic');
    }
    if (tf.underline !== undefined) {
      userEnteredFormat.textFormat.underline = tf.underline;
      fields.push('userEnteredFormat.textFormat.underline');
    }
    if (tf.strikethrough !== undefined) {
      userEnteredFormat.textFormat.strikethrough = tf.strikethrough;
      fields.push('userEnteredFormat.textFormat.strikethrough');
    }
    if (tf.fontSize !== undefined) {
      userEnteredFormat.textFormat.fontSize = tf.fontSize;
      fields.push('userEnteredFormat.textFormat.fontSize');
    }
    if (tf.fontFamily) {
      userEnteredFormat.textFormat.fontFamily = tf.fontFamily;
      fields.push('userEnteredFormat.textFormat.fontFamily');
    }
    if (tf.foregroundColor) {
      userEnteredFormat.textFormat.foregroundColor = normalizeColor(
        tf.foregroundColor,
      );
      fields.push('userEnteredFormat.textFormat.foregroundColor');
    }
  }

  if (options.horizontalAlignment) {
    userEnteredFormat.horizontalAlignment =
      options.horizontalAlignment.toUpperCase();
    fields.push('userEnteredFormat.horizontalAlignment');
  }

  if (options.verticalAlignment) {
    userEnteredFormat.verticalAlignment =
      options.verticalAlignment.toUpperCase();
    fields.push('userEnteredFormat.verticalAlignment');
  }

  if (options.wrapStrategy) {
    userEnteredFormat.wrapStrategy = options.wrapStrategy.toUpperCase();
    fields.push('userEnteredFormat.wrapStrategy');
  }

  if (options.numberFormat) {
    userEnteredFormat.numberFormat = {
      type: options.numberFormat.type,
      pattern: options.numberFormat.pattern,
    };
    fields.push('userEnteredFormat.numberFormat');
  }

  return { userEnteredFormat, fields };
}

module.exports = { buildUserEnteredFormat };
