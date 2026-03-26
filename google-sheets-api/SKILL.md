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

# Bulk update operations
node scripts/sheets-cli.js allUpdatesCleaning 1RobrLNYSmMUyq53dUcdmj2ePaU2YkagqLqgIgx7M4OU "add" "7" "days"
node scripts/sheets-cli.js allUpdatesCleaning 1RobrLNYSmMUyq53dUcdmj2ePaU2YkagqLqgIgx7M4OU "subtract" "1" "months"
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

- If cleaning sheet is being edited and you have been asked to update the cleaning date, make sure to update the cleaning date column (Column X) in the Cleaning sheet.
- **Syncing Apartments**: If the user asks to "Add apartment [apartment name]" or sync apartment data, use the `node scripts/sheets-cli.js Add apartment "[apartment name]"` command. This command automatically:
  1. Fetches data and room links from Google Drive.
  2. Updates the `Unit_Availability_Details` table in the Inventory sheet (preserving existing row data).
  3. Updates the `Inventory Data` and `Rent Tracker` sheets.
  4. Applies necessary formatting and borders.
  5. Skips the `Cleaning` sheet.
- **Generating Reconciliation Report**: If the user asks to "Generate Reconciliation Report", use the `node scripts/sheets-cli.js generate-reconciliation-report` command. This command automatically:
  1. Fetches data from the `Rent Reconciliation` sheet.
  2. Generates a PDF report with the reconciliation data.
  3. Send the PDF report to the user.
- **GET Lease Contract Status**: if user ask for lease contract status, use the `node scripts/sheets-cli.js get-contract-status <email>` command. This command automatically:
  1. Fetches data from the `lease-apartment-contract` collection in MongoDB.
  2. Returns the status of the lease contract.

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

## Command map

Date Operations:

- `allUpdatesCleaning <spreadsheetId> <add|subtract> <amount> <days|weeks|months|years>` — Arithmetic on all dates in Column X

Data:

- `read`, `write`, `append`, `clear`, `batchGet`, `batchWrite`
- `highlight`, `unhighlight`, `Add apartment`, `generate-reconciliation-report`
- `lease`, `get-contract-status`

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
| Spreadsheet ID | `1RobrLNYSmMUyq53dUcdmj2ePaU2YkagqLqgIgx7M4OU` |
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

Date arithmetic operations:

- `allUpdatesCleaning` — Updates multiple cells and creates audit entries for each date change with detailed before/after values

Single-cell operations:

- `write` — Direct cell write with old/new value comparison
- `append` — Data append operations
- `clear` — Cell clear operations
- `format` — Cell formatting changes
- `highlight` — Cell highlight with color tracking
- `unhighlight` — Cell unhighlight operations

Cleaning date automation (automatic audit logging when cleaning dates are modified):

- **Cell formatting** — Automatic color coding based on move-out status with detailed audit trail:
  - Light blue (#caedfb) for move-out cleaning
  - Yellow for regular cleaning
  - Logs include move-out status and color applied
- **Email notifications** — Comprehensive email service audit logging:
  - Email preparation and recipient lookup
  - Successful sends with subject line and cleaning type
  - Failed sends with error details
  - Skipped emails (invalid addresses, missing config)
  - All entries include move-out status tracking

Complex multi-sheet operations:

- `Add apartment` — Comprehensive audit logging for:
  - Operation start and completion
  - Apartment fetch from Google Drive
  - Inventory table updates (room count changes, row additions/deletions)
  - Inventory Data sheet block updates
  - Rent Tracker sheet block updates
  - Skipped updates when data already exists
  - All mutations include detailed room names and counts

- `lease` — Comprehensive audit logging for:
  - Lease operation start with raw input text
  - Parsed lease details (tenant, apartment, room, rent, dates, contact info)
  - PDF agreement generation with file path tracking
  - Email sending (both successful sends and skipped emails)
  - Inventory Sheet updates (tenant name, rent, dates, status changes)
  - Cleaning Sheet updates (tenant and contact info per room)
  - Rent Tracker Sheet updates (tenant, rent, email, phone)
  - Inventory Data Sheet updates (tenant and rent)
  - Operation completion with summary

Batch operations:

- `batchWrite` — Multiple cell writes with aggregated logs
- `batch` — Raw `spreadsheets.batchUpdate` requests

> **Important:** Audit logs are created **only when values actually change**. No-op operations do not create log entries.

### How Logs Are Generated

- **Bulk update operations** (`allUpdatesCleaning`): Creates separate log entry for each cell that changes, capturing old and new date values
- **Single-cell operations** (`write`, `append`, `clear`): Fetches old value, compares with new value, logs if different with detailed change descriptions
- **Complex commands** (`Add apartment`, `lease`): Multiple log entries throughout the operation lifecycle including:
  - Operation start with input parameters
  - Individual sheet updates with before/after state comparison
  - Skipped operations when data already matches
  - Operation completion summary
- **Batch operations** (`batchWrite`, `batch`): Aggregates all affected cells into comma-separated lists in a single log entry
- **Timestamp format**: Automatically formatted from ISO 8601 to `M/D/YYYY HH:mm:ss` format
- **User tracking**: All CLI operations use the username from `--user` flag or default to command-specific identifiers (e.g., `CLI_Admin`, `LEASE_CMD`, `LEASE_SERVICE`)

### Retrieve Audit Logs

```bash
# Get all audit logs
node scripts/sheets-cli.js read 1RobrLNYSmMUyq53dUcdmj2ePaU2YkagqLqgIgx7M4OU "Audit_Log!A:G"

# Get last 50 entries
node scripts/sheets-cli.js read 1RobrLNYSmMUyq53dUcdmj2ePaU2YkagqLqgIgx7M4OU "Audit_Log!A1:G50"

# Get last 100 entries
node scripts/sheets-cli.js read 1RobrLNYSmMUyq53dUcdmj2ePaU2YkagqLqgIgx7M4OU "Audit_Log!A1:G100"
```

**Gmail App Password Setup:**

1. Google Account → Security → 2-Step Verification (enable)
2. App Passwords → Generate new password
3. Use the 16-character password in `EMAIL_PASS`

### Example Audit Log Entries

Basic operations:

| Timestamp          | User      | Sheet  | Cell       | Old Value  | New Value  | Source |
| ------------------ | --------- | ------ | ---------- | ---------- | ---------- | ------ |
| 2/12/2026 14:30:45 | ASSISTANT | Sheet1 | A1         | Alice      | Bob        | SYSTEM |
| 2/12/2026 14:31:12 | ASSISTANT | Sheet1 | B1, B2, B3 | 10, 20, 30 | 15, 25, 35 | SYSTEM |

Add apartment command examples:

| Timestamp         | User      | Sheet                | Cell       | Old Value                          | New Value                                                                    | Source               |
| ----------------- | --------- | -------------------- | ---------- | ---------------------------------- | ---------------------------------------------------------------------------- | -------------------- |
| 3/3/2026 10:15:23 | CLI_Admin | Operation_Start      | N/A        | N/A                                | Starting addApartment operation for: The Clarendon                           | addApartment Command |
| 3/3/2026 10:15:25 | CLI_Admin | Apartment_Fetch      | N/A        | Not Found                          | Found apartment: The Clarendon with 5 rooms                                  | addApartment Command |
| 3/3/2026 10:15:28 | CLI_Admin | Inventory            | Rows 10-14 | 3 rooms                            | 5 rooms (Updated) - Apartment: The Clarendon, Rooms: 101, 102, 103, 104, 105 | addApartment Command |
| 3/3/2026 10:15:32 | CLI_Admin | Inventory Data       | Rows 45-47 | 3 rooms - Apartment: The Clarendon | 5 rooms (Updated) - Apartment: The Clarendon, Rooms: 101, 102, 103, 104, 105 | addApartment Command |
| 3/3/2026 10:15:35 | CLI_Admin | Rent Tracker         | Rows 52-54 | 3 rooms - Apartment: The Clarendon | 5 rooms (Updated) - Apartment: The Clarendon, Rooms: 101, 102, 103, 104, 105 | addApartment Command |
| 3/3/2026 10:15:36 | CLI_Admin | Operation_Completion | N/A        | Operation Started                  | Operation completed successfully for The Clarendon with 5 rooms              | addApartment Command |

Lease command examples:

| Timestamp         | User          | Sheet           | Cell | Old Value              | New Value                                                                   | Source        |
| ----------------- | ------------- | --------------- | ---- | ---------------------- | --------------------------------------------------------------------------- | ------------- |
| 3/3/2026 11:20:15 | LEASE_CMD     | Lease_Start     | N/A  | N/A                    | Starting lease command with details: John Smith has leased...               | LEASE_CMD     |
| 3/3/2026 11:20:16 | LEASE_CMD     | Lease_Details   | N/A  | Raw Text               | Tenant: John Smith, Apartment: The Clarendon, Room: 101, Rent: $1200...     | LEASE_CMD     |
| 3/3/2026 11:20:18 | LEASE_CMD     | Lease_PDF       | N/A  | N/A                    | Generating lease agreement PDF for John Smith - Apartment: The Clarendon... | LEASE_CMD     |
| 3/3/2026 11:20:22 | LEASE_CMD     | Lease_PDF       | N/A  | PDF Generation Started | PDF generated successfully: /home/user/Downloads/John Smith Sublease...     | LEASE_CMD     |
| 3/3/2026 11:20:23 | LEASE_CMD     | Lease_Email     | N/A  | N/A                    | Sending lease agreement to john@example.com for John Smith                  | LEASE_CMD     |
| 3/3/2026 11:20:25 | LEASE_CMD     | Lease_Email     | N/A  | Email Not Sent         | Lease agreement sent successfully to john@example.com for John Smith        | LEASE_CMD     |
| 3/3/2026 11:20:28 | LEASE_SERVICE | Lease_Operation | N/A  | N/A                    | Starting lease operation for John Smith - Apartment: The Clarendon...       | LEASE_SERVICE |

Cleaning date automation examples (with isMoveout flag):

| Timestamp         | User                   | Sheet                       | Cell         | Old Value                   | New Value                                                                                                               | Source           |
| ----------------- | ---------------------- | --------------------------- | ------------ | --------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ---------------- |
| 3/6/2026 09:15:30 | CLEANING_FORMATTER     | Cleaning_Date_Format        | Cleaning!X10 | 2026-03-01 (empty)          | 2026-03-15 \| Move-out: Yes                                                                                             | CLEANING_SERVICE |
| 3/6/2026 09:15:32 | CLEANING_FORMATTER     | Cleaning                    | X10          | Previous color              | Applied Light Blue (#caedfb) background (Move-out: Yes)                                                                 | CLEANING_SERVICE |
| 3/6/2026 09:15:33 | CLEANING_EMAIL_SERVICE | Cleaning_Email_Notification | X10          | Email not sent              | Preparing email to tenant@example.com \| Move-out: Yes                                                                  | CLEANING_SERVICE |
| 3/6/2026 09:15:35 | CLEANING_EMAIL_SERVICE | Cleaning_Email_Sent         | X10          | Email pending               | Email sent to tenant@example.com \| Subject: Cleaning Date Updated - Cleaning!X10 (Move-out) \| Type: Move-out Cleaning | CLEANING_SERVICE |
| 3/6/2026 10:22:45 | CLEANING_FORMATTER     | Cleaning_Date_Format        | Cleaning!X15 | 2026-03-10                  | 2026-03-20 \| Move-out: No                                                                                              | CLEANING_SERVICE |
| 3/6/2026 10:22:47 | CLEANING_FORMATTER     | Cleaning                    | X15          | Previous color              | Applied Yellow background (Move-out: No)                                                                                | CLEANING_SERVICE |
| 3/6/2026 10:22:48 | CLEANING_EMAIL_SERVICE | Cleaning_Email_Notification | X15          | Email not sent              | Preparing email to manager@example.com \| Move-out: No                                                                  | CLEANING_SERVICE |
| 3/6/2026 10:22:50 | CLEANING_EMAIL_SERVICE | Cleaning_Email_Sent         | X15          | Email pending               | Email sent to manager@example.com \| Subject: Cleaning Date Updated - Cleaning!X15 \| Type: Regular Cleaning            | CLEANING_SERVICE |
| 3/6/2026 11:05:12 | CLEANING_EMAIL_SERVICE | Cleaning_Email_Error        | X20          | Valid email expected        | Invalid email format: invalid-email - Email skipped                                                                     | CLEANING_SERVICE |
| 3/6/2026 11:10:22 | CLEANING_EMAIL_SERVICE | Cleaning_Email_Error        | X25          | Email sending attempted     | Failed to send email to bounced@example.com: Mail delivery failed                                                       | CLEANING_SERVICE |
| 3/3/2026 11:20:30 | LEASE_SERVICE          | Inventory                   | D15:U15      | Tenant: , Status: Available | Tenant: John Smith, Start: 3/1/2026, Rent: $1200, Prorate: $1200, Status: Occupied                                      | LEASE_SERVICE    |
| 3/3/2026 11:20:32 | LEASE_SERVICE          | Cleaning                    | AD10:AE10    | Tenant: , Contact:          | Room 1: Tenant: John Smith, Contact: 5551234567                                                                         | LEASE_SERVICE    |
| 3/3/2026 11:20:34 | LEASE_SERVICE          | Rent Tracker                | D25:H25      | Tenant: , Rent:             | Room 1: Tenant: John Smith, Rent: $1200, Email: john@example.com, Contact: 5551234567                                   | LEASE_SERVICE    |
| 3/3/2026 11:20:36 | LEASE_SERVICE          | Inventory Data              | D35:E35      | Tenant: , Rent:             | Room 1: Tenant: John Smith, Rent: $1200                                                                                 | LEASE_SERVICE    |
| 3/3/2026 11:20:37 | LEASE_SERVICE          | Lease_Completion            | N/A          | Operation Started           | Lease completed successfully for John Smith - Apartment: The Clarendon...                                               | LEASE_SERVICE    |

---

## Cleaning Sheet Automation

When working with the Cleaning sheet, the system provides automated functionality:

- **Date Column**: Column X is monitored for cleaning date changes
- **Color Formatting**: When a date is changed in Column X, the cell is automatically formatted based on move-out status:
  - **Move-out cleaning** (`--moveout` flag): Light blue background (`#caedfb`)
  - **Regular cleaning** (default): Yellow background
- **Email Notifications**: When a date changes, an email notification is sent to the contact email found in the 'Contacts' column for that specific row
- **Contact Lookup**: The system identifies the correct contact by finding the 'Contacts' column in row 1 and extracting the email from the same row as the date change
- **Move-out Status**: Email notifications include whether the cleaning is a move-out or regular cleaning

### Write Command with Move-out Flag

When updating cleaning dates using the `write` command, you can specify if it's a move-out cleaning:

```bash
# Regular cleaning date update (yellow cell color)
node scripts/sheets-cli.js write <spreadsheetId> "Cleaning!X10" "2026-03-15"

# Move-out cleaning date update (light blue cell color)
node scripts/sheets-cli.js write <spreadsheetId> "Cleaning!X10" "2026-03-15" --moveout
```

**User Interaction**: Before changing a cleaning date, the system should ask the user:

- "Is this a move-out cleaning? (yes/no)"
- If yes/true: Apply light blue color and mark as move-out in email notification
- If no/false: Apply yellow color and mark as regular cleaning in email notification

## Bulk Updates Cleaning Command

```bash
# Add 5 days to all dates in Column X
allUpdatesCleaning <spreadsheetId> add 5 days

# Add 2 weeks to all dates in Column X
allUpdatesCleaning <spreadsheetId> add 2 weeks

# Subtract 1 month from all dates in Column X
allUpdatesCleaning <spreadsheetId> subtract 1 months

# Add 1 year to all dates in Column X
allUpdatesCleaning <spreadsheetId> add 1 years
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
