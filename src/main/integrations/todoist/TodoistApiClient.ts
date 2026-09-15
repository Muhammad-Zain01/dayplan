import type { CredentialService } from '../../security/CredentialService'
import type { TaskDraft, TaskPatch, TodoistLabel, TodoistProject, TodoistTask } from '../../../shared/domain'

interface Page<T> {
  results: T[]
  next_cursor: string | null
}

interface CompletedTasksPage<T> {
  items: T[]
  next_cursor: string | null
}

export class TodoistApiError extends Error {
  constructor(message: string, readonly statusCode?: number) {
    super(message)
    this.name = 'TodoistApiError'
  }
}

export class TodoistApiClient {
  private readonly baseUrl = 'https://api.todoist.com/api/v1'

  constructor(
    private readonly credentialService: CredentialService,
    private readonly request: typeof fetch = fetch,
  ) {}

  async testConnection(workspaceId: string, candidateToken?: string): Promise<void> {
    await this.listTasks(workspaceId, { limit: 1 }, candidateToken)
  }

  async listTasks(workspaceId: string, options: { limit?: number; project_id?: string } = {}, candidateToken?: string): Promise<TodoistTask[]> {
    const limit = Math.min(Math.max(options.limit ?? 200, 1), 5000)
    const tasks: TodoistTask[] = []
    let cursor: string | null = null
    const seenCursors = new Set<string>()

    do {
      const url = new URL(`${this.baseUrl}/tasks`)
      url.searchParams.set('limit', String(Math.min(200, limit - tasks.length)))
      if (options.project_id) url.searchParams.set('project_id', options.project_id)
      if (cursor) url.searchParams.set('cursor', cursor)
      const page = await this.get<Page<TodoistTask>>(url, workspaceId, candidateToken)
      tasks.push(...page.results)
      cursor = page.next_cursor
      if (cursor && seenCursors.has(cursor)) throw new TodoistApiError('Todoist returned invalid pagination data.')
      if (cursor) seenCursors.add(cursor)
    } while (cursor && tasks.length < limit)

    return tasks.slice(0, limit)
  }

  async getTask(workspaceId: string, taskId: string): Promise<TodoistTask> {
    return this.get<TodoistTask>(`${this.baseUrl}/tasks/${encodeURIComponent(taskId)}`, workspaceId)
  }

  async listProjects(workspaceId: string): Promise<TodoistProject[]> {
    return this.getAllPages<TodoistProject>('/projects', workspaceId)
  }

  async listLabels(workspaceId: string): Promise<TodoistLabel[]> {
    return this.getAllPages<TodoistLabel>('/labels', workspaceId)
  }

  async createTask(workspaceId: string, draft: TaskDraft): Promise<TodoistTask> {
    const body: Record<string, unknown> = {
      content: draft.content.trim(),
      description: draft.description?.trim() ?? '',
      priority: draft.priority ?? 1,
      labels: draft.labels ?? [],
    }
    if (draft.project_id) body.project_id = draft.project_id
    if (draft.due_date) body.due_date = draft.due_date
    return this.send<TodoistTask>(`${this.baseUrl}/tasks`, 'POST', workspaceId, body)
  }

  async updateTask(workspaceId: string, taskId: string, patch: TaskPatch): Promise<TodoistTask> {
    const body: Record<string, unknown> = {}
    if (patch.content !== undefined) body.content = patch.content.trim()
    if (patch.description !== undefined) body.description = patch.description.trim()
    if (patch.due_date !== undefined) body.due_date = patch.due_date
    if (patch.priority !== undefined) body.priority = patch.priority
    if (patch.labels !== undefined) body.labels = patch.labels
    return this.send<TodoistTask>(`${this.baseUrl}/tasks/${encodeURIComponent(taskId)}`, 'POST', workspaceId, body)
  }

  async completeTask(workspaceId: string, taskId: string): Promise<void> {
    await this.send<void>(`${this.baseUrl}/tasks/${encodeURIComponent(taskId)}/close`, 'POST', workspaceId)
  }

  async reopenTask(workspaceId: string, taskId: string): Promise<void> {
    await this.send<void>(`${this.baseUrl}/tasks/${encodeURIComponent(taskId)}/reopen`, 'POST', workspaceId)
  }

  async deleteTask(workspaceId: string, taskId: string): Promise<void> {
    await this.send<void>(`${this.baseUrl}/tasks/${encodeURIComponent(taskId)}`, 'DELETE', workspaceId)
  }

  async listCompletedTasks(workspaceId: string, since: string, until: string): Promise<TodoistTask[]> {
    const tasks: TodoistTask[] = []
    let cursor: string | null = null
    const seenCursors = new Set<string>()
    do {
      const url = new URL(`${this.baseUrl}/tasks/completed/by_completion_date`)
      url.searchParams.set('since', since)
      url.searchParams.set('until', until)
      url.searchParams.set('limit', '200')
      if (cursor) url.searchParams.set('cursor', cursor)
      const page = await this.get<CompletedTasksPage<TodoistTask>>(url, workspaceId)
      tasks.push(...page.items)
      cursor = page.next_cursor
      if (cursor && seenCursors.has(cursor)) throw new TodoistApiError('Todoist returned invalid pagination data.')
      if (cursor) seenCursors.add(cursor)
    } while (cursor)
    return tasks
  }

  private async getAllPages<T>(path: string, workspaceId: string): Promise<T[]> {
    const items: T[] = []
    let cursor: string | null = null
    const seenCursors = new Set<string>()
    do {
      const url = new URL(`${this.baseUrl}${path}`)
      url.searchParams.set('limit', '200')
      if (cursor) url.searchParams.set('cursor', cursor)
      const page = await this.get<Page<T>>(url, workspaceId)
      items.push(...page.results)
      cursor = page.next_cursor
      if (cursor && seenCursors.has(cursor)) throw new TodoistApiError('Todoist returned invalid pagination data.')
      if (cursor) seenCursors.add(cursor)
    } while (cursor)
    return items
  }

  private async get<T>(url: URL | string, workspaceId: string, candidateToken?: string): Promise<T> {
    return this.send<T>(url, 'GET', workspaceId, undefined, candidateToken)
  }

  private async send<T>(url: URL | string, method: string, workspaceId: string, body?: unknown, candidateToken?: string): Promise<T> {
    const token = candidateToken ?? await this.credentialService.readTodoistToken(workspaceId)
    if (!token) throw new TodoistApiError('Add your Todoist API token in Settings.')

    let response: Response
    try {
      response = await this.request(url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: AbortSignal.timeout(20000),
      })
    } catch {
      throw new TodoistApiError('Could not reach Todoist. Check your internet connection.')
    }

    if (response.status === 401) throw new TodoistApiError('Todoist rejected this token. Check it in Settings.', 401)
    if (response.status === 404) throw new TodoistApiError('The Todoist item could not be found.', 404)
    if (!response.ok) throw new TodoistApiError(`Todoist returned an error (${response.status}).`, response.status)
    if (response.status === 204 || response.headers.get('content-length') === '0') return undefined as T

    try {
      return await response.json() as T
    } catch {
      throw new TodoistApiError('Todoist returned an unreadable response.')
    }
  }
}
