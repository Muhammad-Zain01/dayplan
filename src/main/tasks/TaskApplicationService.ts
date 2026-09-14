import type { TaskDraft, TaskPatch, TodoistLabel, TodoistProject, TodoistTask } from '../../shared/domain'
import type { TodoistApiClient } from '../integrations/todoist/TodoistApiClient'

export class TaskApplicationService {
  constructor(private readonly todoistApiClient: TodoistApiClient) {}

  listTasks(options: { limit?: number; project_id?: string } = {}): Promise<TodoistTask[]> {
    return this.todoistApiClient.listTasks(options)
  }

  getTask(taskId: string): Promise<TodoistTask> {
    this.validateTaskId(taskId)
    return this.todoistApiClient.getTask(taskId)
  }

  listProjects(): Promise<TodoistProject[]> {
    return this.todoistApiClient.listProjects()
  }

  listLabels(): Promise<TodoistLabel[]> {
    return this.todoistApiClient.listLabels()
  }

  async createTask(draft: TaskDraft): Promise<TodoistTask> {
    const content = draft.content.trim()
    if (!content || content.length > 500) throw new Error('Task name must be between 1 and 500 characters.')
    if ((draft.description?.length ?? 0) > 5000) throw new Error('Description must be 5,000 characters or less.')
    this.validatePriority(draft.priority)
    this.validateDate(draft.due_date)
    this.validateLabels(draft.labels)
    return this.todoistApiClient.createTask({ ...draft, content })
  }

  async updateTask(taskId: string, patch: TaskPatch): Promise<TodoistTask> {
    this.validateTaskId(taskId)
    if (Object.keys(patch).length === 0) throw new Error('Provide at least one field to update.')
    if (patch.content !== undefined && (!patch.content.trim() || patch.content.length > 500)) {
      throw new Error('Task name must be between 1 and 500 characters.')
    }
    if (patch.description !== undefined && patch.description.length > 5000) {
      throw new Error('Description must be 5,000 characters or less.')
    }
    this.validatePriority(patch.priority)
    this.validateDate(patch.due_date)
    this.validateLabels(patch.labels)
    return this.todoistApiClient.updateTask(taskId, patch)
  }

  async completeTask(taskId: string): Promise<{ completed: true }> {
    this.validateTaskId(taskId)
    await this.todoistApiClient.completeTask(taskId)
    return { completed: true }
  }

  async reopenTask(taskId: string): Promise<{ reopened: true }> {
    this.validateTaskId(taskId)
    await this.todoistApiClient.reopenTask(taskId)
    return { reopened: true }
  }

  async deleteTask(taskId: string): Promise<{ deleted: true; subtasks_also_deleted: true }> {
    this.validateTaskId(taskId)
    await this.todoistApiClient.deleteTask(taskId)
    return { deleted: true, subtasks_also_deleted: true }
  }

  async listCompletedTasks(since: string, until: string): Promise<TodoistTask[]> {
    this.validateCompletionRange(since, until)
    const tasks = await this.todoistApiClient.listCompletedTasks(since, until)
    return tasks.map((task) => ({ ...task, is_completed: true }))
  }

  private validateCompletionRange(since: string, until: string): void {
    const start = new Date(since)
    const end = new Date(until)
    const utcIsoDateTime = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/
    if (
      !utcIsoDateTime.test(since) || !utcIsoDateTime.test(until) ||
      !Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) ||
      start.toISOString().slice(0, 10) !== since.slice(0, 10) ||
      end.toISOString().slice(0, 10) !== until.slice(0, 10) || end <= start
    ) {
      throw new Error('Completion history requires a valid, increasing date-time range.')
    }

    const targetMonth = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 3, 1))
    const lastDay = new Date(Date.UTC(targetMonth.getUTCFullYear(), targetMonth.getUTCMonth() + 1, 0)).getUTCDate()
    const maximumEnd = new Date(Date.UTC(
      targetMonth.getUTCFullYear(),
      targetMonth.getUTCMonth(),
      Math.min(start.getUTCDate(), lastDay),
      start.getUTCHours(),
      start.getUTCMinutes(),
      start.getUTCSeconds(),
      start.getUTCMilliseconds(),
    ))
    if (end > maximumEnd) throw new Error('Completion history is limited to three calendar months per request.')
  }

  private validateTaskId(taskId: string): void {
    if (!taskId.trim() || taskId.length > 128) throw new Error('Enter a valid Todoist task ID.')
  }

  private validatePriority(priority: number | undefined): void {
    if (priority !== undefined && (!Number.isInteger(priority) || priority < 1 || priority > 4)) {
      throw new Error('Priority must be between 1 and 4.')
    }
  }

  private validateDate(date: string | null | undefined): void {
    if (date === undefined || date === null) return
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Due date must use YYYY-MM-DD format.')
    const [year, month, day] = date.split('-').map(Number)
    const parsed = new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 0))
    if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== (month ?? 0) - 1 || parsed.getUTCDate() !== day) {
      throw new Error('Due date must use YYYY-MM-DD format.')
    }
  }

  private validateLabels(labels: string[] | undefined): void {
    if (labels === undefined) return
    if (labels.length > 50 || labels.some((label) => !label.trim() || label.length > 100)) {
      throw new Error('Use up to 50 non-empty labels, each 100 characters or less.')
    }
  }
}
