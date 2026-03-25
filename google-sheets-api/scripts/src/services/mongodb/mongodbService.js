const { MongoClient } = require("mongodb");
const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.join(__dirname, "../../../.env") });

async function saveReconciliationToMongo(month, records) {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.warn("MONGODB_URI missing in .env. Skipping MongoDB update.");
    return;
  }

  const client = new MongoClient(uri);

  try {
    await client.connect();
    const database = client.db("rent_reconciliation_db"); // Default DB name, can be adjusted
    const collection = database.collection("rent_reconciliation"); // Create the document in the format {month: records}

    const document = {
      [month]: records,
      updatedAt: new Date(),
    }; // To follow the "update if exists" rule per month: // We need a way to identify the month. If the document format is literally {month: records}, // we should probably store each month as its own document where the month key exists. // However, a better approach for "update if exists" is to have a stable identifier. // If the requirement is LITERALLY {month: records}, we'll use a filter that checks for the existence of that key // or we'll just use the month name as a unique identifier field in our query. // Let's use the month name as a custom field to find the document, // but the stored document will have the key as requested.

    const filter = { [month]: { $exists: true } };

    const result = await collection.replaceOne(filter, document, {
      upsert: true,
    });

    if (result.upsertedCount > 0) {
      console.log(`New entry created in MongoDB for ${month}`);
    } else {
      console.log(`Updated existing entry in MongoDB for ${month}`);
    }
  } catch (err) {
    console.error("Error saving to MongoDB:", err.message);
  } finally {
    await client.close();
  }
}

module.exports = { saveReconciliationToMongo };
