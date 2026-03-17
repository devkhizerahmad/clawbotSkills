const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');

// Load .env from the current skill directory
require('dotenv').config({
  path: path.join(__dirname, '..', '.env'),
});

const sessionsDir =
  'C:\\Users\\MudasserRasool\\.openclaw\\agents\\main\\sessions';
const uri = process.env.MONGODB_URI;
const DB_NAME = process.env.MONGODB_DB;
const COLLECTION_NAME = process.env.MONGODB_COLLECTION;

const SYNC_FILE = path.join(__dirname, 'last_sync.txt');

async function syncHistory() {
  if (!uri) {
    console.error('MONGODB_URI not found in .env');
    return;
  }

  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db(DB_NAME);
    const collection = db.collection(COLLECTION_NAME);

    // Create a unique index to prevent duplicate entries from the same session/message
    await collection.createIndex(
      { sessionId: 1, messageId: 1 },
      { unique: true },
    );

    const files = fs
      .readdirSync(sessionsDir)
      .filter((f) => f.endsWith('.jsonl') || f.includes('.jsonl.reset'));

    let lastSyncTime = 0;
    if (fs.existsSync(SYNC_FILE)) {
      lastSyncTime = parseInt(fs.readFileSync(SYNC_FILE, 'utf8'), 10) || 0;
    }
    const currentSyncTime = Date.now();
    let processedCount = 0;

    for (const file of files) {
      const filePath = path.join(sessionsDir, file);
      
      const stats = fs.statSync(filePath);
      if (stats.mtimeMs < lastSyncTime) {
        continue;
      }
      processedCount++;
      console.log(`Processing ${file}...`);
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n').filter((l) => l.trim());

      let currentSessionId = null;
      let interactions = [];
      let currentInteraction = null;

      for (const line of lines) {
        try {
          const data = JSON.parse(line);

          if (data.type === 'session') {
            currentSessionId = data.id;
          }

          if (data.type === 'message') {
            const role = data.message.role;
            const timestamp = data.message.timestamp || data.timestamp;

            if (role === 'user') {
              if (currentInteraction) {
                interactions.push(currentInteraction);
              }

              const text = (data.message.content || [])
                .filter((c) => c.type === 'text')
                .map((c) => c.text)
                .join('\n');

              currentInteraction = {
                sessionId: currentSessionId,
                messageId: data.id,
                query: text,
                queriedAt: new Date(timestamp),
                response: '',
                responsedAt: null,
                commandRan: [],
                commandResponse: [],
              };
            } else if (role === 'assistant' && currentInteraction) {
              const content = data.message.content || [];

              const text = content
                .filter((c) => c.type === 'text')
                .map((c) => c.text)
                .join('\n');

              if (text) {
                currentInteraction.response = (
                  currentInteraction.response +
                  '\n' +
                  text
                ).trim();
                currentInteraction.responsedAt = new Date(timestamp);
              }

              const toolCalls = content.filter((c) => c.type === 'toolCall');
              for (const tc of toolCalls) {
                currentInteraction.commandRan.push(
                  `${tc.name}(${JSON.stringify(tc.arguments)})`,
                );
              }
            } else if (role === 'toolResult' && currentInteraction) {
              const content = (data.message.content || [])
                .map((c) => c.text || JSON.stringify(c))
                .join('\n');
              currentInteraction.commandResponse.push(content);
            }
          }
        } catch (e) {
          // Skip invalid lines
        }
      }

      if (currentInteraction) {
        interactions.push(currentInteraction);
      }

      for (const interaction of interactions) {
        // Skip interactions that are completely older than the last sync time
        if (interaction.queriedAt && interaction.queriedAt.getTime() < lastSyncTime) {
          continue;
        }

        const doc = {
          query: interaction.query,
          queriedAt: interaction.queriedAt,
          response: interaction.response,
          responsedAt: interaction.responsedAt || new Date(),
          commandRan: interaction.commandRan.join('; '),
          commandResponse: interaction.commandResponse.join('; '),
          sessionId: interaction.sessionId,
          messageId: interaction.messageId,
          syncedAt: new Date(),
        };

        try {
          await collection.updateOne(
            { sessionId: doc.sessionId, messageId: doc.messageId },
            { $set: doc },
            { upsert: true },
          );
        } catch (err) {
          console.error(
            `Error saving interaction ${doc.messageId}:`,
            err.message,
          );
        }
      }
    }

    if (processedCount > 0) {
      fs.writeFileSync(SYNC_FILE, currentSyncTime.toString(), 'utf8');
      console.log(`Sync completed successfully. Processed ${processedCount} updated file(s).`);
    } else {
      console.log('No new or updated files to sync.');
    }
  } catch (error) {
    console.error('Error syncing history to MongoDB:', error);
  } finally {
    await client.close();
  }
}

syncHistory();
