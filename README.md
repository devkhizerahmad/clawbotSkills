# OpenClaw

> Minimal documentation for the OpenClaw workspace and developer quickstart.

## Overview

OpenClaw is a local workspace containing agent definitions, session history, tooling, and utility scripts. The repository stores runtime state, dev utilities, and documentation used to run and extend the platform.

## Quickstart

- **Run gateway**: execute `gateway.cmd` on Windows to start the local gateway/service.
- **Configuration**: primary configuration lives in `openclaw.json`.

Prerequisites

- Windows (this workspace was captured on Windows).
- Node.js / other runtime not strictly required for reading docs; follow specific skills or scripts in `workspace/scripts/`.

Common commands

- Start gateway (Windows):

```powershell
.
gateway.cmd
```

## Repository layout

- **agents/**: agent code, `auth.json` and profiles plus session traces in `agents/main/sessions/`.
- **canvas/**: lightweight UI assets (contains `index.html`).
- **completions/**: CLI helpers (`openclaw.ps1`, `openclaw.bash`, etc.).
- **cron/**: scheduled job definitions and run history.
- **devices/**: paired and pending device state.
- **identity/**: device identity and auth artifacts.
- **logs/**: runtime and AI interaction logs.
- **memory/**: human-readable memory notes and historical snapshots.
- **workspace/**: user-facing docs and scripts; includes `AGENTS.md`, `BOOTSTRAP.md`, `TOOLS.md`, and `skills/`.

## Working with agents and sessions

- Session logs are stored as newline-delimited JSON in `agents/main/sessions/`.
- Agent auth and profile configuration live in `agents/main/agent/`.

## Extending and contributing

- Add or update documentation under `workspace/` (e.g. `workspace/AGENTS.md`).
- Scripts for exporting or syncing history live in `workspace/scripts/`.

## Where to look next

- Read the high-level docs: `workspace/AGENTS.md`, `workspace/BOOTSTRAP.md`, `workspace/TOOLS.md`.
- Check `workspace/skills/` for example skill implementations and integration patterns.

---

## Architecture

OpenClaw is organized as a set of small, focused components that work together locally:

- **Gateway**: the local entry point (run via `gateway.cmd`) that coordinates agent requests and external integrations.
- **Agents**: runtime definitions and auth live under `agents/main/agent/`; each agent records interaction traces in `agents/main/sessions/*.jsonl`.
- **Skills**: modular integration pieces and CLIs under `workspace/skills/` (each skill contains a `SKILL.md` describing purpose, env vars and commands).
- **Storage & State**: runtime logs in `logs/`, persistent memory notes in `memory/`, and device state under `devices/` and `identity/`.
- **Automation**: scheduled jobs and job history live in `cron/`.
- **Developer tooling**: lightweight UI and helper scripts are in `canvas/`, `completions/`, and `workspace/scripts/`.

Design notes:

- Skills are intentionally file-based and self-describing so they can be added or updated without changing core code — add a new folder under `workspace/skills/` and include a `SKILL.md` and executable scripts.
- Sessions are newline-delimited JSON to make imports/exports and sync operations simple for tools and scripts.

## Skills in this workspace

The following skills are present under `workspace/skills/` with a short summary (read each skill's `SKILL.md` for full details):

- **supabase-1.0.0**: Connect to Supabase for database operations, vector search (pgvector), and storage; includes CLI helpers for SQL, upsert, and vector similarity search.
- **postgres**: PostgreSQL database management — queries, schema and index operations, backups and performance monitoring.
- **chat-history-mongodb**: Sync newline-delimited session history into MongoDB (sync scripts and npm workflow included).
- **sql-toolkit**: General SQL toolkit for SQLite/PostgreSQL/MySQL — schema design, migrations, query tuning, and backup/restore patterns.
- **google-sheets-api**: Google Sheets CLI and automation skill for read/write, batch updates, formatting, and audit-logged operations (service-account based).

---

If you'd like, I can expand this into a `docs/` folder with per-component pages (Agents, Sessions, Skills, Deploy), or add quick examples for running and debugging specific services — tell me which area to expand.
