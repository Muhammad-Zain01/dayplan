import { McpServer } from '@modelcontextprotocol/server'
import * as z from 'zod/v4'
import type { TaskApplicationService } from '../tasks/TaskApplicationService'
import type { TodoistDeleteApprovalService } from './TodoistDeleteApprovalService'
import type { TaskDraft, TaskPatch } from '../../shared/domain'

const TaskSchema = z.object({
  id: z.string(),
  content: z.string(),
  description: z.string(),
  project_id: z.string().nullable(),
  labels: z.array(z.string()),
  priority: z.number().int(),
  due: z.object({ date: z.string() }).nullable(),
}).passthrough()

const TaskListSchema = z.array(TaskSchema)
const CompletedTaskRangeSchema = z.object({
  since: z.iso.datetime(),
  until: z.iso.datetime(),
}).strict().refine(({ since, until }) => {
  const start = new Date(since)
  const end = new Date(until)
  if (end <= start) return false

  const year = start.getUTCFullYear()
  const month = start.getUTCMonth() + 3
  const day = start.getUTCDate()
  const targetMonthStart = new Date(Date.UTC(year, month, 1))
  const lastDay = new Date(Date.UTC(targetMonthStart.getUTCFullYear(), targetMonthStart.getUTCMonth() + 1, 0)).getUTCDate()
  const maxUntil = new Date(Date.UTC(
    targetMonthStart.getUTCFullYear(),
    targetMonthStart.getUTCMonth(),
    Math.min(day, lastDay),
    start.getUTCHours(),
    start.getUTCMinutes(),
    start.getUTCSeconds(),
    start.getUTCMilliseconds(),
  ))
  return end <= maxUntil
}, 'The completion date range must be positive and no longer than three calendar months.')
const ProjectSchema = z.object({ id: z.string(), name: z.string(), is_inbox_project: z.boolean() }).passthrough()
const LabelSchema = z.object({ name: z.string() }).passthrough()
const TaskIdSchema = z.object({ task_id: z.string().min(1).max(128) }).strict()

export class TodoistTaskMcpTools {
  constructor(
    private readonly taskService: TaskApplicationService,
    private readonly deleteApprovalService: TodoistDeleteApprovalService,
  ) {}

  register(server: McpServer): void {
    server.registerTool('todoist_list_tasks', {
      description: 'List up to 100 active Todoist tasks. Optionally filter by a Todoist project ID.',
      inputSchema: z.object({
        limit: z.number().int().min(1).max(100).optional(),
        project_id: z.string().min(1).max(128).optional(),
      }).strict(),
      outputSchema: z.object({ tasks: TaskListSchema }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    }, async ({ limit, project_id }) => this.result({ tasks: await this.taskService.listTasks({ limit: limit ?? 100, ...(project_id ? { project_id } : {}) }) }))

    server.registerTool('todoist_list_completed_tasks', {
      description: 'List completed Todoist tasks by completion time for a requested date-time range. since is inclusive and until is exclusive; ranges may be up to three calendar months. Use UTC ISO-8601 timestamps such as 2026-09-14T00:00:00Z for a day. Results are paginated fully by Todoist.',
      inputSchema: CompletedTaskRangeSchema,
      outputSchema: z.object({ tasks: TaskListSchema }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    }, async ({ since, until }) => this.result({ tasks: await this.taskService.listCompletedTasks(since, until) }))

    server.registerTool('todoist_get_task', {
      description: 'Get an active task by its exact task_id. IDs are opaque; discover them with todoist_list_tasks.',
      inputSchema: TaskIdSchema,
      outputSchema: TaskSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    }, async ({ task_id }) => this.result(await this.taskService.getTask(task_id)))

    server.registerTool('todoist_list_projects', {
      description: 'List Todoist projects, including Inbox, to resolve project names to IDs.',
      inputSchema: z.object({}).strict(),
      outputSchema: z.object({ projects: z.array(ProjectSchema) }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    }, async () => this.result({ projects: await this.taskService.listProjects() }))

    server.registerTool('todoist_list_labels', {
      description: 'List Todoist labels so requested labels can be resolved by exact name.',
      inputSchema: z.object({}).strict(),
      outputSchema: z.object({ labels: z.array(LabelSchema) }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    }, async () => this.result({ labels: await this.taskService.listLabels() }))

    server.registerTool('todoist_create_task', {
      description: 'Create one task in Todoist immediately. If project_id is omitted, Todoist places it in Inbox.',
      inputSchema: z.object({
        content: z.string().trim().min(1).max(500),
        description: z.string().max(5000).optional(),
        project_id: z.string().min(1).max(128).optional(),
        due_date: z.iso.date().optional(),
        priority: z.number().int().min(1).max(4).optional(),
        labels: z.array(z.string().trim().min(1).max(100)).max(50).optional(),
      }).strict(),
      outputSchema: TaskSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    }, async (input) => this.result(await this.taskService.createTask(input as TaskDraft)))

    server.registerTool('todoist_update_task', {
      description: 'Update only supplied fields on one active Todoist task immediately. Set due_date to null to clear its due date.',
      inputSchema: z.object({
        task_id: z.string().min(1).max(128),
        content: z.string().trim().min(1).max(500).optional(),
        description: z.string().max(5000).optional(),
        due_date: z.union([z.iso.date(), z.null()]).optional(),
        priority: z.number().int().min(1).max(4).optional(),
        labels: z.array(z.string().trim().min(1).max(100)).max(50).optional(),
      }).strict().refine(({ task_id: _taskId, ...patch }) => Object.keys(patch).length > 0, 'At least one field is required.'),
      outputSchema: TaskSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    }, async ({ task_id, ...patch }) => this.result(await this.taskService.updateTask(task_id, patch as TaskPatch)))

    server.registerTool('todoist_complete_task', {
      description: 'Complete one active Todoist task immediately.',
      inputSchema: TaskIdSchema,
      outputSchema: z.object({ completed: z.literal(true) }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    }, async ({ task_id }) => this.result(await this.taskService.completeTask(task_id)))

    server.registerTool('todoist_reopen_task', {
      description: 'Reopen one completed Todoist task by ID immediately.',
      inputSchema: TaskIdSchema,
      outputSchema: z.object({ reopened: z.literal(true) }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    }, async ({ task_id }) => this.result(await this.taskService.reopenTask(task_id)))

    server.registerTool('todoist_delete_task', {
      description: 'Permanently delete one task and all of its subtasks. Requires Dayplan confirmation.',
      inputSchema: TaskIdSchema,
      outputSchema: z.object({ deleted: z.literal(true), subtasks_also_deleted: z.literal(true) }),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
    }, async ({ task_id }) => {
      const approved = await this.deleteApprovalService.confirmTaskDeletion(task_id)
      if (!approved) return { content: [{ type: 'text' as const, text: 'The user cancelled task deletion.' }], isError: true }
      return this.result(await this.taskService.deleteTask(task_id))
    })
  }

  private result<T>(value: T) {
    return {
      content: [{ type: 'text' as const, text: JSON.stringify(value) }],
      structuredContent: value as Record<string, unknown>,
    }
  }
}
