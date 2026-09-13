import { describe, expect, it, vi } from 'vitest'
import type { McpServer } from '@modelcontextprotocol/server'
import { TodoistTaskMcpTools } from './TodoistTaskMcpTools'

type ToolHandler = (input: unknown) => Promise<unknown>

function setup(approved = true) {
  const handlers = new Map<string, ToolHandler>()
  const taskService = {
    listTasks: vi.fn(async () => [{ id: 'task-1', content: 'Plan the day' }]),
    getTask: vi.fn(async () => ({ id: 'task-1', content: 'Plan the day' })),
    listProjects: vi.fn(async () => [{ id: 'inbox', name: 'Inbox', is_inbox_project: true }]),
    listLabels: vi.fn(async () => [{ name: 'work' }]),
    createTask: vi.fn(async (input: unknown) => ({ id: 'task-2', ...input as object })),
    updateTask: vi.fn(async () => ({ id: 'task-1', content: 'Updated task' })),
    completeTask: vi.fn(async () => ({ completed: true as const })),
    reopenTask: vi.fn(async () => ({ reopened: true as const })),
    deleteTask: vi.fn(async () => ({ deleted: true as const, subtasks_also_deleted: true as const })),
  }
  const approvalService = { requestApproval: vi.fn(async () => approved) }
  const server = {
    registerTool: (name: string, _config: unknown, handler: ToolHandler) => handlers.set(name, handler),
  }

  new TodoistTaskMcpTools(taskService as never, approvalService as never).register(server as unknown as McpServer)
  return { handlers, taskService, approvalService }
}

describe('TodoistTaskMcpTools', () => {
  it('registers the complete task tool catalog', () => {
    const { handlers } = setup()

    expect([...handlers.keys()].sort()).toEqual([
      'todoist_complete_task',
      'todoist_create_task',
      'todoist_delete_task',
      'todoist_get_task',
      'todoist_list_labels',
      'todoist_list_projects',
      'todoist_list_tasks',
      'todoist_reopen_task',
      'todoist_update_task',
    ])
  })

  it('keeps read calls approval-free and returns structured task data', async () => {
    const { handlers, taskService, approvalService } = setup()
    const result = await handlers.get('todoist_list_tasks')?.({ limit: 10 }) as { structuredContent: { tasks: unknown[] } }

    expect(result.structuredContent.tasks).toHaveLength(1)
    expect(taskService.listTasks).toHaveBeenCalledWith({ limit: 10 })
    expect(approvalService.requestApproval).not.toHaveBeenCalled()
  })

  it('requires approval before executing a write and blocks denied actions', async () => {
    const { handlers, taskService, approvalService } = setup(false)
    const result = await handlers.get('todoist_create_task')?.({ content: 'Plan the day' }) as { isError: boolean }

    expect(result.isError).toBe(true)
    expect(approvalService.requestApproval).toHaveBeenCalledWith('todoist_create_task', { content: 'Plan the day' })
    expect(taskService.createTask).not.toHaveBeenCalled()
  })

  it('executes an approved write and returns its structured result', async () => {
    const { handlers, taskService, approvalService } = setup(true)
    const result = await handlers.get('todoist_complete_task')?.({ task_id: 'task-1' }) as { structuredContent: { completed: true } }

    expect(approvalService.requestApproval).toHaveBeenCalledWith('todoist_complete_task', { task_id: 'task-1' })
    expect(taskService.completeTask).toHaveBeenCalledWith('task-1')
    expect(result.structuredContent).toEqual({ completed: true })
  })
})
