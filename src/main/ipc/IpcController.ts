import { ipcMain, type BrowserWindow, type IpcMainInvokeEvent } from 'electron'
import * as z from 'zod/v4'
import type { DashboardService } from '../dashboard/DashboardService'
import type { SettingsApplicationService } from '../settings/SettingsApplicationService'
import type { TaskApplicationService } from '../tasks/TaskApplicationService'
import type { TaskDraft, TaskPatch } from '../../shared/domain'

const TaskIdSchema = z.string().trim().min(1).max(128)
const TaskDraftSchema = z.object({
  content: z.string().trim().min(1).max(500),
  description: z.string().max(5000).optional(),
  project_id: z.string().min(1).max(128).nullable().optional(),
  due_date: z.iso.date().nullable().optional(),
  priority: z.number().int().min(1).max(4).optional(),
  labels: z.array(z.string().trim().min(1).max(100)).max(50).optional(),
}).strict()
const TaskPatchSchema = TaskDraftSchema.partial().omit({ project_id: true }).extend({
  due_date: z.union([z.iso.date(), z.null()]).optional(),
}).strict().refine((input) => Object.keys(input).length > 0)

export class IpcController {
  constructor(
    private readonly taskService: TaskApplicationService,
    private readonly dashboardService: DashboardService,
    private readonly settingsService: SettingsApplicationService,
  ) {}

  register(window: BrowserWindow): void {
    this.handle(window, 'tasks:list', (_event, input) => {
      const parsed = z.object({ project_id: z.string().min(1).optional() }).strict().parse(input ?? {})
      return this.taskService.listTasks({ limit: 200, ...(parsed.project_id ? { project_id: parsed.project_id } : {}) })
    })
    this.handle(window, 'tasks:get', (_event, taskId) => this.taskService.getTask(TaskIdSchema.parse(taskId)))
    this.handle(window, 'tasks:projects', () => this.taskService.listProjects())
    this.handle(window, 'tasks:labels', () => this.taskService.listLabels())
    this.handle(window, 'tasks:completed', (_event, input) => {
      const parsed = z.object({ since: z.iso.datetime(), until: z.iso.datetime() }).strict().parse(input)
      return this.taskService.listCompletedTasks(parsed.since, parsed.until)
    })
    this.handle(window, 'tasks:create', (_event, input) => this.taskService.createTask(this.withoutUndefined(TaskDraftSchema.parse(input)) as unknown as TaskDraft))
    this.handle(window, 'tasks:update', (_event, input) => {
      const parsed = z.object({ task_id: TaskIdSchema }).catchall(z.unknown()).parse(input)
      const { task_id, ...patch } = parsed
      return this.taskService.updateTask(task_id, this.withoutUndefined(TaskPatchSchema.parse(patch)) as TaskPatch)
    })
    this.handle(window, 'tasks:complete', (_event, taskId) => this.taskService.completeTask(TaskIdSchema.parse(taskId)))
    this.handle(window, 'tasks:reopen', (_event, taskId) => this.taskService.reopenTask(TaskIdSchema.parse(taskId)))
    this.handle(window, 'tasks:delete', (_event, taskId) => this.taskService.deleteTask(TaskIdSchema.parse(taskId)))
    this.handle(window, 'dashboard:metrics', () => this.dashboardService.getMetrics())
    this.handle(window, 'settings:todoist-status', () => this.settingsService.getTodoistStatus())
    this.handle(window, 'settings:get-appearance', () => this.settingsService.getAppearance())
    this.handle(window, 'settings:set-appearance', (_event, mode) => {
      this.settingsService.setAppearance(z.enum(['system', 'light', 'dark']).parse(mode))
    })
    this.handle(window, 'settings:save-todoist-token', (_event, token) => {
      return this.settingsService.saveTodoistToken(z.string().trim().min(1).max(4096).parse(token))
    })
    this.handle(window, 'settings:remove-todoist-token', () => this.settingsService.removeTodoistToken())
    this.handle(window, 'settings:test-todoist', () => this.settingsService.testTodoistConnection())
  }

  private handle<T>(
    window: BrowserWindow,
    channel: string,
    handler: (event: IpcMainInvokeEvent, input?: unknown) => Promise<T> | T,
  ): void {
    ipcMain.handle(channel, (event, input?: unknown) => {
      if (event.sender !== window.webContents) throw new Error('Unauthorized application request.')
      return handler(event, input)
    })
  }

  private withoutUndefined<T extends object>(value: T): Record<string, unknown> {
    return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined))
  }
}
