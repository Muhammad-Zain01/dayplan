# DayPlan Agent Instructions

Read [CODE_STANDARDS.md](CODE_STANDARDS.md) before changing application code. These repository-level requirements apply to all contributors.

## Product and platform

- DayPlan is an Electron desktop productivity app targeting macOS and Windows.
- Build the renderer with React, TypeScript, Vite, and the shadcn/ui component approach.
- Settings currently supports only the Todoist API token. Do not add controls for future or unimplemented integrations.
- Todoist remains the source of truth for remote tasks. SQLite holds local settings and app-owned data; any task cache must remain refreshable.
- The Swift app, SwiftPM manifest, and Swift-only packaging scripts are retired from the working tree. The baseline commit `11d3ddd82ea175040c16aa8c6e99d8b364092628` preserves the historical implementation. Do not add Swift app code back; verify Windows packaging before declaring the Electron migration release-ready.

## Architecture

- Keep main process, preload bridge, renderer, shared domain, integrations, persistence, and MCP transport in separate modules.
- Use small classes for core services, repositories, use cases, APIs, coordinators, and MCP registries. Avoid God classes and duplicated rules.
- React function components are for presentation. They call narrow typed preload methods; they do not contain application business rules.
- UI IPC and MCP tools must call the same application service methods.
- Validate all external input at runtime, including IPC payloads, API responses, and MCP tool arguments.
- Keep main-process authority narrow and validate each IPC sender. Never expose a generic IPC, filesystem, shell, database, or arbitrary network API to the renderer.

## Storage and credentials

- Keep the SQLite file under Electron's per-user `app.getPath('userData')` directory. Create ordered, repeatable migrations and parameterized queries.
- Store the Todoist token only as encrypted ciphertext in SQLite. Use asynchronous Electron `safeStorage` in the main process, backed by macOS Keychain or Windows DPAPI. Refuse to save if secure encryption is unavailable; never fall back to plaintext.
- Do not store a raw environment-variable dump or introduce `.env` files for runtime credentials. The initial user-entered secret is the Todoist token in Settings.
- Never return a saved token to the renderer or put credentials in MCP arguments, environment variables, logs, errors, or source control.

## MCP

- Use the official TypeScript MCP SDK and keep stdio output protocol-only.
- Reuse task application services from the UI. Writes require explicit DayPlan approval and must fail closed if approval is denied or unavailable.
- Deletion must explain that Todoist also deletes subtasks. MCP annotations never substitute for application-controlled approval.
- Update `SKILL.md`, MCP documentation, and architecture/tool inventory whenever a callable feature or tool changes.

## Verification and documentation

- Run `npm run typecheck`, `npm test`, and `npm run build` after meaningful changes.
- Test persistence with temporary databases, integration clients with fake fetch responses, and MCP tools without production credentials.
- Rebuild native dependencies for Electron and verify packaged builds on both macOS and Windows using CI.
- Keep source formatted and dead code removed. Avoid comments that merely repeat the code.
- Update `README.md`, `ARCHITECTURE.md`, `CODE_STANDARDS.md`, and `ELECTRON_MIGRATION_PLAN.md` when platform setup, boundaries, security, or storage behavior changes.
- Never commit or push unless the user asks.
