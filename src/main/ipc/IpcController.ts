import { ipcMain, type BrowserWindow, type IpcMainInvokeEvent } from 'electron'
import * as z from 'zod/v4'
import type { DashboardService } from '../dashboard/DashboardService'
import type { SettingsApplicationService } from '../settings/SettingsApplicationService'
import type { TaskApplicationService } from '../tasks/TaskApplicationService'
import type { FocusDashboardService } from '../focus/FocusDashboardService'
import type { FocusTimerService } from '../focus/FocusTimerService'
import type { FocusNotificationService } from '../focus/FocusNotificationService'
import type { TaskDraft, TaskPatch } from '../../shared/domain'
import type { McpHttpService } from '../mcp/McpHttpService'
import { FOCUS_TIMER_DURATION_LIMITS } from '../../shared/domain'

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
const FocusTimerPreferencesSchema = z.object({
  focusMinutes: z.number().int().min(FOCUS_TIMER_DURATION_LIMITS.focus.min).max(FOCUS_TIMER_DURATION_LIMITS.focus.max),
  breakMinutes: z.number().int().min(FOCUS_TIMER_DURATION_LIMITS.break.min).max(FOCUS_TIMER_DURATION_LIMITS.break.max),
}).strict()

export class IpcController {
  constructor(
    private readonly taskService: TaskApplicationService,
    private readonly dashboardService: DashboardService,
    private readonly settingsService: SettingsApplicationService,
    private readonly mcpHttpService: McpHttpService,
    private readonly focusTimerService: FocusTimerService,
    private readonly focusDashboardService: FocusDashboardService,
    private readonly focusNotificationService: FocusNotificationService,
  ) {}

  register(window: BrowserWindow): void {
    const unsubscribeFromTimer = this.focusTimerService.subscribe((snapshot) => {
      if (!window.isDestroyed()) window.webContents.send('focus-timer:state', snapshot)
    })
    window.once('closed', unsubscribeFromTimer)
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
    this.handle(window, 'focus-timer:get-state', () => this.focusTimerService.getSnapshot())
    this.handle(window, 'focus-timer:start-focus', (_event, minutes) => {
      return this.focusTimerService.startFocus(z.number().int().min(FOCUS_TIMER_DURATION_LIMITS.focus.min).max(FOCUS_TIMER_DURATION_LIMITS.focus.max).parse(minutes))
    })
    this.handle(window, 'focus-timer:start-break', (_event, minutes) => {
      return this.focusTimerService.startBreak(z.number().int().min(FOCUS_TIMER_DURATION_LIMITS.break.min).max(FOCUS_TIMER_DURATION_LIMITS.break.max).parse(minutes))
    })
    this.handle(window, 'focus-timer:pause', () => this.focusTimerService.pause())
    this.handle(window, 'focus-timer:resume', () => this.focusTimerService.resume())
    this.handle(window, 'focus-timer:set-remaining', (_event, minutes) => {
      return this.focusTimerService.setRemainingMinutes(z.number().int().parse(minutes))
    })
    this.handle(window, 'focus-timer:end', () => this.focusTimerService.endEarly())
    this.handle(window, 'focus-timer:get-preferences', () => this.settingsService.getFocusTimerPreferences())
    this.handle(window, 'focus-timer:set-preferences', (_event, preferences) => {
      return this.settingsService.setFocusTimerPreferences(FocusTimerPreferencesSchema.parse(preferences))
    })
    this.handle(window, 'focus-dashboard:metrics', (_event, days) => {
      return this.focusDashboardService.getMetrics(z.union([z.literal(7), z.literal(30)]).parse(days ?? 30))
    })
    this.handle(window, 'settings:todoist-status', () => this.settingsService.getTodoistStatus())
    this.handle(window, 'settings:test-notification', () => this.focusNotificationService.testNotification())
    this.handle(window, 'settings:get-appearance', () => this.settingsService.getAppearance())
    this.handle(window, 'settings:set-appearance', (_event, mode) => {
      this.settingsService.setAppearance(z.enum(['system', 'light', 'dark']).parse(mode))
    })
    this.handle(window, 'settings:save-todoist-token', (_event, token) => {
      return this.settingsService.saveTodoistToken(z.string().trim().min(1).max(4096).parse(token))
    })
    this.handle(window, 'settings:remove-todoist-token', () => this.settingsService.removeTodoistToken())
    this.handle(window, 'settings:test-todoist', () => this.settingsService.testTodoistConnection())
    this.handle(window, 'settings:mcp-http-status', () => this.mcpHttpService.getStatus())
    this.handle(window, 'settings:set-mcp-http-enabled', (_event, enabled) => {
      return this.mcpHttpService.setEnabled(z.boolean().parse(enabled))
    })
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
