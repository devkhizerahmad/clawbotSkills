---
name: chat-history-mongodb
description: A built-in skill for synchronizing OpenClaw session history to MongoDB.
metadata: {"clawdbot":{"emoji":"📓","always":false,"requires":{"bins":["node"]}}}
---

# Chat History Syncer to MongoDB 📓

This skill reads all `.jsonl` session files from the agent's sessions directory and uploads/updates the interactions into a MongoDB database collection.

## Setup

First, install dependencies:
```bash
cd c:\Users\MudasserRasool\.openclaw\workspace\skills\chat-history-mongodb
npm install
```

Create a `.env` file in `c:\Users\MudasserRasool\.openclaw\workspace\skills\chat-history-mongodb` with the required environment variables:
```
MONGODB_URI=your_mongodb_connection_string
```
*(If you were previously using the Google Sheets API skill, you can copy the `MONGODB_URI` from its `.env` config).*

## Usage

To sync your chat history, simply run:
```bash
cd c:\Users\MudasserRasool\.openclaw\workspace\skills\chat-history-mongodb
npm run sync
```
