---
name: dayplan-mcp-tools
description: Add, change, review, or document DayPlan AI/MCP tools and module capabilities. Keep tool schemas, descriptions, approval rules, tests, and this catalog in sync.
---

# DayPlan AI and MCP Tool Authoring

Read `AGENTS.md`, `ARCHITECTURE.md`, and `MCP_IMPLEMENTATION_PLAN.md` before changing tool behavior. The Electron main process owns credentials, networking, approvals, MCP stdio, and the shared application services. React must call narrow preload APIs and never implement Todoist or MCP policy itself.

## Current implementation

The local MCP helper is started with `DayPlan --mcp` and communicates over stdio using the official TypeScript MCP SDK. It composes the same `TaskApplicationService`, `TodoistApiClient`, encrypted SQLite-backed credential repository, and approval service used by the desktop UI. Tool output and errors must never contain the Todoist token or local credential data. The helper must not write logs or banners to stdout.

Task writes require an explicit native DayPlan approval dialog. Denial returns an MCP error and does not invoke the task use case. Delete confirmation states that Todoist also deletes subtasks. MCP annotations describe tool behavior but are not authorization; the approval service is the enforcement boundary.

## Tool catalog

| Tool | Description and inputs | Access |
| --- | --- | --- |
| `todoist_list_tasks` | List up to 100 active tasks; optional `limit` (1–100, default 100) and exact `project_id`. | Read-only. |
| `todoist_get_task` | Get an active task using its exact opaque `task_id`; discover IDs with `todoist_list_tasks`. | Read-only. |
| `todoist_list_projects` | List projects, including Inbox, so the caller can resolve project names to IDs. | Read-only. |
| `todoist_list_labels` | List label names for exact-name selection. | Read-only. |
| `todoist_create_task` | Create one task with required `content`; optional `description`, `project_id`, `due_date` (`YYYY-MM-DD`), `priority` (Todoist 1–4), and existing label names. Omitted project means Inbox. | DayPlan approval required. |
| `todoist_update_task` | Patch one task by `task_id`; provide one or more of `content`, `description`, `due_date`, `priority`, or `labels`. Omitted fields remain unchanged; `due_date: null` clears the date. | DayPlan approval required. |
| `todoist_complete_task` | Complete one active task by exact `task_id`. | DayPlan approval required. |
| `todoist_reopen_task` | Reopen one completed task by exact `task_id`. | DayPlan approval required. |
| `todoist_delete_task` | Permanently delete one task by exact `task_id`; Todoist also deletes its subtasks. | Explicit DayPlan approval required. |

Todoist priority values map as follows: API `4` = P1 Urgent, `3` = P2 High, `2` = P3 Medium, `1` = P4 Normal. Do not invent IDs, project names, or labels; discover them first. These tools use the Todoist task due date and do not create deadlines or reminders.

## Required workflow for every tool or feature change

1. Add or change the typed use case in the owning module. Keep API and protocol details in their adapters.
2. Define a stable `module_action` name, bounded input schema, output schema, clear description, and accurate read/write/destructive annotations.
3. Reject unknown properties and malformed values at the MCP boundary, then validate business rules again in the application service.
4. Route every mutation through the DayPlan approval service before calling a use case. Fail closed if approval is denied, unavailable, or fails. For destructive changes, describe the specific consequence.
5. Register the tool in its module catalog and compose it through the central MCP server; do not duplicate use cases or Todoist HTTP logic.
6. Add tests for catalog registration, schema/validation behavior, use-case invocation, approval denial, approved mutation, and secret-free output.
7. Update this catalog, `MCP_IMPLEMENTATION_PLAN.md`, and architecture/setup documentation when behavior or status changes.
8. Test through the actual stdio transport before claiming host compatibility. Unit tests alone do not establish that a host can connect.

## Future module pattern

Each module should own its application services and provide a focused MCP tool catalog to the central server. Add the UI and app use cases first, define narrow module-prefixed tools, classify each operation's risk, and cover it with unit and transport tests. Keep settings limited to integrations that actually exist. Never expose general shell execution, unrestricted filesystem access, arbitrary network access, or secrets through MCP.

## Security and reliability

- Treat all model-provided arguments as untrusted; validate and bound them.
- Keep Todoist credentials encrypted in SQLite through Electron `safeStorage`; do not pass tokens through MCP inputs, environment variables, arguments, logs, or outputs.
- Keep approval in the DayPlan main process. Protocol annotations and host confirmation prompts do not replace DayPlan approval.
- Keep diagnostics on stderr and protocol frames on stdout only.
- Do not claim ChatGPT/Claude host integration until that host has successfully discovered and invoked the local helper.
- Preserve cancellation and return actionable errors that do not expose credentials, database paths, or internal stack traces.

## References

- Todoist REST API v1: <https://developer.todoist.com/api/v1/>
- Official TypeScript MCP SDK: <https://ts.sdk.modelcontextprotocol.io/v2/>
- MCP tools specification: <https://modelcontextprotocol.io/specification/2026-07-28/server/tools>
- Full DayPlan MCP roadmap: `MCP_IMPLEMENTATION_PLAN.md`
