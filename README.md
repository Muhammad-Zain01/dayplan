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

The app provides a native macOS shell, local SQLite setup, Keychain credential storage, and a Todoist task module. Its local MCP stdio endpoint supports task/project/label reads and task create, update, complete, reopen, and delete. Every write opens a native approval dialog; deletion explains that subtasks will also be deleted. MCP uses the same task service and Keychain service as the UI. This is a local MCP server, not an AI model connection or a remote ChatGPT connector.

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

## Connect a local MCP client

Build the app bundle, then add the following server entry to a compatible local MCP client's configuration. Replace the executable path with the path where you installed `DayPlan.app`:

```json
{
  "mcpServers": {
    "dayplan": {
      "command": "/Applications/DayPlan.app/Contents/Helpers/dayplan-mcp"
    }
  }
}
```

The server uses newline-delimited JSON-RPC over stdin/stdout and supports MCP `2026-07-28` stateless requests plus older initialize-based revisions. Keep stdout reserved for MCP messages. In Settings, **Copy Claude Desktop configuration** copies a configuration fragment using the current app executable path; paste it into the host yourself. The server reads the `com.dayplan.app` credential from macOS Keychain. It does not need API keys in arguments or environment variables. DayPlan asks for confirmation separately for every write.

Use `swift run DayPlanMCPServer` in a source checkout, or the bundled `Contents/Helpers/dayplan-mcp` executable for a stable installed path. Discovery and tool listing have been smoke-tested. Host-specific setup and live Todoist calls still need manual verification.

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
