import { describe, expect, it, vi } from 'vitest'
import type { McpServer } from '@modelcontextprotocol/server'
import { FocusTimerMcpTools } from './FocusTimerMcpTools'

type ToolResult = { content: Array<{ type: string; text: string }>; isError?: boolean; structuredContent?: Record<string, unknown> }
type ToolHandler = (input: Record<string, unknown>) => Promise<ToolResult>
const WORKSPACE_ID = '00000000-0000-4000-8000-000000000001'

describe('FocusTimerMcpTools', () => {
  it('registers the timer state, statistics, and control tools', () => {
    const harness = createHarness()
    const tools = new FocusTimerMcpTools(harness.timer as never, harness.dashboard as never, harness.workspaceService as never)
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

  it('serves daily statistics', async () => {
    const harness = createHarness()
    new FocusTimerMcpTools(harness.timer as never, harness.dashboard as never, harness.workspaceService as never).register(harness.server)

    const result = await harness.handlers.get('focus_get_daily_stats')?.({ workspace_id: WORKSPACE_ID, days: 7 })

    expect(result?.structuredContent).toMatchObject({ todaySeconds: 900, todayCompletedSessions: 1 })
    expect(harness.dashboard.getMetrics).toHaveBeenCalledWith(WORKSPACE_ID, 7)
  })

  it('starts a focus timer immediately', async () => {
    const harness = createHarness()
    new FocusTimerMcpTools(harness.timer as never, harness.dashboard as never, harness.workspaceService as never).register(harness.server)

    const result = await harness.handlers.get('focus_timer_start_focus')?.({ workspace_id: WORKSPACE_ID, duration_minutes: 30 })

    expect(harness.timer.startFocus).toHaveBeenCalledWith(WORKSPACE_ID, 30)
    expect(result?.structuredContent).toMatchObject({ status: 'running', targetSeconds: 3600 })
  })

  it('starts, pauses, resumes, adjusts, and ends timers without application approval', async () => {
    const harness = createHarness()
    new FocusTimerMcpTools(harness.timer as never, harness.dashboard as never, harness.workspaceService as never).register(harness.server)

    await harness.handlers.get('focus_timer_start_focus')?.({ workspace_id: WORKSPACE_ID, duration_minutes: 45 })
    await harness.handlers.get('focus_timer_start_break')?.({ workspace_id: WORKSPACE_ID, duration_minutes: 17 })
    await harness.handlers.get('focus_timer_set_remaining')?.({ workspace_id: WORKSPACE_ID, remaining_minutes: 12 })
    await harness.handlers.get('focus_timer_pause')?.({ workspace_id: WORKSPACE_ID })
    await harness.handlers.get('focus_timer_resume')?.({ workspace_id: WORKSPACE_ID })
    await harness.handlers.get('focus_timer_end')?.({ workspace_id: WORKSPACE_ID })

    expect(harness.timer.startFocus).toHaveBeenCalledWith(WORKSPACE_ID, 45)
    expect(harness.timer.startBreak).toHaveBeenCalledWith(WORKSPACE_ID, 17)
    expect(harness.timer.setRemainingMinutes).toHaveBeenCalledWith(WORKSPACE_ID, 12)
  })

  function createHarness() {
    const snapshot = {
      sessionId: 'session-1', workspaceId: WORKSPACE_ID, kind: 'focus', status: 'running', targetSeconds: 3600,
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
    const workspaceService = { assertUsableWorkspace: vi.fn() }
    return { server, handlers, timer, dashboard, workspaceService }
  }
})
