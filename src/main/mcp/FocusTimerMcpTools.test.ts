import { describe, expect, it, vi } from 'vitest'
import type { McpServer } from '@modelcontextprotocol/server'
import { FocusTimerMcpTools } from './FocusTimerMcpTools'

type ToolResult = { content: Array<{ type: string; text: string }>; isError?: boolean; structuredContent?: Record<string, unknown> }
type ToolHandler = (input: Record<string, unknown>) => Promise<ToolResult>

describe('FocusTimerMcpTools', () => {
  it('registers the timer state, statistics, and control tools', () => {
    const harness = createHarness(true)
    const tools = new FocusTimerMcpTools(harness.timer as never, harness.dashboard as never, harness.approval as never)
    tools.register(harness.server)

    expect([...harness.handlers.keys()]).toEqual([
      'focus_timer_get_state',
      'focus_get_daily_stats',
      'focus_timer_start_focus',
      'focus_timer_start_break',
      'focus_timer_pause',
      'focus_timer_resume',
      'focus_timer_set_remaining',
      'focus_timer_end',
    ])
  })

  it('serves daily statistics without requesting mutation approval', async () => {
    const harness = createHarness(true)
    new FocusTimerMcpTools(harness.timer as never, harness.dashboard as never, harness.approval as never).register(harness.server)

    const result = await harness.handlers.get('focus_get_daily_stats')?.({ days: 7 })

    expect(result?.structuredContent).toMatchObject({ todaySeconds: 900, todayCompletedSessions: 1 })
    expect(harness.dashboard.getMetrics).toHaveBeenCalledWith(7)
    expect(harness.approval.requestApproval).not.toHaveBeenCalled()
  })

  it('does not start a focus timer when approval is denied', async () => {
    const harness = createHarness(false)
    new FocusTimerMcpTools(harness.timer as never, harness.dashboard as never, harness.approval as never).register(harness.server)

    const result = await harness.handlers.get('focus_timer_start_focus')?.({ duration_minutes: 30 })

    expect(result?.isError).toBe(true)
    expect(harness.approval.requestApproval).toHaveBeenCalledWith('focus_timer_start_focus', { duration_minutes: 30 })
    expect(harness.timer.startFocus).not.toHaveBeenCalled()
  })

  it('starts a focus timer after Dayplan approval', async () => {
    const harness = createHarness(true)
    new FocusTimerMcpTools(harness.timer as never, harness.dashboard as never, harness.approval as never).register(harness.server)

    const result = await harness.handlers.get('focus_timer_start_focus')?.({ duration_minutes: 60 })

    expect(harness.timer.startFocus).toHaveBeenCalledWith(60)
    expect(result?.structuredContent).toMatchObject({ status: 'running', targetSeconds: 3600 })
  })

  it('supports custom focus, break, and active remaining durations after approval', async () => {
    const harness = createHarness(true)
    new FocusTimerMcpTools(harness.timer as never, harness.dashboard as never, harness.approval as never).register(harness.server)

    await harness.handlers.get('focus_timer_start_focus')?.({ duration_minutes: 45 })
    await harness.handlers.get('focus_timer_start_break')?.({ duration_minutes: 17 })
    await harness.handlers.get('focus_timer_set_remaining')?.({ remaining_minutes: 12 })

    expect(harness.timer.startFocus).toHaveBeenCalledWith(45)
    expect(harness.timer.startBreak).toHaveBeenCalledWith(17)
    expect(harness.timer.setRemainingMinutes).toHaveBeenCalledWith(12)
    expect(harness.approval.requestApproval).toHaveBeenCalledWith('focus_timer_set_remaining', { remaining_minutes: 12 })
  })

  function createHarness(approved: boolean) {
    const snapshot = {
      sessionId: 'session-1', kind: 'focus', status: 'running', targetSeconds: 3600,
      elapsedSeconds: 0, remainingSeconds: 3600, updatedAt: '2026-01-01T00:00:00.000Z',
    }
    const handlers = new Map<string, ToolHandler>()
    const server = {
      registerTool: (name: string, _configuration: unknown, handler: ToolHandler): void => { handlers.set(name, handler) },
    } as unknown as McpServer
    const timer = {
      getSnapshot: vi.fn(() => snapshot),
      startFocus: vi.fn(() => snapshot),
      startBreak: vi.fn(() => snapshot),
      pause: vi.fn(() => snapshot),
      resume: vi.fn(() => snapshot),
      setRemainingMinutes: vi.fn(() => snapshot),
      endEarly: vi.fn(() => snapshot),
    }
    const dashboard = {
      getMetrics: vi.fn(() => ({ todaySeconds: 900, todayCompletedSessions: 1, recentFocusTime: [], refreshedAt: snapshot.updatedAt })),
    }
    const approval = { requestApproval: vi.fn(async () => approved) }
    return { server, handlers, timer, dashboard, approval }
  }
})
