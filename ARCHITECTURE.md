# Dayplan Architecture

## Product

Dayplan is a local-first Electron productivity app for macOS and Windows. Todoist is the first and currently only connected service. The interface, local MCP server, and future AI features use the same application services.

## Runtime

- Electron 44, React 19, TypeScript strict mode, and Vite.
- shadcn/ui composition built with Radix primitives and Tailwind CSS.
- SQLite through `better-sqlite3`, isolated behind database and repository classes.
- Todoist REST API v1 over `fetch`.
- The Todoist token is stored directly in the SQLite `settings` table. Credential reads and writes stay in the main-process service; the renderer receives configured status only.
- MCP uses the official TypeScript SDK. The existing stdio process and opt-in Streamable HTTP listener share the same tools and application services as the GUI.

## Module boundaries

```text
React renderer
  └── typed preload bridge
        └── Electron main / IPC controller
              ├── task, dashboard, settings, focus timer services
              ├── Todoist REST client
              ├── SQLite settings, focus-session, and interval repositories
              ├── native tray and desktop notifications
              └── MCP transport and tool registry
                    └── same task application services as UI
```

### Renderer and preload

React components own view state and interaction only. They call specific methods exposed with `contextBridge`. The renderer has no Node integration and cannot access SQLite, credentials, arbitrary IPC channels, the filesystem, or the shell. Main-process handlers validate their sender and payload.

### Application services and Todoist

`TaskApplicationService` implements task validation and operations. `TodoistApiClient` owns authentication, request construction, cursor pagination, API decoding, and safe errors. UI IPC and MCP tools call the same service. Todoist remains the source of truth; task-list views refresh from the API.

The task surface supports list, get, create, partial update, complete, reopen, and delete, plus project and label discovery. Task composition supports Inbox by default, project selection, due date, priority, labels, and description. Dashboard metrics come from active tasks and Todoist completion-history records; the displayed seven-day history is not inferred from a current snapshot.

### Focus timer

`FocusTimerService` in the Electron main process is the timer authority. The Focus screen, tray menu, and preload IPC call that service; the renderer receives validated snapshots and does not own countdown logic. Focus sessions support 1–240 minutes and breaks support 1–120 minutes. Users can change the remaining time of an active session; pause/resume, early end, completion notifications with audible alerts, and automatic pause on system suspend are also supported. macOS uses the native Glass notification sound; Windows uses the system notification sound. Closing the window hides the app in the tray; explicitly quitting ends and saves the active session.

`FocusSessionRepository` persists sessions and their running intervals in SQLite. Each resume creates a new interval, which allows pause time to be excluded. Daily focus totals are computed from interval overlap with local calendar days, so intervals crossing midnight count on both dates. Break intervals remain in history but are excluded from focus-time totals. A 10-second heartbeat lets startup recovery pause an interrupted run without counting the time Dayplan was not running.

The tray is created in the Electron main process. On macOS, a template icon displays the countdown next to it; on Windows, the countdown is available in the tray hover text and context menu. The countdown is recomputed from timestamps rather than decrementing a counter, which handles timer drift and sleep reliably. Native macOS notifications require a code-signed app; unsigned development builds may not deliver them.

### SQLite and secrets

The app opens `dayplan.sqlite3` below Electron's per-user `userData` path and applies ordered migrations. SQLite stores app settings and app-owned data, including focus sessions and intervals, persisted focus/break duration preferences, the selected appearance mode, the opt-in MCP HTTP enabled flag, and the Todoist token. The token is stored directly as UTF-8 bytes in the `settings` table; it is plain text at rest in the local database. Credential reads and writes stay in the main process, and the renderer receives configured status rather than the saved value. Legacy ciphertext values from earlier builds are treated as unconfigured; entering and saving the token again replaces the old value.

### MCP

The existing MCP server runs with `--mcp` in a hidden Electron process and speaks stdio through the official TypeScript SDK. The optional HTTP server uses the SDK Streamable HTTP handler and Node adapter at `http://127.0.0.1:47631/mcp`. Settings persists its default-off enabled preference; the listener starts with the GUI when enabled and stops on disable or app exit. It binds only to loopback and uses the SDK Host and Origin validation guards. It has no authentication, so local processes may read task data.

Both transports register the same seventeen tools: nine Todoist task, project, and label tools plus eight focus timer and statistics tools. Focus timer writes call `FocusTimerService` and require the same Dayplan-owned approval as task mutations. A stdio helper shares the SQLite session repository; while the GUI is open, its main-process service observes those changes and updates the tray, renderer, and notifications. Inputs are schema-validated and bounded. HTTP startup failure, including an occupied port, leaves the GUI available and is shown in Settings. Stdio protocol output stays on stdout; diagnostics are sent to stderr.

### Settings

Settings provides System, Light, and Dark appearance choices stored locally, plus the Todoist API token flow, including save, replace, remove, configured status, and a connection test. The persisted MCP HTTP toggle is read and controlled through narrow sender-validated preload/IPC methods; the renderer receives status but no generic server or IPC access. The renderer applies appearance immediately and follows operating-system changes while System is selected.

## Data locations

Electron chooses a per-user application data directory through `app.getPath('userData')` on both platforms. The database file is `dayplan.sqlite3` within that directory. No `.env` file or plaintext credential file is used.

## Performance and reliability

- Network and SQLite operations stay outside React render functions.
- Countdown display updates are driven by one main-process timer service and do not keep a renderer interval alive while the window is hidden.
- The renderer remains sandboxed and the main event loop is not used for long synchronous work except bounded SQLite queries.
- Paginated Todoist requests detect repeated cursors and have request timeouts.
- Screens include loading, empty, and error states. Dashboard metrics show their source and refresh time.
- Release readiness requires Electron ABI rebuilds, tests, and package verification on macOS and Windows.

## Release status

Windows packaging and release verification are still pending. See the [desktop implementation plan](DESKTOP_IMPLEMENTATION_PLAN.md) for current progress and remaining work.
