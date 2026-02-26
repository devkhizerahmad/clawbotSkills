---
name: google-sheets-api
description: OpenClaw skill that installs a Google Sheets CLI with setup steps and commands for read/write, batch, formatting, sheet management, and audit logging.
---

# Google Sheets API Skill (Advanced)

## Purpose

Provide a production-ready Google Sheets CLI for OpenClaw. This skill supports data reads/writes, batch operations, formatting, and sheet management with service account authentication and automatic audit logging.

## Best fit

- You need a repeatable CLI for automation tasks.
- You want JSON-in/JSON-out for pipelines.
- You need more than basic read/write (formatting, sheet ops, batch updates).

## Not a fit

- You must use end-user OAuth consent flows (this skill is service-account focused).
- You only need lightweight, one-off edits.

## One-time setup

1. Create or select a Google Cloud project.
2. Enable the Google Sheets API.
3. Create a service account and download its JSON key.
4. Share target spreadsheets with the service account email.

## Install

```bash
cd google-sheets-api
npm install
```

## Run

```bash
node scripts/sheets-cli.js help
node scripts/sheets-cli.js read 1RobrLNYSmMUyq53dUcdmj2ePaU2YkagqLqgIgx7M4OU "Sheet1!A1:C10"
node scripts/sheets-cli.js append 1RobrLNYSmMUyq53dUcdmj2ePaU2YkagqLqgIgx7M4OU "Sheet1!A:B" '@data.json'
```

You can also use npm:

```bash
npm run sheets -- read <spreadsheetId> "Sheet1!A1:C10"
```

## Credentials

Supported sources (first match wins):

- `GOOGLE_SHEETS_CREDENTIALS_JSON` (inline JSON string)
- `GOOGLE_SERVICE_ACCOUNT_KEY` (file path)
- `GOOGLE_SHEETS_KEY_FILE` (file path)
- `GOOGLE_APPLICATION_CREDENTIALS` (file path)
- `./service-account.json`, `./credentials.json`, `./google-service-account.json`
- `~/.config/google-sheets/credentials.json`

## Input Rules

- If cleaning sheet is being edited and you have been asked to update the cleaning date, make sure to update the cleaning date column (Column W) in the Cleaning sheet.
- **Syncing Apartments**: If the user asks to "Add apartment [apartment name]" or sync apartment data, use the `node scripts/sheets-cli.js Add apartment "[apartment name]"` command. This command automatically:
  1. Fetches data and room links from Google Drive.
  2. Updates the `Unit_Availability_Details` table in the Inventory sheet (preserving existing row data).
  3. Updates the `Inventory Data` and `Rent Tracker` sheets.
  4. Applies necessary formatting and borders.
  5. Skips the `Cleaning` sheet.

## Input conventions

- JSON values can be inline or loaded from file using `@path`.
- Write/append expect a 2D array of values.

Example `data.json`:

```json
[
  ["Name", "Score"],
  ["Alice", 95]
]
```

## Command map (high level)

Data:

- `read`, `write`, `append`, `clear`, `batchGet`, `batchWrite`
- `highlight`, `unhighlight`, `Add apartment`
- `lease`

Formatting:

- `format`, `getFormat`, `borders`, `merge`, `unmerge`, `copyFormat`

Layout:

- `resize`, `autoResize`, `freeze`

Sheets:

- `create`, `info`, `addSheet`, `deleteSheet`, `renameSheet`

Advanced:

- `batch` (raw `spreadsheets.batchUpdate` requests)

---

## Audit Logging

### Audit Log Location

| Property       | Value                                          |
| -------------- | ---------------------------------------------- |
| Spreadsheet ID | `1x7Ch_AOuLk6Zht2ef0Q--2K_QueKvcAft-P6d0sx76A` |
| Sheet Name     | `Audit_Log`                                    |

### Audit Log Structure (Columns A-G)

| Column | Name      | Description                                                                                |
| ------ | --------- | ------------------------------------------------------------------------------------------ |
| A      | Timestamp | ISO 8601 format (e.g., `2/12/2026 14:30:45`)                                               |
| B      | User      | User identifier; set to `ASSISTANT` for CLI operations                                     |
| C      | Sheet     | Target sheet name (empty for batch operations)                                             |
| D      | Cell      | Cell reference (A1 notation); for batch operations, comma-separated list of affected cells |
| E      | Old Value | Value before change; comma-separated for batch operations                                  |
| F      | New Value | Value after change; comma-separated for batch operations                                   |
| G      | Source    | Change origin: `SYSTEM` for standard operations, `sheets-cli` for CLI invocations          |

### Commands That Create Audit Logs

Single-cell operations:

- `write` - Direct cell write
- `append` - Data append
- `clear` - Cell clear
- `format` - Cell formatting
- `highlight` - Cell highlight
- `unhighlight` - Cell unhighlight

Batch operations:

- `batchWrite` - Multiple cell writes
- `batch` - Raw `spreadsheets.batchUpdate` requests

> **Important:** Audit logs are created **only when values actually change**. No-op operations do not create log entries.

### How Logs Are Generated

- **Single-cell operations** (`write`, `append`, `clear`): Fetches old value, compares with new value, logs if different
- **Batch operations** (`batchWrite`, `batch`): Aggregates all affected cells into comma-separated lists in a single log entry
- **Timestamp format**: Automatically formatted from ISO 8601 to `M/D/YYYY HH:mm:ss` format

### Retrieve Audit Logs

```bash
# Get all audit logs
node scripts/sheets-cli.js read 1x7Ch_AOuLk6Zht2ef0Q--2K_QueKvcAft-P6d0sx76A "Audit_Log!A:G"

# Get last 50 entries
node scripts/sheets-cli.js read 1x7Ch_AOuLk6Zht2ef0Q--2K_QueKvcAft-P6d0sx76A "Audit_Log!A1:G50"

# Get last 100 entries
node scripts/sheets-cli.js read 1x7Ch_AOuLk6Zht2ef0Q--2K_QueKvcAft-P6d0sx76A "Audit_Log!A1:G100"
```

**Gmail App Password Setup:**

1. Google Account → Security → 2-Step Verification (enable)
2. App Passwords → Generate new password
3. Use the 16-character password in `EMAIL_PASS`

### Example Audit Log Entries

| Timestamp          | User      | Sheet  | Cell       | Old Value  | New Value  | Source |
| ------------------ | --------- | ------ | ---------- | ---------- | ---------- | ------ |
| 2/12/2026 14:30:45 | ASSISTANT | Sheet1 | A1         | Alice      | Bob        | SYSTEM |
| 2/12/2026 14:31:12 | ASSISTANT | Sheet1 | B1, B2, B3 | 10, 20, 30 | 15, 25, 35 | SYSTEM |

---

## Operational guidance

- Prefer read-only scope for read workflows when possible.
- Add retry with exponential backoff for `429` and transient `5xx` errors.
- Keep request payloads small to avoid limit issues.

---

## Webhook Integration

The skill includes a webhook server for automating lease agreement processing. This eliminates manual confirmation steps and integrates with e-signature services.

### Quick Start

1. **Install dependencies:**

   ```bash
   npm install
   ```

2. **Start the webhook server:**

   ```bash
   npm run webhook
   ```

3. **Use webhook mode in lease command:**

   ```bash
   node scripts/sheets-cli.js lease "John Doe has leased apartment 123 Main St Room 1 from 01/15/2026 to 07/15/2026 for amount 1200 prorate 800 number 5551234567 email john@example.com" --webhook
   ```

4. **Test the webhook:**
   ```bash
   node scripts/test-webhook.js
   ```

### Webhook Endpoint

**POST** `/webhook/agreement-signed`

Automatically updates Inventory, Cleaning, Rent Tracker, and Inventory Data sheets when a lease agreement is signed.

### Configuration

Set environment variables in `.env` or modify [config.js](scripts/src/config.js#L40):

```bash
WEBHOOK_ENABLED=true          # Enable webhook mode by default
WEBHOOK_PORT=3000             # Server port
WEBHOOK_SECRET=your-secret    # For signature validation
WEBHOOK_BASE_URL=http://localhost:3000  # Base URL
```

### Integration Examples

- **DocuSign**: Configure webhook URL in DocuSign settings
- **HelloSign**: Set callback URL when creating signature request
- **Custom**: POST to webhook endpoint when document is signed

See [WEBHOOK-INTEGRATION.md](WEBHOOK-INTEGRATION.md) for detailed documentation.

---

## Expected output

- JSON to stdout; non-zero exit code on errors.

## Security notes

- Never log or commit service account keys.
- Share spreadsheets only with the service account email required by this skill.
