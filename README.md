# Dayplan

Dayplan is a local-first desktop productivity app for macOS and Windows. It connects to Todoist and provides a redesigned task workspace, daily dashboard, and an MCP server that gives AI hosts access to the same user-approved task operations.

## Current features

- Dashboard with Todoist open-task, due-today, overdue, completed-today, priority, and seven-day completion summaries.
- Focus timer with editable 1–240-minute focus sessions and 1–120-minute breaks, active-time adjustment, pause/resume, and local daily focus history.
- Dayplan menu-bar/system-tray controls. The countdown appears beside the macOS menu-bar icon and in the Windows tray tooltip/menu. Closing the window hides Dayplan so the timer can continue.
- Focus and break completion notifications with an audible alert (the macOS Glass sound and the system notification sound on Windows). The timer pauses when the computer sleeps; quitting Dayplan ends an active session and saves its actual focus time.
- Today and Tasks views with search, create, edit, complete, reopen, and delete actions.
- Task creation with Inbox as the default project, project selection, due date, priority, description, and labels.
- Settings for the System/Light/Dark appearance, Todoist API token, and optional local MCP HTTP server.
- Seventeen local MCP tools for Todoist tasks, project/label discovery, focus timer controls, and focus statistics. Every MCP write or timer control asks for approval in Dayplan.
- SQLite local settings and app data, including the Todoist token.

Focus sessions, active intervals, and timer duration preferences are stored locally in SQLite. Focus duration defaults to 30 minutes and break duration to five minutes. Paused time and breaks are excluded from focus totals, and sessions crossing local midnight are split across the relevant days. See the [focus timer plan](FOCUS_TIMER_IMPLEMENTATION_PLAN.md) for behavior, data model, and verification details.

macOS requires a code-signed app for native notifications. They may not appear when running an unsigned development build; tray controls and timer state are still available.

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

Dayplan supports both stdio and local Streamable HTTP MCP connections. The existing stdio setup remains useful for hosts that launch a local process:

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

On macOS, the executable is inside `Dayplan.app/Contents/MacOS/Dayplan`. On Windows, use the installed `Dayplan.exe`.

For Codex, open Dayplan Settings and enable **Local MCP server**. Add this entry to Codex's MCP configuration:

```toml
[mcp_servers.dayplan]
url = "http://127.0.0.1:47631/mcp"
```

Keep Dayplan open while Codex uses the server. The endpoint starts automatically with the app whenever the setting is enabled and stops when the app quits. It listens only on `127.0.0.1`; Host and Origin headers are checked. There is no authentication, so other local applications can read Todoist task data. Writes still require confirmation in Dayplan. If port `47631` is occupied, Settings reports the problem; close the process using that port, then turn the server off and on again. The endpoint is not available to Codex on another machine.

## Local data and privacy

Dayplan creates `dayplan.sqlite3` under Electron's per-user `userData` directory. The Todoist token is stored directly in the SQLite `settings` table as plain text at rest. Credential reads and writes stay in the main process, and the saved token is not returned to the renderer. Local appearance, MCP server preference, and focus data are stored in the same per-user database. The database is per device/account; enter the token in Settings on each OS.

The app does not read or persist an environment-variable dump and does not require a `.env` file for runtime credentials.

## Project documents

- [Architecture](ARCHITECTURE.md)
- [Code standards](CODE_STANDARDS.md)
- [Desktop implementation plan](DESKTOP_IMPLEMENTATION_PLAN.md)
- [Focus timer plan](FOCUS_TIMER_IMPLEMENTATION_PLAN.md)
- [MCP implementation plan](MCP_IMPLEMENTATION_PLAN.md)
- [AI/MCP tool authoring skill](SKILL.md)
- [Agent instructions](AGENTS.md)
