"use strict";

const path = require("path");
const dotenv = require("dotenv");
const { MongoClient } = require("mongodb");

dotenv.config({ path: path.join(__dirname, "../../.env") });

const DEFAULT_DB_NAME = "rent_reconciliation_db";
const DEFAULT_LEASE_COLLECTION = "leases";

function normalizeBoolean(value) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "yes", "y", "signed"].includes(normalized)) {
      return true;
    }
    if (["false", "no", "n", "unsigned", "pending"].includes(normalized)) {
      return false;
    }
  }

  return false;
}

function pickLeaseStatus(lease) {
  if (Object.hasOwn(lease, "signed")) {
    return normalizeBoolean(lease.signed) ? "signed" : "unsigned";
  }

  if (Object.hasOwn(lease, "status")) {
    return normalizeBoolean(lease.status) ? "signed" : "unsigned";
  }

  return "unsigned";
}

function hasLeaseShape(lease) {
  return Boolean(
    lease &&
      (lease.tenantName ||
        lease.email ||
        lease.status ||
        Object.hasOwn(lease, "signed"))
  );
}

async function fetchAllLeases() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI is missing. Please set it in scripts/.env.");
  }

  const dbName = process.env.MONGODB_DB || DEFAULT_DB_NAME;
  const preferredCollection =
    process.env.MONGODB_LEASES_COLLECTION || DEFAULT_LEASE_COLLECTION;

  const client = new MongoClient(uri);

  try {
    await client.connect();
    const database = client.db(dbName);

    const collectionInfos = await database
      .listCollections({}, { nameOnly: true })
      .toArray();
    const availableCollections = new Set(
      collectionInfos.map((collectionInfo) => collectionInfo.name)
    );

    const candidateCollections = [
      preferredCollection,
      "lease-apartment-contract",
      "lease_contracts",
      "leaseContracts",
      "leases",
      "rent_reconciliation",
    ].filter(
      (name, index, all) =>
        all.indexOf(name) === index && availableCollections.has(name)
    );

    for (const collectionName of candidateCollections) {
      const docs = await database
        .collection(collectionName)
        .find({})
        .sort({ createdAt: -1, updatedAt: -1 })
        .limit(1000)
        .toArray();
      const leases = docs.filter(hasLeaseShape);
      if (leases.length > 0) {
        return leases;
      }
    }

    return [];
  } finally {
    await client.close();
  }
}

async function leaseByEmail({ args }) {
  const email = args[1];

  if (!email) {
    throw new Error("Email is required. Usage: lease-by-email <email>");
  }

  const allLeases = await fetchAllLeases();

  // Filter leases by email (case-insensitive)
  const matchingLeases = allLeases.filter((lease) => {
    const leaseEmail = (lease.email || "").trim().toLowerCase();
    const searchEmail = email.trim().toLowerCase();
    return leaseEmail === searchEmail;
  });

  // Normalize the output
  const normalizedLeases = matchingLeases.map((lease) => ({
    tenantName: lease.tenantName || "",
    email: lease.email || "",
    status: pickLeaseStatus(lease),
  }));

  return {
    command: "lease-by-email",
    email,
    count: normalizedLeases.length,
    leases: normalizedLeases,
  };
}

module.exports = { leaseByEmail };
