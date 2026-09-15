import { afterEach, describe, expect, it, vi } from 'vitest'
import { DashboardService } from './DashboardService'
import type { TodoistTask } from '../../shared/domain'

const WORKSPACE_ID = '00000000-0000-4000-8000-000000000001'

describe('DashboardService', () => {
  afterEach(() => vi.useRealTimers())

  it('calculates dashboard metrics and 30-day completion history from Todoist data', async () => {
    vi.useFakeTimers()
    const now = new Date()
    vi.setSystemTime(now)
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).toISOString().slice(0, 10)
    const tasks: TodoistTask[] = [
      { id: 'today', content: 'Today', description: '', project_id: null, labels: [], priority: 4, due: { date: today } },
      { id: 'late', content: 'Late', description: '', project_id: null, labels: [], priority: 3, due: { date: yesterday } },
      { id: 'open', content: 'Open', description: '', project_id: null, labels: [], priority: 1, due: null },
    ]
    const completed: TodoistTask[] = [{ ...tasks[0]!, id: 'done', completed_at: now.toISOString() }]
    const taskService = {
      listTasks: vi.fn(async () => tasks),
      listCompletedTasks: vi.fn(async () => completed),
    }
    const dashboard = new DashboardService(taskService as never)

    const result = await dashboard.getMetrics(WORKSPACE_ID)

    expect(result.openTasks).toBe(3)
    expect(result.dueToday).toBe(1)
    expect(result.overdue).toBe(1)
    expect(result.completedToday).toBe(1)
    expect(taskService.listCompletedTasks).toHaveBeenCalledWith(
      WORKSPACE_ID,
      new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29).toISOString(),
      new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString(),
    )
    expect(result.recentCompletions).toHaveLength(30)
    expect(result.recentCompletions.reduce((sum, entry) => sum + entry.count, 0)).toBe(1)
    expect(Number.isNaN(new Date(result.refreshedAt).getTime())).toBe(false)
  })
})
