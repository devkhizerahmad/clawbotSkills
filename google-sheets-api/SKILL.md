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

## Input conventions
- JSON values can be inline or loaded from file using `@path`.
- Write/append expect a 2D array of values.

## Input Rules
- If cleaning sheet is being edited and you have been asked to update the cleaning date, make sure to update the cleaning date column (Column W) in the Cleaning sheet.

Example `data.json`:
```json
[["Name","Score"],["Alice",95]]
```

## Command map (high level)
Data:
- `read`, `write`, `append`, `clear`, `batchGet`, `batchWrite`

Formatting:
- `format`, `getFormat`, `borders`, `merge`, `unmerge`, `copyFormat`

Layout:
- `resize`, `autoResize`, `freeze`

Sheets:
- `create`, `info`, `addSheet`, `deleteSheet`, `renameSheet`

Advanced:
- `batch` (raw `spreadsheets.batchUpdate` requests)

---

## Auto-Formatting

### Cleaning Sheet - Cleaning Date Column (W)
When the Cleaning Date column (Column W) is modified in the Cleaning sheet, the cell automatically changes to light blue (#caedfb).

| Property | Value |
|----------|-------|
| Spreadsheet ID | `1RobrLNYSmMUyq53dUcdmj2ePaU2YkagqLqgIgx7M4OU` |
| Sheet Name | `Cleaning` |
| Column | `W` (Cleaning Date) |
| Color | `#caedfb` (Light Blue) |

This formatting only applies to:
- The specific cell that was modified
- Only Column W in the Cleaning sheet
- Only when modified via CLI commands (`write`, `append`)

Example:
```bash
# Update Cleaning Date - cell will turn light blue
node scripts/sheets-cli.js write 1RobrLNYSmMUyq53dUcdmj2ePaU2YkagqLqgIgx7M4OU "Cleaning!W5" '"2026-01-20"'
```

---

## Email Notifications

### Cleaning Date Modification Alerts
When the Cleaning Date column (Column W) is modified in the Cleaning sheet, an email notification is automatically sent.

| Property | Value |
|----------|-------|
| Trigger | Column W (Cleaning Date) modification |
| Recipient | Configured via `EMAIL_RECIPIENT` env variable |
| Format | HTML email with old/new values |

**Email Contents:**
- Cell reference
- Old value
- New value
- Timestamp

**Setup:**
```bash
# .env file
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
EMAIL_RECIPIENT=recipient@example.com
```

**Gmail App Password Setup:**
1. Google Account → Security → 2-Step Verification (enable)
2. App Passwords → Generate new password
3. Use the 16-character password in `EMAIL_PASS`

---

## Audit Logging

### Audit Log Location
| Property | Value |
|----------|-------|
| Spreadsheet ID | `1x7Ch_AOuLk6Zht2ef0Q--2K_QueKvcAft-P6d0sx76A` |
| Sheet Name | `Audit_Log` |

### Audit Log Structure (Columns A-G)
| Column | Name | Description |
|--------|------|-------------|
| A | Timestamp | ISO 8601 format (e.g., `2/12/2026 14:30:45`) |
| B | User | User identifier; set to `ASSISTANT` for CLI operations |
| C | Sheet | Target sheet name (empty for batch operations) |
| D | Cell | Cell reference (A1 notation); for batch operations, comma-separated list |
| E | Old Value | Value before change; comma-separated for batch operations |
| F | New Value | Value after change; comma-separated for batch operations |
| G | Source | Change origin: `SYSTEM` for standard operations |

### Commands That Create Audit Logs
Single-cell operations:
- `write` - Direct cell write
- `append` - Data append
- `clear` - Cell clear
- `format` - Cell formatting

Batch operations:
- `batchWrite` - Multiple cell writes
- `batch` - Raw `spreadsheets.batchUpdate` requests

> **Important:** Audit logs are created **only when values actually change**. No-op operations do not create log entries.

### Retrieve Audit Logs
```bash
# Get all audit logs
node scripts/sheets-cli.js read 1x7Ch_AOuLk6Zht2ef0Q--2K_QueKvcAft-P6d0sx76A "Audit_Log!A:G"

# Get last 50 entries
node scripts/sheets-cli.js read 1x7Ch_AOuLk6Zht2ef0Q--2K_QueKvcAft-P6d0sx76A "Audit_Log!A1:G50"

# Get last 100 entries
node scripts/sheets-cli.js read 1x7Ch_AOuLk6Zht2ef0Q--2K_QueKvcAft-P6d0sx76A "Audit_Log!A1:G100"
```

---

## Operational guidance
- Prefer read-only scope for read workflows when possible.
- Add retry with exponential backoff for `429` and transient `5xx` errors.
- Keep request payloads small to avoid limit issues.

## Expected output
- JSON to stdout; non-zero exit code on errors.

## Security notes
- Never log or commit service account keys.
- Share spreadsheets only with the service account email required by this skill.
