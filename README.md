# Dayplan

Dayplan is a local-first desktop productivity app for macOS and Windows. It connects to Todoist and provides a redesigned task workspace, daily dashboard, and an MCP server that gives AI hosts access to the same user-approved task operations.

## Current features

- Dashboard with Todoist open-task, due-today, overdue, completed-today, priority, and seven-day completion summaries.
- Today and Tasks views with search, create, edit, complete, reopen, and delete actions.
- Task creation with Inbox as the default project, project selection, due date, priority, description, and labels.
- Settings for the System/Light/Dark appearance and Todoist API token, with save/replace/remove and connection test.
- Nine local MCP tools for Todoist task CRUD, task status changes, and project/label discovery. Every MCP write asks for approval in Dayplan.
- SQLite local settings and app data, including the Todoist token.

Windows packaging and release validation are still pending.

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

Build Dayplan, then use its Electron executable as the stdio server command with `--mcp`:

```json
{
  "mcpServers": {
    "dayplan": {
      "command": "/path/to/Dayplan",
      "args": ["--mcp"]
    }
  }
}
```

On macOS, the executable is inside `Dayplan.app/Contents/MacOS/Dayplan`. On Windows, use the installed `Dayplan.exe`. MCP setup details and host verification are still being completed.

## Local data and privacy

Dayplan creates `dayplan.sqlite3` under Electron's per-user `userData` directory. The Todoist token is stored directly in the SQLite `settings` table as plain text at rest. Credential reads and writes stay in the main process, and the saved token is not returned to the renderer. The database is per device/account; enter the token in Settings on each OS.

The app does not read or persist an environment-variable dump and does not require a `.env` file for runtime credentials.

## Project documents

- [Architecture](ARCHITECTURE.md)
- [Code standards](CODE_STANDARDS.md)
- [Desktop implementation plan](DESKTOP_IMPLEMENTATION_PLAN.md)
- [MCP implementation plan](MCP_IMPLEMENTATION_PLAN.md)
- [AI/MCP tool authoring skill](SKILL.md)
- [Agent instructions](AGENTS.md)
