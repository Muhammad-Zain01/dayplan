---
name: dayplan-mcp-tools
description: Add, change, review, or document DayPlan AI/MCP tools and module capabilities. Keep tool schemas, descriptions, approval rules, tests, and this catalog in sync.
---

# DayPlan AI and MCP Tool Authoring

Use this repository skill whenever a DayPlan feature is made callable by an AI model, a tool is added or changed, or an agent updates the MCP plan/catalog. Read `AGENTS.md`, `ARCHITECTURE.md`, and `MCP_IMPLEMENTATION_PLAN.md` first.

## Current implementation status

DayPlan has an application tool registry in `Sources/DayPlan/AI/Tools/` and a separate stdio MCP command target in `Sources/DayPlanMCPServer/`. Its transport implementation is shared from `Sources/DayPlan/AI/MCP/`. It supports `2026-07-28` stateless `server/discover` and per-request metadata, as well as older initialize-based JSON-RPC revisions. The packaged helper is `Contents/Helpers/dayplan-mcp`; source checkouts can use `swift run DayPlanMCPServer`. Discovery and tool listing have been smoke-tested; no third-party host has been verified. Do not describe it as a remote ChatGPT connector or an AI model connection.

The task feature uses `TaskOperating` as the shared use-case boundary. The UI and tools must call those same use cases; do not duplicate Todoist networking or business rules inside a tool.

## Current application tools

| Name | Description for an AI caller | Input | Access |
| --- | --- | --- | --- |
| `todoist_list_tasks` | List up to 100 active tasks; optionally filter by project ID. | Optional `limit` (1–100, default 100) and `project_id`. | Read-only. |
| `todoist_list_projects` | List active Todoist projects, including Inbox, so a project can be selected by ID. | No arguments. | Read-only. |
| `todoist_list_labels` | List existing Todoist labels so requested labels can be resolved by name. | No arguments. | Read-only. |
| `todoist_get_task` | Get one active task using its exact opaque ID. | Required `task_id`. | Read-only. |
| `todoist_create_task` | Create one task. Without `project_id`, it goes to Inbox. `due_date` is `YYYY-MM-DD`. API priority is `1` for P4/normal through `4` for P1/urgent. | Required `content`; optional `description`, `project_id`, `due_date`, `priority` (`1...4`), and existing label names. | Native DayPlan confirmation required. |
| `todoist_update_task` | Update supplied fields; omitted fields remain unchanged. Pass `due_date: null` to clear the date. | Required `task_id`, plus at least one of `content`, `description`, `due_date`, `priority`, or `labels`. | Native DayPlan confirmation required. |
| `todoist_complete_task` | Mark one active task complete. | Required `task_id`. | Native DayPlan confirmation required. |
| `todoist_reopen_task` | Reopen one completed task. | Required `task_id`. | Native DayPlan confirmation required. |
| `todoist_delete_task` | Permanently delete one task and all its subtasks. | Required `task_id`. | Separate native confirmation that states the subtask consequence. |

Create and update inputs use the Todoist REST API v1 model. In the UI, display priorities as P1 Urgent, P2 High, P3 Medium, and P4 Normal; map them to the API values in the table above. Omitting `project_id` means Inbox. These tools use Todoist due dates, not the separate deadline or reminder APIs. The stdio process reads the app's Keychain entry and never accepts credentials through MCP arguments or environment variables.

## Required workflow for every tool or feature change

1. Define or update a typed use case in the owning module. Keep API-specific details in that integration adapter.
2. Define a narrow, stable tool name and a plain-language description that tells the model what it does, when to use it, required IDs/inputs, defaults, and side effects. Do not rely on the name alone.
3. Keep the input schema, typed decoder, validation, and output structure aligned. Reject invalid values and unknown properties at the protocol boundary; validate again in the application service.
4. Assign a risk class. Reads must not mutate data. Writes must follow the explicit approval policy in `AGENTS.md` and `MCP_IMPLEMENTATION_PLAN.md`. Destructive and bulk operations require explicit, consequence-specific confirmation.
5. Register the tool through `ApplicationToolRegistry` and expose that same specification and use case through `MCPStdioServer`; never create a parallel implementation.
6. Add/update focused tests for schema validity, tool descriptions, input validation, use-case invocation, approval enforcement, and secret-free results/errors.
7. Update this `SKILL.md` tool catalog with the exact new or changed name, description, inputs/defaults, and access policy. Update the MCP implementation plan and architecture/README if the capability status or setup instructions change.
8. Verify the tool through its actual transport. Do not claim third-party host compatibility until a host successfully discovers and calls it.

## Description-writing rules

- Use direct language and one behavior per tool.
- State when the model should use the tool and what identifier it needs; instruct it to discover opaque IDs instead of guessing them.
- State meaningful defaults, units, accepted value ranges, date formats, and Todoist-specific priority mapping.
- State side effects clearly. A delete description must say whether related tasks are also deleted.
- Never claim unsupported fields, remote behavior, or MCP connectivity.
- Keep read tools read-only and minimize returned task data.

## Security and reliability

- Treat model-produced arguments as untrusted. Decode into typed inputs and validate before invoking the use case.
- Never expose tokens, Keychain contents, local file paths, unrestricted shell/filesystem access, or arbitrary network access as tools.
- Do not place credentials in tool arguments, schemas, output, logs, or test fixtures.
- Keep non-protocol diagnostics off stdout from the stdio MCP server; use stderr.
- Preserve cancellation and surface actionable, secret-free errors.
- Keep Todoist as the source of truth. SQLite task records are only a cache.

## References

- Todoist REST API v1: <https://developer.todoist.com/api/v1/>
- MCP tool specification: <https://modelcontextprotocol.io/specification/2026-07-28/server/tools>
- Full DayPlan MCP roadmap: `MCP_IMPLEMENTATION_PLAN.md`
