# DayPlan

DayPlan is a native macOS productivity app, starting with a Todoist-backed task module. The app is designed for personal local use, with AI and MCP capabilities added through clear, modular boundaries.

## Project principles

- Build a native macOS interface with SwiftUI.
- Keep network and database work off the UI's critical path.
- Use Todoist as the source of truth for tasks.
- Keep app-owned data in SQLite under the user's Application Support directory.
- Store API credentials in macOS Keychain. Never put secrets in source, SQLite, logs, or `.env` files.
- Make application capabilities callable through a shared service layer so the UI, core code, and future MCP tools use the same behavior.

## Current status

This repository is the application foundation. The initial implementation provides the native app shell, local SQLite database setup, secure credential storage, and modular extension points. Todoist, AI-provider, and MCP integrations are documented by their actual implementation status in the source and architecture document.

## Build and run locally

Requirements: macOS and Xcode with the Swift command-line tools selected.

```sh
swift build
swift run DayPlan
```

Open `Package.swift` in Xcode to use its editor, previews where available, and debugger. Run the test suite with:

```sh
swift test
```

The app's local database is created at:

```text
~/Library/Application Support/DayPlan/dayplan.sqlite3
```

Credentials are stored in the macOS Keychain and are not stored in this database.

## Repository documents

- [Architecture](ARCHITECTURE.md)
- [Agent instructions](AGENTS.md)
