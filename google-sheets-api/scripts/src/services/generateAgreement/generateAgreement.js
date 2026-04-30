'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const GENERATE_AGREEMENT_URL =
  process.env.GENERATE_AGREEMENT_URL ||
  'https://zjcmgbhxfewkbyocxodi.supabase.co/functions/v1/generate-agreement';
const MAX_RATE_LIMIT_RETRIES = 2;
const DEFAULT_RETRY_AFTER_SECONDS = 15;

function sanitizeFileName(fileName) {
  return String(fileName || 'Sublease Agreement.pdf')
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
    .trim();
}

function getOutputPath(fileName) {
  // Use Downloads folder for CLI tool for better accessibility
  const downloadsFolder = path.join(os.homedir(), 'Downloads');
  return path.join(downloadsFolder, sanitizeFileName(fileName));
}

function getDefaultFileName(data) {
  return `${data.tenantName} ${
    data.sublesseeSignatureImage ? 'Signed ' : ''
  }Sublease Agreement.pdf`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getRetryAfterMs(response, attempt) {
  const retryAfterHeader = response.headers.get('Retry-After');
  const retryAfterSeconds = Number.parseInt(retryAfterHeader, 10);

  if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds >= 0) {
    return retryAfterSeconds * 1000;
  }

  return DEFAULT_RETRY_AFTER_SECONDS * 1000 * (attempt + 1);
}

async function readErrorMessage(response) {
  const contentType = response.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    const payload = await response.json().catch(() => null);
    if (!payload) {
      return 'Unknown JSON error response';
    }

    const details = payload.details
      ? ` | details: ${JSON.stringify(payload.details)}`
      : '';
    return `${payload.error || payload.message || 'Request failed'}${details}`;
  }

  const text = await response.text();
  return text || 'Request failed';
}

function saveBufferToPath(buffer, fileName) {
  const outputPath = getOutputPath(fileName);
  fs.writeFileSync(outputPath, buffer);
  return outputPath;
}

/**
 * Generates a sublease agreement PDF via API.
 * @param {Object} data
 * @param {boolean} includeLetterhead
 * @param {boolean} [addSublesseeSignature=false]
 */
async function generateAgreementPdf(
  data,
  includeLetterhead,
  addSublesseeSignature = false,
) {
  const requestedFormat = data.format || 'pdf';
  const payload = {
    ...data,
    format: requestedFormat,
    includeLetterhead,
    addSublesseeSignature,
  };

  console.log(`Calling agreement API for tenant: ${data.tenantName}...`);

  let response;

  for (let attempt = 0; attempt <= MAX_RATE_LIMIT_RETRIES; attempt++) {
    response = await fetch(GENERATE_AGREEMENT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (response.status !== 429) {
      break;
    }

    if (attempt === MAX_RATE_LIMIT_RETRIES) {
      break;
    }

    const retryAfterMs = getRetryAfterMs(response, attempt);
    console.warn(
      `Agreement API rate limited. Retrying in ${Math.ceil(retryAfterMs / 1000)} seconds...`,
    );
    await sleep(retryAfterMs);
  }

  if (!response.ok) {
    const errorMessage = await readErrorMessage(response);
    throw new Error(
      `Failed to generate agreement PDF: ${response.status} ${response.statusText} - ${errorMessage}`,
    );
  }

  const contentType = response.headers.get('content-type') || '';
  const defaultFileName = getDefaultFileName(data);

  if (requestedFormat === 'base64' || contentType.includes('application/json')) {
    const result = await response.json();

    if (!result.base64) {
      throw new Error('Agreement API did not return base64 content.');
    }

    const buffer = Buffer.from(result.base64, 'base64');
    const outputPath = saveBufferToPath(
      buffer,
      result.filename || defaultFileName,
    );
    console.log(`PDF saved to: ${outputPath}`);
    return outputPath;
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const outputPath = saveBufferToPath(buffer, defaultFileName);
  console.log(`PDF saved to: ${outputPath}`);
  return outputPath;
}

module.exports = { generateAgreementPdf };
