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

The initial implementation provides the native app shell, local SQLite database setup, secure credential storage, and a Todoist task module for listing, creating, and completing tasks. The task composer supports descriptions, project selection (Inbox by default), due dates, priorities, and existing labels. OpenAI and Anthropic credentials can be stored securely for later provider modules. Task actions are registered as in-process AI tools; an AI model connection and MCP transport are not implemented yet.

## Build and run locally

Requirements: macOS and Xcode with the Swift command-line tools selected.

```sh
swift build
./Scripts/package-app.sh
open .build/DayPlan.app
```

The packaging script builds a local `.app` bundle with a DayPlan icon so macOS shows it in the Dock and app switcher. Re-run the script after code changes, then open the refreshed bundle. Open `Package.swift` in Xcode to use its editor, previews where available, and debugger. Run the test suite with:

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
- [MCP implementation plan](MCP_IMPLEMENTATION_PLAN.md)
- [AI/MCP tool authoring skill](SKILL.md)
- [Agent instructions](AGENTS.md)
