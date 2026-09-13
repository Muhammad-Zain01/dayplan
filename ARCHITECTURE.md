# Dayplan Architecture

## Product

Dayplan is a local-first Electron productivity app for macOS and Windows. Todoist is the first and currently only connected service. The interface, local MCP server, and future AI features use the same application services.

## Runtime

- Electron 44, React 19, TypeScript strict mode, and Vite.
- shadcn/ui composition built with Radix primitives and Tailwind CSS.
- SQLite through `better-sqlite3`, isolated behind database and repository classes.
- Todoist REST API v1 over `fetch`.
- The Todoist token is stored directly in the SQLite `settings` table. Credential reads and writes stay in the main-process service; the renderer receives configured status only.
- MCP uses the official TypeScript SDK and stdio, launched through a hidden Electron main-process invocation so it shares database, safe storage, and use cases with the GUI.

## Module boundaries

```text
React renderer
  └── typed preload bridge
        └── Electron main / IPC controller
              ├── task, dashboard, settings application services
              ├── Todoist REST client
              ├── SQLite settings and data repositories
              └── MCP transport and tool registry
                    └── same task application services as UI
```

### Renderer and preload

React components own view state and interaction only. They call specific methods exposed with `contextBridge`. The renderer has no Node integration and cannot access SQLite, credentials, arbitrary IPC channels, the filesystem, or the shell. Main-process handlers validate their sender and payload.

### Application services and Todoist

`TaskApplicationService` implements task validation and operations. `TodoistApiClient` owns authentication, request construction, cursor pagination, API decoding, and safe errors. UI IPC and MCP tools call the same service. Todoist remains the source of truth; task-list views refresh from the API.

The task surface supports list, get, create, partial update, complete, reopen, and delete, plus project and label discovery. Task composition supports Inbox by default, project selection, due date, priority, labels, and description. Dashboard metrics come from active tasks and Todoist completion-history records; the displayed seven-day history is not inferred from a current snapshot.

### SQLite and secrets

The app opens `dayplan.sqlite3` below Electron's per-user `userData` path and applies ordered migrations. SQLite stores app settings and app-owned data, including the selected appearance mode and the Todoist token. The token is stored directly as UTF-8 bytes in the `settings` table; it is plain text at rest in the local database. Credential reads and writes stay in the main process, and the renderer receives configured status rather than the saved value. Legacy ciphertext values from earlier builds are treated as unconfigured; entering and saving the token again replaces the old value.

### MCP

The MCP server runs with `--mcp` in a hidden Electron process and speaks stdio through the official TypeScript SDK. Its nine tools cover Todoist task list/get/create/update/complete/reopen/delete and project/label discovery. Inputs are schema-validated and bounded. Reads execute directly; writes show a Dayplan confirmation dialog before calling shared task services. Delete approval states that Todoist also deletes subtasks. Diagnostics are sent only to stderr.

### Settings

Settings provides System, Light, and Dark appearance choices stored locally, plus the Todoist API token flow, including save, replace, remove, configured status, and a connection test. The renderer applies the selected mode immediately and follows operating-system changes while System is selected.

## Data locations

Electron chooses a per-user application data directory through `app.getPath('userData')` on both platforms. The database file is `dayplan.sqlite3` within that directory. No `.env` file or plaintext credential file is used.

## Performance and reliability

- Network and SQLite operations stay outside React render functions.
- The renderer remains sandboxed and the main event loop is not used for long synchronous work except bounded SQLite queries.
- Paginated Todoist requests detect repeated cursors and have request timeouts.
- Screens include loading, empty, and error states. Dashboard metrics show their source and refresh time.
- Release readiness requires Electron ABI rebuilds, tests, and package verification on macOS and Windows.

## Release status

Windows packaging and release verification are still pending. See the [desktop implementation plan](DESKTOP_IMPLEMENTATION_PLAN.md) for current progress and remaining work.
