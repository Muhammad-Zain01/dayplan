# DayPlan Architecture

## Product goal

DayPlan is a native macOS productivity application for personal use. The first feature area is task planning backed by Todoist. Future features should be modular, AI-callable, and accessible through MCP without making the interface dependent on an AI provider.

## Runtime and stack

- macOS desktop application, implemented with SwiftUI.
- Swift 6 language mode and Swift Package Manager for the initial project scaffold.
- SQLite through the system SQLite library; no third-party database package.
- `URLSession` for Todoist and future provider networking.
- macOS Keychain for API credentials.
- A separate local MCP stdio helper is implemented in `Sources/DayPlanMCPServer/` and packaged at `Contents/Helpers/dayplan-mcp`; remote MCP and AI-provider connections are not implemented.

## Module boundaries

```text
SwiftUI Features
  ├── Tasks ──> Task use cases / tool-facing service
  │               ├── Todoist API adapter
  │               └── SQLite task cache
  └── Settings ──> Credential service ──> macOS Keychain

The MCP stdio helper and UI call the same task use cases. Future modules add tools to the application tool registry; they must not duplicate business rules or transport code.
```

### Application and presentation

`DayPlanApp` owns the application lifecycle and dependency composition. SwiftUI views are small value types, as required by the framework. State transitions and orchestration belong in reference-type view models/services, not in view bodies.

### Tasks and Todoist

Todoist is the source of truth for remote tasks. The integration owns HTTP request construction, authentication headers, response decoding, pagination, and Todoist-specific errors. Task use cases are the shared entry point for UI and future AI/MCP tools. Cached data is disposable and must be refreshable from Todoist.

The first API adapter targets Todoist REST API v1 at `https://api.todoist.com/api/v1`. It uses bearer-token authentication and must follow cursor pagination. Task creation supports title, description, project (Inbox by default), due date, and priority through a native task composer. See the [official Todoist API documentation](https://developer.todoist.com/api/v1/).

### Persistence

SQLite stores app-owned records, migrations, and any explicitly chosen Todoist cache. It does not become a competing source of truth for tasks. The database belongs under `~/Library/Application Support/DayPlan/`. The persistence module owns directory creation, connection lifecycle, migrations, and SQL access.

The initial migration creates an `app_preferences` table and a task-cache table. The current task screen fetches directly from Todoist; a repository that reads/writes the cache and provides offline fallback is not implemented yet.

### Secrets

Todoist, OpenAI, and Anthropic credentials belong in macOS Keychain. SQLite stores only non-secret app data. Credentials must never appear in logs, diagnostics, test fixtures, source control, command output, or `.env` files. The app should show only whether a credential is configured, not reveal a saved value.

### AI tools and MCP

AI providers are separate adapters behind provider-neutral interfaces. The app remains useful without an AI provider. The MCP task catalog exposes list tasks/projects/labels, get task, create, partial update, complete, reopen, and delete. List calls are bounded; task IDs are opaque. Create and update support due dates, priorities, and labels. Omitted update fields remain unchanged, and `due_date: null` clears a date. Todoist remains the source of truth.

The MCP server speaks newline-delimited JSON-RPC through `MCPStdioServer` and uses the shared `ApplicationToolRegistry` and `TodoistTaskService`. It supports MCP `2026-07-28` stateless requests and older initialize-based revisions over local stdio. Reads run immediately. Every mutation opens a native macOS confirmation dialog showing the tool arguments; deletion also explains that Todoist deletes all subtasks. Tool input is checked against declared schemas and typed decoders. Results include structured content and secret-free errors. Settings can copy a local MCP client configuration fragment without editing another app's files.

Initialization and tool discovery have been smoke-tested through the executable. This has not yet been verified inside supported third-party hosts, against live Todoist credentials, or with a full protocol conformance suite. The approval UI is currently a modal dialog, not an approval queue.

The repository-root [SKILL.md](SKILL.md) provides the required authoring workflow and current AI-tool catalog; update it whenever a feature becomes AI-callable or an existing tool changes.

Implementation status, release gaps, and the remote-access boundary are tracked in [MCP_IMPLEMENTATION_PLAN.md](MCP_IMPLEMENTATION_PLAN.md).

## Performance and reliability

- No network request or SQLite query runs synchronously from a SwiftUI view body.
- Use structured concurrency, cancellation, and explicit loading/error/empty states.
- Keep list updates incremental and avoid broad observable state invalidation.
- Bound request timeouts and surface actionable errors without exposing secrets.
- Persist schema changes through ordered, repeatable migrations.

## Initial implementation scope

1. Native application shell and navigation.
2. Settings with Keychain-backed Todoist, OpenAI, and Anthropic credential slots.
3. SQLite connection, schema versioning, and local app-data location.
4. Todoist task listing, creation, partial updates, completion, reopening, and deletion through REST API v1.
5. Local MCP stdio server and task tool catalog over the shared task service.
6. Build and test instructions for local macOS development.
