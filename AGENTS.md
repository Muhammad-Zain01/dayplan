# Dayplan Agent Instructions

Read [CODE_STANDARDS.md](CODE_STANDARDS.md) before changing application code. These repository-level requirements apply to all contributors.

## Product and platform

- Dayplan is an Electron desktop productivity app targeting macOS and Windows.
- Build the renderer with React, TypeScript, Vite, and the shadcn/ui component approach.
- Settings supports the Todoist API token and a persisted System/Light/Dark appearance choice. Do not add controls for future or unimplemented integrations.
- Todoist remains the source of truth for remote tasks. SQLite holds local settings and app-owned data; any task cache must remain refreshable.
- Verify Windows packaging before declaring the app ready for cross-platform release.

## Architecture

- Keep main process, preload bridge, renderer, shared domain, integrations, persistence, and MCP transport in separate modules.
- Use small classes for core services, repositories, use cases, APIs, coordinators, and MCP registries. Avoid God classes and duplicated rules.
- React function components are for presentation. They call narrow typed preload methods; they do not contain application business rules.
- UI IPC and MCP tools must call the same application service methods.
- Validate all external input at runtime, including IPC payloads, API responses, and MCP tool arguments.
- Keep main-process authority narrow and validate each IPC sender. Never expose a generic IPC, filesystem, shell, database, or arbitrary network API to the renderer.

## Storage and credentials

- Keep the SQLite file under Electron's per-user `app.getPath('userData')` directory. Create ordered, repeatable migrations and parameterized queries.
- Store the Todoist token directly in the SQLite `settings` table as plain text at rest. Do not add a second credential store or encryption layer.
- Do not store a raw environment-variable dump or introduce `.env` files for runtime credentials. The initial user-entered secret is the Todoist token in Settings.
- Do not return a saved token to the renderer or put credentials in MCP arguments, environment variables, logs, errors, or source control.

## MCP

- Use the official TypeScript MCP SDK and keep stdio output protocol-only.
- Reuse task application services from the UI. Writes require explicit Dayplan approval and must fail closed if approval is denied or unavailable.
- Deletion must explain that Todoist also deletes subtasks. MCP annotations never substitute for application-controlled approval.
- Update `SKILL.md`, MCP documentation, and architecture/tool inventory whenever a callable feature or tool changes.

## Verification and documentation

- Run `npm run typecheck`, `npm test`, and `npm run build` after meaningful changes.
- Test persistence with temporary databases, integration clients with fake fetch responses, and MCP tools without production credentials.
- Rebuild native dependencies for Electron and verify packaged builds on both macOS and Windows using CI.
- Keep source formatted and dead code removed. Avoid comments that merely repeat the code.
- Update `README.md`, `ARCHITECTURE.md`, `CODE_STANDARDS.md`, and `DESKTOP_IMPLEMENTATION_PLAN.md` when platform setup, boundaries, security, or storage behavior changes.
- Never commit or push unless the user asks.
