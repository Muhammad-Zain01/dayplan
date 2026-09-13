# DayPlan

DayPlan is a local-first desktop productivity app for macOS and Windows. It connects to Todoist and provides a redesigned task workspace, daily dashboard, and an MCP server that gives AI hosts access to the same user-approved task operations.

## Current features

- Dashboard with Todoist open-task, due-today, overdue, completed-today, priority, and seven-day completion summaries.
- Today and Tasks views with search, create, edit, complete, reopen, and delete actions.
- Task creation with Inbox as the default project, project selection, due date, priority, description, and labels.
- Settings for the Todoist API token only, with save/replace/remove and connection test.
- Nine local MCP tools for Todoist task CRUD, task status changes, and project/label discovery. Every MCP write asks for approval in DayPlan.
- SQLite local settings and app data; the Todoist token is encrypted with Electron safe storage before it is saved.

The Electron migration is in progress. The preserved Swift baseline remains at the commit recorded in [ELECTRON_MIGRATION_PLAN.md](ELECTRON_MIGRATION_PLAN.md) until cross-platform feature parity is verified.

## Requirements

- Node.js 24 or later and npm.
- macOS or Windows for local desktop execution. Native modules must be installed/rebuilt on the target operating system.

## Run locally

```sh
npm install
npm run dev
```

Run checks:

```sh
npm run typecheck
npm test
npm run build
```

Package on the current OS:

```sh
npm run build
npx electron-builder --mac dmg
npx electron-builder --win nsis
```

The package for each operating system is built on that OS. GitHub Actions will build and upload both installers from the release workflow.

## Connect an MCP host

Build DayPlan, then use its Electron executable as the stdio server command with `--mcp`:

```json
{
  "mcpServers": {
    "dayplan": {
      "command": "/path/to/DayPlan",
      "args": ["--mcp"]
    }
  }
}
```

On macOS, the executable is inside `DayPlan.app/Contents/MacOS/DayPlan`. On Windows, use the installed `DayPlan.exe`. MCP setup details and host verification are still being completed.

## Local data and privacy

DayPlan creates `dayplan.sqlite3` under Electron's per-user `userData` directory. The Todoist token is encrypted in the main process with Electron's asynchronous safe-storage API before it enters SQLite. If OS-protected encryption is not available, DayPlan refuses to save the token. The database is per device/account; re-enter the token in Settings on each OS.

The app does not read or persist an environment-variable dump and does not require a `.env` file for runtime credentials.

## Project documents

- [Architecture](ARCHITECTURE.md)
- [Code standards](CODE_STANDARDS.md)
- [Electron migration plan](ELECTRON_MIGRATION_PLAN.md)
- [MCP implementation plan](MCP_IMPLEMENTATION_PLAN.md)
- [AI/MCP tool authoring skill](SKILL.md)
- [Agent instructions](AGENTS.md)
