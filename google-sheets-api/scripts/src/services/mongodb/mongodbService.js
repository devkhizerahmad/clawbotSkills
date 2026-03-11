'use strict';

const { MongoClient, GridFSBucket, ObjectId } = require('mongodb');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../../../.env') });

const uri = process.env.MONGODB_URI;

async function saveLeaseContract(data) {
  if (!uri) {
    console.error('MONGODB_URI not found in .env');
    return;
  }

  const client = new MongoClient(uri);

  try {
    await client.connect();
    const database = client.db('rent_reconciliation_db');

    // 1️⃣ Upload PDF to GridFS
    const bucket = new GridFSBucket(database, { bucketName: 'leaseContracts' });
    const pdfStream = fs.createReadStream(data.pdfPath);

    const uploadResult = await new Promise((resolve, reject) => {
      const upload = bucket.openUploadStream(path.basename(data.pdfPath), {
        metadata: {
          tenantName: data.tenantName,
          email: data.email,
        },
      });
      pdfStream
        .pipe(upload)
        .on('error', reject)
        .on('finish', () => resolve(upload.id));
    });

    console.log(`PDF stored in GridFS with ID: ${uploadResult}`);

    // 2️⃣ Save document with reference to GridFS file
    const collection = database.collection('lease-apartment-contract');

    const result = await collection.insertOne({
      tenantName: data.tenantName,
      email: data.email,
      pdfFileId: uploadResult, // MongoDB ObjectId reference to GridFS
      signed: false,
      createdAt: new Date(),
    });

    console.log(
      `Successfully added lease record to MongoDB: ${result.insertedId}`,
    );

    return result.insertedId;
  } catch (error) {
    console.error('Error saving lease contract:', error.message);
  } finally {
    await client.close();
  }
}

async function emailExists(email) {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const database = client.db('rent_reconciliation_db');

    const collection = database.collection('contract-emails');

    const result = await collection.findOne({
      email: email,
    });

    return !!result;
  } finally {
    await client.close();
  }
}

async function saveContractEmail(contractId, email) {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const database = client.db('rent_reconciliation_db');

    const collection = database.collection('contract-emails');

    const result = await collection.insertOne({
      contractId: new ObjectId(contractId),
      email,
      sentAt: new Date(),
    });

    console.log(`Email record created: ${result.insertedId}`);

    return result.insertedId;
  } catch (error) {
    if (error.code === 11000) {
      console.log('Duplicate email prevented by MongoDB unique index.');
      return null;
    }

    throw error;
  } finally {
    await client.close();
  }
}

module.exports = { saveLeaseContract, emailExists, saveContractEmail };
