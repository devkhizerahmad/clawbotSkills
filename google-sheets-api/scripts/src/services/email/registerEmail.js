'use strict';

const fs = require('fs');
const path = require('path');

const CACHE_FILE = path.join(__dirname, 'email-cache.json');

function loadEmails() {
  if (!fs.existsSync(CACHE_FILE)) return new Set();
  const data = JSON.parse(fs.readFileSync(CACHE_FILE));
  return new Set(data);
}

function saveEmails(set) {
  fs.writeFileSync(CACHE_FILE, JSON.stringify([...set], null, 2));
}

function hasEmailInLocal(email) {
  const emails = loadEmails();
  return emails.has(email);
}

function addEmailInLocal(email) {
  const emails = loadEmails();
  emails.add(email);
  saveEmails(emails);

  console.log(`[EmailRegistry] Email saved locally: ${email}`);
}

module.exports = {
  hasEmailInLocal,
  addEmailInLocal,
};
