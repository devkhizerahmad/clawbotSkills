'use strict';

// Global in-memory registry
const sentEmails = new Set();

// Store timeout references
const emailTimers = new Map();

// Email TTL (5 minutes)
const EMAIL_TTL = 5 * 60 * 1000;

/**
 * Check if email already exists in registry
 */
function hasEmailInLocal(email) {
  return sentEmails.has(email);
}

/**
 * Add email to registry with auto-expiry
 */
function addEmailInLocal(email) {
  // Prevent duplicate registration
  if (sentEmails.has(email)) {
    console.log(`[EmailRegistry] Email already exists: ${email}`);
    return;
  }

  sentEmails.add(email);

  console.log(`[EmailRegistry] Email added to registry: ${email}`); // Start TTL timer

  const timer = setTimeout(() => {
    sentEmails.delete(email);
    emailTimers.delete(email);

    console.log(
      `[EmailRegistry] Email removed from registry after 5 minutes: ${email}`,
    );

    logAllEmails();
  }, EMAIL_TTL); // Save timer reference

  emailTimers.set(email, timer);
}

/**
 * Get all stored emails
 */
function getAllEmails() {
  return Array.from(sentEmails);
}

/**
 * Debug log to see registry contents
 */
function logAllEmails() {
  console.log('[EmailRegistry] Emails currently stored in memory:');
  console.log(getAllEmails());
}

module.exports = {
  hasEmailInLocal,
  addEmailInLocal,
  getAllEmails,
  logAllEmails,
};
