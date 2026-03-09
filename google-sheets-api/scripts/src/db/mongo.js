"use strict";

const path = require("path");
const { MongoClient } = require("mongodb");

require("dotenv").config({ path: path.resolve(process.cwd(), ".env") });

const QUERY_SRV_REFUSED = "querySrv ECONNREFUSED";

let cachedClient;

function getMongoUris() {
  const primary = process.env.MONGODB_URI || process.env.MONGO_URI;
  const fallback = process.env.MONGODB_URI_FALLBACK;

  if (!primary && !fallback) {
    throw new Error(
      "MongoDB URI is missing. Set MONGODB_URI (or MONGO_URI) in .env."
    );
  }

  return { primary, fallback };
}

async function connectWithUri(uri) {
  const maskedUri = uri.replace(/:\/\/([^:]+):([^@]+)@/, "://$1:***@");
  console.log(`[MongoDB] Connecting to: ${maskedUri}`);

  const client = new MongoClient(uri, {
    serverSelectionTimeoutMS: 10000,
  });
  await client.connect();
  console.log(`[MongoDB] Successfully connected`);
  return client;
}

async function getMongoClient() {
  if (cachedClient) {
    return cachedClient;
  }

  const { primary, fallback } = getMongoUris();

  if (primary) {
    try {
      cachedClient = await connectWithUri(primary);
      return cachedClient;
    } catch (error) {
      const message = String(error && error.message ? error.message : error);
      const shouldTryFallback =
        Boolean(fallback) &&
        (message.includes(QUERY_SRV_REFUSED) ||
          primary.startsWith("mongodb+srv://"));

      if (!shouldTryFallback) {
        throw error;
      }
    }
  }

  cachedClient = await connectWithUri(fallback);
  return cachedClient;
}

module.exports = { getMongoClient };
