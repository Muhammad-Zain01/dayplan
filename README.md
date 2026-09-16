<h1 align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/branding/dayplan-logo-dark.svg">
    <source media="(prefers-color-scheme: light)" srcset="assets/branding/dayplan-logo-light.svg">
    <img src="assets/branding/dayplan-logo-light.svg" alt="Dayplan" width="320">
  </picture>
</h1>

<p align="center">A calm, local-first desktop workspace for planning tasks and protecting your focus.</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-348E7C?style=flat-square" alt="MIT License"></a>
  <img src="https://img.shields.io/badge/status-in%20development-F58234?style=flat-square" alt="In development">
  <img src="https://img.shields.io/badge/version-0.2.0-5C6B68?style=flat-square" alt="Version 0.2.0">
  <img src="https://img.shields.io/badge/Electron-44.3.0-47848F?logo=electron&logoColor=white&style=flat-square" alt="Electron 44.3.0">
  <img src="https://img.shields.io/badge/React-19.2-149ECA?logo=react&logoColor=white&style=flat-square" alt="React 19.2">
  <img src="https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white&style=flat-square" alt="TypeScript 5.9">
  <img src="https://img.shields.io/badge/Vite-7-646CFF?logo=vite&logoColor=white&style=flat-square" alt="Vite 7">
</p>

<p align="center">
  <a href="#features">Features</a> ·
  <a href="#run-locally">Run locally</a> ·
  <a href="#connect-an-mcp-host">MCP</a> ·
  <a href="#local-data-and-privacy">Privacy</a>
</p>

Dayplan is a macOS and Windows desktop app for keeping Todoist work, local focus sessions, and multiple personal workspaces in one quiet, dependable place. Your data stays on your device while Todoist remains the source of truth for remote tasks.

## Features

- Dashboard with Todoist open-task, due-today, overdue, completed-today, priority, and seven-day completion summaries.
- Focus timer with editable 1–240-minute focus sessions and 1–120-minute breaks, active-time adjustment, pause/resume, a 24-hour focus view, and local daily focus history.
- Dayplan menu-bar/system-tray controls. The countdown appears beside the macOS menu-bar icon and in the Windows tray tooltip/menu. Closing the window hides Dayplan so the timer can continue.
- Focus and break completion notifications with an audible alert (the macOS Glass sound and the system notification sound on Windows). The timer pauses when the computer sleeps; quitting Dayplan ends an active session and saves its actual focus time.
- Today and Tasks views with search, create, edit, complete, reopen, and delete actions.
- Task creation with Inbox as the default project, project selection, due date, priority, description, and labels.
- Settings for the System/Light/Dark appearance, Todoist API token, and optional local MCP HTTP server.
- First-run onboarding for the owner name, first workspace, optional Todoist connection, and focus/break defaults. Existing installations migrate into a Personal workspace without requiring the token again.
- Multiple workspaces with independent Todoist tokens, focus settings, and focus history. Workspaces can be renamed, archived, and restored; Todoist tasks stay remote and are never deleted by archiving.
- Nineteen local MCP tools for workspace discovery, Todoist tasks (including completed-task history by date range), project/label discovery, focus timer controls, and focus statistics. Task writes and timer controls run after validation; deleting a task requires confirmation because Todoist also deletes its subtasks. Workspace-scoped tools require an explicit `workspace_id`.
- SQLite local settings and app data, including the owner profile, selected workspace, per-workspace Todoist tokens, and focus history.

## Project status

Dayplan is under active development. The macOS app is the primary local test target; Windows packaging and release validation are still pending. Screenshots will be added as the interface settles.

Focus sessions, active intervals, and timer duration preferences are stored locally in SQLite. Focus duration defaults to 30 minutes and break duration to five minutes. Paused time and breaks are excluded from focus totals, and sessions crossing local midnight are split across the relevant days. The Focus screen derives an hourly local-day series from those intervals alongside the 7/30-day history. See the [architecture notes](ARCHITECTURE.md#focus-timer) for behavior and data boundaries.

macOS requires a code-signed app for native notifications. They may not appear when running an unsigned development build; tray controls and timer state are still available.

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

Keep Dayplan open while Codex uses the server. The endpoint starts automatically with the app whenever the setting is enabled and stops when the app quits. It listens only on `127.0.0.1`; Host and Origin headers are checked. There is no authentication, so other local applications can read and change Todoist task data. Only deleting a task requires Dayplan confirmation. Call `workspace_list` to discover active workspace IDs, then include the chosen `workspace_id` in task and focus tool calls. If port `47631` is occupied, Settings reports the problem; close the process using that port, then turn the server off and on again. The endpoint is not available to Codex on another machine.

## Local data and privacy

Dayplan creates `dayplan.sqlite3` under Electron's per-user `userData` directory. Todoist tokens and focus-duration preferences are stored per workspace in SQLite's `workspace_settings` table; tokens are plain text at rest and remain main-process-only. Global appearance and the MCP server preference stay in the `settings` table. The owner profile, selected workspace, focus sessions, and intervals are also stored locally. The saved token is never returned to the renderer. Workspaces are local organizational boundaries: connecting the same Todoist account in multiple workspaces exposes that account's same remote tasks in each one.

The app does not read or persist an environment-variable dump and does not require a `.env` file for runtime credentials.

## Project documents

- [Architecture](ARCHITECTURE.md)
- [Code standards](CODE_STANDARDS.md)
- [Desktop implementation plan](DESKTOP_IMPLEMENTATION_PLAN.md)
- [MCP implementation plan](MCP_IMPLEMENTATION_PLAN.md)
- [Workspace and onboarding plan](WORKSPACE_IMPLEMENTATION_PLAN.md)
- [AI/MCP tool authoring skill](SKILL.md)
- [Agent instructions](AGENTS.md)
