# Agent Instructions

These rules apply to every automated or human contributor working in this repository.

## Product constraints

- DayPlan is a native macOS application. Use SwiftUI and Apple platform frameworks for the desktop UI; do not replace it with a web wrapper.
- Keep the architecture modular. Add new work inside a feature or infrastructure module with one clear responsibility.
- Treat Todoist as the source of truth for tasks. Local SQLite task data is a cache unless a future product decision explicitly says otherwise.
- Make application use cases reusable from the UI, core code, and future MCP tools. MCP adapters must call the same use cases rather than reimplementing business rules.
- Do not claim an AI provider, Todoist integration, or MCP capability works until it is actually implemented and verified.

## Code quality

- Prefer small, cohesive reference types for services, repositories, coordinators, and view models. SwiftUI `View` declarations remain structs because that is the framework's intended model.
- Follow single-responsibility and dependency-inversion principles. Depend on protocols at integration boundaries and inject implementations.
- Avoid duplicated policy, networking, persistence, and credential logic. Put each in its owning service.
- Use descriptive names, narrow access control, explicit error types, and structured concurrency.
- Do not use force unwraps, `try!`, silent `catch` blocks, or broad `Any`-based APIs in production code.
- Keep UI rendering fast. Never block the main actor with network or database work.

## Data and secrets

- Store application-owned persistent data in SQLite under the user's Application Support directory.
- Store API tokens and keys in macOS Keychain only. Never use `.env` files or put secrets in SQLite, source files, fixtures, logs, screenshots, or Git history.
- Never print, return, or display a saved credential. Display configured/not-configured status instead.
- Use parameterized SQL statements. Add schema changes as ordered migrations.
- Redact authorization headers and credential-bearing request details from errors and diagnostics.

## AI and MCP

- Treat model output as untrusted input. Validate it against typed input models before executing a use case.
- Expose narrow tools with clear descriptions and input schemas. Do not give a model unrestricted database, shell, or filesystem access.
- Require user approval before destructive task operations or bulk changes.
- Keep AI-provider implementations replaceable; avoid tying task-domain logic to one vendor.
- Keep MCP transport and tool registration separate from the task application services.

## Verification workflow

- Run `swift build` after code changes and `swift test` when tests exist or behavior changes warrant them.
- Run the app with `swift run DayPlan` for local UI verification.
- Add focused tests for persistence migrations, API decoding, credential status, and use-case behavior. Never use real credentials in tests.
- Update `README.md` and `ARCHITECTURE.md` when setup commands, module responsibilities, storage policy, or integration status changes.
- Before committing, inspect `git diff` and `git status`; do not commit or push unless requested.
