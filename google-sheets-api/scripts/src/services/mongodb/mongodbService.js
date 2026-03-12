"use strict";

const { MongoClient, GridFSBucket, ObjectId } = require("mongodb");
const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../../../../.env") });

function createMongoClient() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI not found in .env");
    return null;
  }

  return new MongoClient(uri);
}

function getLeaseMatchQuery(data) {
  return {
    tenantName: data.tenantName,
    email: data.email,
    propertyAddress: data.propertyAddress,
    leaseStartDate: data.leaseStartDate,
    leaseEndDate: data.leaseEndDate,
  };
}

async function saveLeaseContract(data) {
  const client = createMongoClient();
  if (!client) {
    return;
  }

  try {
    await client.connect();
    const database = client.db("rent_reconciliation_db"); // :one: Upload PDF to GridFS
    const collection = database.collection("lease-apartment-contract");
    const existingLeaseContract = await collection.findOne(
      getLeaseMatchQuery(data)
    );

    const bucket = new GridFSBucket(database, { bucketName: "leaseContracts" });
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
        .on("error", reject)
        .on("finish", () => resolve(upload.id));
    });

    console.log(`PDF stored in GridFS with ID: ${uploadResult}`); // :two: Save document with reference to GridFS file

    const leaseContractData = {
      tenantName: data.tenantName,
      email: data.email,
      propertyAddress: data.propertyAddress,
      leaseStartDate: data.leaseStartDate,
      leaseEndDate: data.leaseEndDate,
      pdfFileId: uploadResult,
      signed: typeof data.signed === "boolean" ? data.signed : false,
      updatedAt: new Date(),
    };

    if (existingLeaseContract) {
      await collection.updateOne(
        { _id: existingLeaseContract._id },
        {
          $set: leaseContractData,
        }
      );

      console.log(
        `Successfully updated lease record in MongoDB: ${existingLeaseContract._id}`
      );

      return existingLeaseContract._id;
    }

    const result = await collection.insertOne({
      ...leaseContractData,
      emailSent: Boolean(data.emailSent),
      createdAt: new Date(),
    });

    console.log(
      `Successfully added lease record to MongoDB: ${result.insertedId}`
    );

    return result.insertedId;
  } catch (error) {
    console.error("Error saving lease contract:", error.message);
  } finally {
    await client.close();
  }
}

async function getLeaseContractById(leaseContractId) {
  if (!leaseContractId) {
    return null;
  }

  const client = createMongoClient();
  if (!client) {
    return null;
  }

  try {
    await client.connect();
    const collection = client
      .db("rent_reconciliation_db")
      .collection("lease-apartment-contract");

    return collection.findOne({ _id: new ObjectId(leaseContractId) });
  } catch (error) {
    console.error("Error fetching lease contract:", error.message);
    return null;
  } finally {
    await client.close();
  }
}

async function updateLeaseContractEmailSent(leaseContractId, emailSent) {
  if (!leaseContractId) {
    return false;
  }

  const client = createMongoClient();
  if (!client) {
    return false;
  }

  try {
    await client.connect();
    const collection = client
      .db("rent_reconciliation_db")
      .collection("lease-apartment-contract");
    const result = await collection.updateOne(
      { _id: new ObjectId(leaseContractId) },
      {
        $set: {
          emailSent: Boolean(emailSent),
          emailSentAt: emailSent ? new Date() : null,
        },
      }
    );

    return result.modifiedCount > 0 || result.matchedCount > 0;
  } catch (error) {
    console.error("Error updating lease contract email status:", error.message);
    return false;
  } finally {
    await client.close();
  }
}

module.exports = {
  saveLeaseContract,
  getLeaseContractById,
  updateLeaseContractEmailSent,
};
