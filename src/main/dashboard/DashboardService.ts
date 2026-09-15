import type { DashboardMetrics, TodoistTask } from '../../shared/domain'
import type { TaskApplicationService } from '../tasks/TaskApplicationService'

export class DashboardService {
  constructor(private readonly taskService: TaskApplicationService) {}

  async getMetrics(workspaceId: string): Promise<DashboardMetrics> {
    const now = new Date()
    const today = this.localDateKey(now)
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29)
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
    const [tasks, completed] = await Promise.all([
      this.taskService.listTasks(workspaceId, { limit: 5000 }),
      this.taskService.listCompletedTasks(workspaceId, start.toISOString(), end.toISOString()),
    ])
    const overdueTasks = tasks.filter((task) => task.due?.date && task.due.date < today)
    const dueToday = tasks.filter((task) => task.due?.date === today).length
    const recentCompletions = this.recentCompletionCounts(completed, start, 30)
    return {
      openTasks: tasks.length,
      dueToday,
      overdue: overdueTasks.length,
      completedToday: completed.filter((task) => this.localDateKey(new Date(task.completed_at ?? '')) === today).length,
      upcoming: tasks
        .filter((task) => task.due?.date && task.due.date >= today)
        .sort((left, right) => (left.due?.date ?? '').localeCompare(right.due?.date ?? ''))
        .slice(0, 5),
      recentCompletions,
      refreshedAt: now.toISOString(),
    }
  }

  private recentCompletionCounts(tasks: TodoistTask[], start: Date, days: number): Array<{ date: string; count: number }> {
    const counts = new Map<string, number>()
    for (let offset = 0; offset < days; offset += 1) {
      const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + offset)
      counts.set(this.localDateKey(date), 0)
    }
    for (const task of tasks) {
      if (!task.completed_at) continue
      const date = this.localDateKey(new Date(task.completed_at))
      if (counts.has(date)) counts.set(date, (counts.get(date) ?? 0) + 1)
    }
    return [...counts].map(([date, count]) => ({ date, count }))
  }

  private localDateKey(date: Date): string {
    if (Number.isNaN(date.getTime())) return ''
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  }
}
