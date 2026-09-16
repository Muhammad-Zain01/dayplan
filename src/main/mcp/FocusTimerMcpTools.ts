import { McpServer } from '@modelcontextprotocol/server'
import * as z from 'zod/v4'
import type { FocusDashboardService } from '../focus/FocusDashboardService'
import type { FocusTimerService } from '../focus/FocusTimerService'
import { FOCUS_TIMER_DURATION_LIMITS } from '../../shared/domain'
import type { WorkspaceApplicationService } from '../workspaces/WorkspaceApplicationService'

const WorkspaceInputSchema = z.object({ workspace_id: z.string().uuid() }).strict()
const FocusTimerSnapshotSchema = z.object({
  sessionId: z.string().nullable(),
  workspaceId: z.string().nullable(),
  kind: z.enum(['focus', 'break']).nullable(),
  status: z.enum(['idle', 'running', 'paused', 'completed', 'ended_early']),
  targetSeconds: z.number().int().nonnegative(),
  elapsedSeconds: z.number().int().nonnegative(),
  remainingSeconds: z.number().int().nonnegative(),
  updatedAt: z.iso.datetime(),
})
const FocusMetricsSchema = z.object({
  todaySeconds: z.number().int().nonnegative(),
  todayCompletedSessions: z.number().int().nonnegative(),
  recentFocusTime: z.array(z.object({ date: z.iso.date(), seconds: z.number().int().nonnegative() })),
  hourlyFocusTime: z.array(z.object({ hour: z.number().int().min(0).max(23), seconds: z.number().int().nonnegative() })),
  refreshedAt: z.iso.datetime(),
})

export class FocusTimerMcpTools {
  constructor(
    private readonly timerService: FocusTimerService,
    private readonly dashboardService: FocusDashboardService,
    private readonly workspaceService: WorkspaceApplicationService,
  ) {}

  register(server: McpServer): void {
    server.registerTool('focus_timer_get_state', {
      description: 'Get focus or break timer state for the specified workspace. An active timer in another workspace is not included.',
      inputSchema: WorkspaceInputSchema,
      outputSchema: FocusTimerSnapshotSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    }, async ({ workspace_id }) => {
      this.workspaceService.assertUsableWorkspace(workspace_id)
      return this.result(this.timerService.getSnapshot(workspace_id))
    })

    server.registerTool('focus_get_daily_stats', {
      description: 'Get locally stored focus time for the specified workspace and last 7 or 30 local days. Breaks are excluded.',
      inputSchema: z.object({ workspace_id: z.string().uuid(), days: z.union([z.literal(7), z.literal(30)]).optional() }).strict(),
      outputSchema: FocusMetricsSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    }, async ({ workspace_id, days }) => {
      this.workspaceService.assertUsableWorkspace(workspace_id)
      return this.result(this.dashboardService.getMetrics(workspace_id, days ?? 7))
    })

    server.registerTool('focus_timer_start_focus', {
      description: 'Start a focus timer in the specified workspace for 1 to 240 minutes immediately.',
      inputSchema: z.object({ workspace_id: z.string().uuid(), duration_minutes: z.number().int().min(FOCUS_TIMER_DURATION_LIMITS.focus.min).max(FOCUS_TIMER_DURATION_LIMITS.focus.max) }).strict(),
      outputSchema: FocusTimerSnapshotSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    }, async ({ workspace_id, duration_minutes }) => {
      this.workspaceService.assertUsableWorkspace(workspace_id)
      return this.result(this.timerService.startFocus(workspace_id, duration_minutes))
    })

    server.registerTool('focus_timer_start_break', {
      description: 'Start a break timer in the specified workspace for 1 to 120 minutes immediately.',
      inputSchema: z.object({ workspace_id: z.string().uuid(), duration_minutes: z.number().int().min(FOCUS_TIMER_DURATION_LIMITS.break.min).max(FOCUS_TIMER_DURATION_LIMITS.break.max) }).strict(),
      outputSchema: FocusTimerSnapshotSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    }, async ({ workspace_id, duration_minutes }) => {
      this.workspaceService.assertUsableWorkspace(workspace_id)
      return this.result(this.timerService.startBreak(workspace_id, duration_minutes))
    })

    server.registerTool('focus_timer_pause', {
      description: 'Pause the running timer owned by the specified workspace immediately.',
      inputSchema: WorkspaceInputSchema,
      outputSchema: FocusTimerSnapshotSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    }, async ({ workspace_id }) => {
      this.workspaceService.assertUsableWorkspace(workspace_id)
      return this.result(this.timerService.pause(workspace_id))
    })

    server.registerTool('focus_timer_resume', {
      description: 'Resume the paused timer owned by the specified workspace immediately.',
      inputSchema: WorkspaceInputSchema,
      outputSchema: FocusTimerSnapshotSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    }, async ({ workspace_id }) => {
      this.workspaceService.assertUsableWorkspace(workspace_id)
      return this.result(this.timerService.resume(workspace_id))
    })

    server.registerTool('focus_timer_set_remaining', {
      description: 'Change the remaining time on a timer in the specified workspace immediately. Focus timers allow up to 240 minutes; breaks allow up to 120 minutes.',
      inputSchema: z.object({ workspace_id: z.string().uuid(), remaining_minutes: z.number().int().min(FOCUS_TIMER_DURATION_LIMITS.focus.min).max(FOCUS_TIMER_DURATION_LIMITS.focus.max) }).strict(),
      outputSchema: FocusTimerSnapshotSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    }, async ({ workspace_id, remaining_minutes }) => {
      this.workspaceService.assertUsableWorkspace(workspace_id)
      return this.result(this.timerService.setRemainingMinutes(workspace_id, remaining_minutes))
    })

    server.registerTool('focus_timer_end', {
      description: 'End the active timer owned by the specified workspace early and save its actual active time immediately.',
      inputSchema: WorkspaceInputSchema,
      outputSchema: FocusTimerSnapshotSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    }, async ({ workspace_id }) => {
      this.workspaceService.assertUsableWorkspace(workspace_id)
      return this.result(this.timerService.endEarly(workspace_id))
    })
  }

  private result<T>(value: T) {
    return {
      content: [{ type: 'text' as const, text: JSON.stringify(value) }],
      structuredContent: value as Record<string, unknown>,
    }
  }
}
