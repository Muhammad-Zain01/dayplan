---
name: dayplan-mcp-tools
description: Add, change, review, or document DayPlan AI/MCP tools and module capabilities. Keep tool schemas, descriptions, approval rules, tests, and this catalog in sync.
---

# DayPlan AI and MCP Tool Authoring

Use this repository skill whenever a DayPlan feature is made callable by an AI model, a tool is added or changed, or an agent updates the MCP plan/catalog. Read `AGENTS.md`, `ARCHITECTURE.md`, and `MCP_IMPLEMENTATION_PLAN.md` first.

## Current implementation status

DayPlan currently has an **in-process application tool registry** in `Sources/DayPlan/AI/Tools/`. It is not yet an MCP server: no MCP protocol transport or AI-host connection has been implemented. Do not describe these tools as connected to Claude, ChatGPT, or another host.

The task feature uses `TaskOperating` as the shared use-case boundary. The UI and tools must call those same use cases; do not duplicate Todoist networking or business rules inside a tool.

## Current application tools

| Name | Description for an AI caller | Input | Access |
| --- | --- | --- | --- |
| `todoist_list_tasks` | List active tasks from the connected Todoist account. | No arguments. | Read-only. |
| `todoist_list_projects` | List active Todoist projects, including Inbox, so a project can be selected by ID. | No arguments. | Read-only. |
| `todoist_list_labels` | List existing Todoist labels so requested labels can be resolved by name. | No arguments. | Read-only. |
| `todoist_create_task` | Create one Todoist task. Use a project ID from `todoist_list_projects` when the user names a project, and label names from `todoist_list_labels` when labels are requested. Without a project, the task goes to Inbox. `due_date` is `YYYY-MM-DD`. Todoist API priority is `1` for P4/normal through `4` for P1/urgent. | Required `content`; optional `description`, `project_id`, `due_date`, `priority` (`1...4`), and `labels` (array of existing label names). | Requires explicit user approval in the application tool registry. |
| `todoist_complete_task` | Mark one active Todoist task complete. | Required `task_id`. | Requires explicit user approval in the application tool registry. |

The create-task input and UI use the Todoist REST API v1 model. In the UI, display priorities as P1 Urgent, P2 High, P3 Medium, and P4 Normal; convert to the API values in the mapping above. Omitting `project_id` means Inbox. The task composer uses a Todoist due date, not the separate deadline or reminder APIs.

## Required workflow for every tool or feature change

1. Define or update a typed use case in the owning module. Keep API-specific details in that integration adapter.
2. Define a narrow, stable tool name and a plain-language description that tells the model what it does, when to use it, required IDs/inputs, defaults, and side effects. Do not rely on the name alone.
3. Keep the input schema, typed decoder, validation, and output structure aligned. Reject invalid values and unknown properties at the protocol boundary; validate again in the application service.
4. Assign a risk class. Reads must not mutate data. Writes must follow the explicit approval policy in `AGENTS.md` and `MCP_IMPLEMENTATION_PLAN.md`. Destructive and bulk operations require explicit, consequence-specific confirmation.
5. Register the tool through `ApplicationToolRegistry` while it is the current adapter. When an MCP transport is added, expose the same tool definition and use case through MCP; never create a parallel implementation.
6. Add/update focused tests for schema validity, tool descriptions, input validation, use-case invocation, approval enforcement, and secret-free results/errors.
7. Update this `SKILL.md` tool catalog with the exact new or changed name, description, inputs/defaults, and access policy. Update the MCP implementation plan and architecture/README if the capability status or setup instructions change.
8. Verify the tool works through the layer actually implemented. Do not claim an MCP connection works until an MCP host successfully discovers and calls it over a verified transport.

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
- Do not write non-protocol diagnostics to stdout from a future stdio MCP server; use stderr.
- Preserve cancellation and surface actionable, secret-free errors.
- Keep Todoist as the source of truth. SQLite task records are only a cache.

## References

- Todoist REST API v1: <https://developer.todoist.com/api/v1/>
- MCP tool specification: <https://modelcontextprotocol.io/specification/2025-11-25/server/tools>
- Full DayPlan MCP roadmap: `MCP_IMPLEMENTATION_PLAN.md`
