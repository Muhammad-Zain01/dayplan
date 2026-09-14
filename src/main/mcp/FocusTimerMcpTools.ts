import { McpServer } from '@modelcontextprotocol/server'
import * as z from 'zod/v4'
import type { FocusDashboardService } from '../focus/FocusDashboardService'
import type { FocusTimerService } from '../focus/FocusTimerService'
import { FOCUS_TIMER_DURATION_LIMITS } from '../../shared/domain'

const EmptyInputSchema = z.object({}).strict()
const FocusTimerSnapshotSchema = z.object({
  sessionId: z.string().nullable(),
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
  refreshedAt: z.iso.datetime(),
})

export class FocusTimerMcpTools {
  constructor(
    private readonly timerService: FocusTimerService,
    private readonly dashboardService: FocusDashboardService,
  ) {}

  register(server: McpServer): void {
    server.registerTool('focus_timer_get_state', {
      description: 'Get the current Dayplan focus or break timer, including its status and remaining seconds.',
      inputSchema: EmptyInputSchema,
      outputSchema: FocusTimerSnapshotSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    }, async () => this.result(this.timerService.getSnapshot()))

    server.registerTool('focus_get_daily_stats', {
      description: 'Get locally stored Dayplan focus time and completed sessions for the last 7 or 30 local days. Breaks are excluded.',
      inputSchema: z.object({ days: z.union([z.literal(7), z.literal(30)]).optional() }).strict(),
      outputSchema: FocusMetricsSchema,
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    }, async ({ days }) => this.result(this.dashboardService.getMetrics(days ?? 7)))

    server.registerTool('focus_timer_start_focus', {
      description: 'Start a Dayplan focus timer for 1 to 240 minutes immediately.',
      inputSchema: z.object({ duration_minutes: z.number().int().min(FOCUS_TIMER_DURATION_LIMITS.focus.min).max(FOCUS_TIMER_DURATION_LIMITS.focus.max) }).strict(),
      outputSchema: FocusTimerSnapshotSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    }, async ({ duration_minutes }) => this.result(this.timerService.startFocus(duration_minutes)))

    server.registerTool('focus_timer_start_break', {
      description: 'Start a Dayplan break timer for 1 to 120 minutes immediately.',
      inputSchema: z.object({ duration_minutes: z.number().int().min(FOCUS_TIMER_DURATION_LIMITS.break.min).max(FOCUS_TIMER_DURATION_LIMITS.break.max) }).strict(),
      outputSchema: FocusTimerSnapshotSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    }, async ({ duration_minutes }) => this.result(this.timerService.startBreak(duration_minutes)))

    server.registerTool('focus_timer_pause', {
      description: 'Pause the running Dayplan focus or break timer immediately.',
      inputSchema: EmptyInputSchema,
      outputSchema: FocusTimerSnapshotSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    }, async () => this.result(this.timerService.pause()))

    server.registerTool('focus_timer_resume', {
      description: 'Resume the paused Dayplan focus or break timer immediately.',
      inputSchema: EmptyInputSchema,
      outputSchema: FocusTimerSnapshotSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    }, async () => this.result(this.timerService.resume()))

    server.registerTool('focus_timer_set_remaining', {
      description: 'Change the remaining time on an active Dayplan focus or break timer immediately. Focus timers allow up to 240 minutes; breaks allow up to 120 minutes.',
      inputSchema: z.object({ remaining_minutes: z.number().int().min(FOCUS_TIMER_DURATION_LIMITS.focus.min).max(FOCUS_TIMER_DURATION_LIMITS.focus.max) }).strict(),
      outputSchema: FocusTimerSnapshotSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    }, async ({ remaining_minutes }) => this.result(this.timerService.setRemainingMinutes(remaining_minutes)))

    server.registerTool('focus_timer_end', {
      description: 'End the active Dayplan timer early and save its actual active time immediately.',
      inputSchema: EmptyInputSchema,
      outputSchema: FocusTimerSnapshotSchema,
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    }, async () => this.result(this.timerService.endEarly()))
  }

  private result<T>(value: T) {
    return {
      content: [{ type: 'text' as const, text: JSON.stringify(value) }],
      structuredContent: value as Record<string, unknown>,
    }
  }
}
