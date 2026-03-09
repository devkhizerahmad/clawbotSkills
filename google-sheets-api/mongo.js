"use strict";

const { MongoClient } = require("mongodb");
require("dotenv").config();

const uri = process.env.MONGO_URI;
if (!uri) {
  console.warn(
    "MONGO_URI not found in environment variables. MongoDB commands will fail."
  );
}

let client;

function getMongoClient() {
  if (!uri) {
    throw new Error("MongoDB connection URI is not configured in .env file.");
  }
  client = client || new MongoClient(uri);
  return client.connect();
}

module.exports = { getMongoClient };