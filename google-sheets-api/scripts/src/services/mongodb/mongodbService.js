'use strict';

const { MongoClient, GridFSBucket, ObjectId } = require('mongodb');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../../../.env') });

const uri = process.env.MONGODB_URI;

const { logAudit } = require('../audit/logAudit');

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

    // Audit log for MongoDB insertion
    await logAudit({
      user: 'MONGODB_SERVICE',
      sheet: 'MongoDB: lease-apartment-contract',
      cell: result.insertedId.toString(),
      oldValue: '(none)',
      newValue: `New lease contract for ${data.tenantName} (${data.email})`,
      source: 'saveLeaseContract',
    });

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

    // Audit log for MongoDB email record
    await logAudit({
      user: 'MONGODB_SERVICE',
      sheet: 'MongoDB: contract-emails',
      cell: result.insertedId.toString(),
      oldValue: '(none)',
      newValue: `Email record for ${email} tied to contract ${contractId}`,
      source: 'saveContractEmail',
    });

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

async function getLeaseContractStatus(email) {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const database = client.db('rent_reconciliation_db');

    const collection = database.collection('lease-apartment-contract');

    const namePart = email.includes('@') ? email.split('@')[0] : email;
    const regex = new RegExp(namePart, 'i');

    const result = await collection.findOne({
      $or: [
        { email: regex },
        { tenantName: regex }
      ]
    });

    return result;
  } finally {
    await client.close();
  }
}

module.exports = {
  saveLeaseContract,
  emailExists,
  saveContractEmail,
  getLeaseContractStatus,
};
