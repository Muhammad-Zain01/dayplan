# Dayplan Code Standards

These rules apply to the Electron application, shared services, MCP server, tests, and automation.

## Architecture

- Use TypeScript with strict compiler settings. Keep Electron main, preload, renderer, and shared application code in separate modules.
- Keep React components focused on rendering and interaction. Put business logic in small classes: use cases, services, repositories, API clients, validators, and MCP tool handlers.
- Give every class one clear responsibility. Do not create a God class, global service locator, or module that mixes UI, persistence, networking, and policy.
- Depend on interfaces at external boundaries and inject concrete implementations during startup composition.
- Share application use cases between the UI and MCP tools; do not duplicate rules in a tool adapter or component.
- Keep modules cohesive, dependencies directed inward, and imports explicit. Avoid circular dependencies.
- Keep Electron privileged APIs in the main process or narrowly scoped preload bridge. The renderer must not access Node.js, SQLite, credentials, or arbitrary IPC channels directly.

## TypeScript and React

- Enable `strict`, `noUncheckedIndexedAccess`, and `exactOptionalPropertyTypes` where compatible; model nullable and optional values deliberately.
- Use descriptive domain names and explicit result/error types. Avoid `any`, unsafe casts, non-null assertions, and silent catch blocks.
- Validate all external inputs at runtime, including IPC messages, Todoist responses, persisted JSON, and MCP arguments.
- Use function components and hooks for React presentation. Keep React state local to presentation; move shared workflows and domain state into services or focused view models where needed.
- Keep components small. Extract repeated UI patterns into accessible components instead of passing large, unstructured prop objects.
- Use shadcn/ui components and Radix accessibility primitives consistently. Do not add a second component system for the same interaction.
- Do not add comments that restate the code. Write comments only to explain non-obvious constraints, security decisions, or compatibility work.

## Electron security and responsiveness

- Keep `contextIsolation`, renderer sandboxing, and restrictive Content Security Policy enabled; keep `nodeIntegration` disabled.
- Expose a small, typed API from preload. Validate the sender and payload for every IPC operation; never expose generic `send`, `invoke`, filesystem, shell, or database access.
- Keep network, database, filesystem, and credential operations out of React render paths. Run asynchronous work off the renderer's critical path and support cancellation when practical.
- Load only packaged local UI code. Deny unexpected navigation and new-window requests.
- Do not log task content, credentials, authorization headers, database values, or raw MCP arguments that may contain private data.

## Data, secrets, and Todoist

- Store app settings and local app-owned data in SQLite under the operating system's per-user application-data directory. Use parameterized SQL and ordered migrations.
- Store the Todoist token directly in the SQLite `settings` table as UTF-8 bytes and leave it plain text at rest. Do not add a second credential store or encryption layer.
- Keep the token inside the main-process credential service after saving. Do not log it, return the saved value to the renderer, or include it in MCP arguments, environment variables, or source control.
- Settings provides Todoist token management and a locally persisted System/Light/Dark appearance choice. Module-specific preferences, such as focus and break durations, are stored with app settings and edited in their owning module.
- Treat Todoist as the source of truth for tasks. Local task data, if cached, must be refreshable and must not imply an offline write succeeded remotely.
- Persist focus sessions and their active intervals in SQLite. Use timestamp-derived elapsed time, exclude pauses and breaks from focus totals, and split interval totals across local calendar-day boundaries.
- Keep desktop timer authority in the main process. Do not tie timer lifetime to a React component or visible window; handle window hiding, app quit, startup recovery, and system suspend explicitly.
- Keep HTTP construction, pagination, authentication, response parsing, and Todoist errors inside the Todoist integration module.
- Redact credentials and sensitive request details from all errors and diagnostics.

## MCP and AI-callable tools

- Implement MCP transport separately from module tools and shared application services.
- Give every tool a stable name, concise description, typed input/output schema, runtime validation, bounded behavior, and explicit risk classification.
- Use the same task use cases as the UI. Keep protocol metadata separate from business rules.
- Require Dayplan-owned approval for every mutation. Fail closed if approval cannot be displayed or received; a host's approval hints do not grant authorization.
- Keep MCP stdout limited to protocol output; send safe diagnostics to stderr.
- Keep HTTP MCP opt-in, loopback-only, and protected by Host and Origin validation. Do not add general-purpose renderer networking or IPC to control it. Document clearly that this endpoint has no authentication and that local processes can read task data; Dayplan approval remains required for writes.
- Never expose credentials, unrestricted shell, arbitrary filesystem access, SQL execution, or unrestricted network requests as tools.
- Update `SKILL.md`, MCP documentation, and the tool catalog whenever an AI-callable feature changes.

## UI and performance

- Prefer clear hierarchy, restrained styling, consistent spacing, and useful empty, loading, offline, and error states.
- Keep the app responsive at compact and expanded desktop window sizes. Avoid gratuitous animation and large charting dependencies where simple summaries are clearer.
- Make interactive controls keyboard accessible and label them for assistive technology.
- Keep charts truthful: every metric needs a defined source and refresh time; do not invent historical data from a current snapshot.
- Keep focus statistics derived from persisted intervals, including zero-value days; do not infer history from the current timer state.

## Tests and verification

- Add focused tests for business behavior, validation, database migrations, Todoist requests, MCP schemas/authorization, and error paths.
- Use fake Todoist transports and temporary SQLite databases. Never use production credentials in tests.
- Run formatting, lint, type checking, and tests after relevant changes. Verify packaged Electron behavior on macOS and Windows in CI.
- Do not claim a capability works until its implementation and relevant verification pass.
- Update `README.md`, `ARCHITECTURE.md`, and `AGENTS.md` when setup, platform support, data storage, security, or module boundaries change.
