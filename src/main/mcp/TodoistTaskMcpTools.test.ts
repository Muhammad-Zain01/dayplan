import { describe, expect, it, vi } from 'vitest'
import type { McpServer } from '@modelcontextprotocol/server'
import { TodoistTaskMcpTools } from './TodoistTaskMcpTools'

type ToolHandler = (input: unknown) => Promise<unknown>

function setup(confirmedDeletion = true) {
  const handlers = new Map<string, ToolHandler>()
  const configs = new Map<string, { inputSchema: { safeParse: (value: unknown) => { success: boolean } } }>()
  const taskService = {
    listTasks: vi.fn(async () => [{ id: 'task-1', content: 'Plan the day' }]),
    listCompletedTasks: vi.fn(async () => [{ id: 'done-1', content: 'Completed today', is_completed: true }]),
    getTask: vi.fn(async () => ({ id: 'task-1', content: 'Plan the day' })),
    listProjects: vi.fn(async () => [{ id: 'inbox', name: 'Inbox', is_inbox_project: true }]),
    listLabels: vi.fn(async () => [{ name: 'work' }]),
    createTask: vi.fn(async (input: unknown) => ({ id: 'task-2', ...input as object })),
    updateTask: vi.fn(async () => ({ id: 'task-1', content: 'Updated task' })),
    completeTask: vi.fn(async () => ({ completed: true as const })),
    reopenTask: vi.fn(async () => ({ reopened: true as const })),
    deleteTask: vi.fn(async () => ({ deleted: true as const, subtasks_also_deleted: true as const })),
  }
  const deleteApprovalService = { confirmTaskDeletion: vi.fn(async () => confirmedDeletion) }
  const server = {
    registerTool: (name: string, config: { inputSchema: { safeParse: (value: unknown) => { success: boolean } } }, handler: ToolHandler) => {
      configs.set(name, config)
      handlers.set(name, handler)
    },
  }

  new TodoistTaskMcpTools(taskService as never, deleteApprovalService as never).register(server as unknown as McpServer)
  return { handlers, configs, taskService, deleteApprovalService }
}

describe('TodoistTaskMcpTools', () => {
  it('registers the complete task tool catalog', () => {
    const { handlers } = setup()

    expect([...handlers.keys()].sort()).toEqual([
      'todoist_complete_task',
      'todoist_create_task',
      'todoist_delete_task',
      'todoist_get_task',
      'todoist_list_completed_tasks',
      'todoist_list_labels',
      'todoist_list_projects',
      'todoist_list_tasks',
      'todoist_reopen_task',
      'todoist_update_task',
    ])
  })

  it('returns structured task data for read calls', async () => {
    const { handlers, taskService } = setup()
    const result = await handlers.get('todoist_list_tasks')?.({ limit: 10 }) as { structuredContent: { tasks: unknown[] } }

    expect(result.structuredContent.tasks).toHaveLength(1)
    expect(taskService.listTasks).toHaveBeenCalledWith({ limit: 10 })
  })

  it('lists completed tasks for a validated explicit date range', async () => {
    const { handlers, configs, taskService } = setup()
    const range = { since: '2026-09-14T00:00:00Z', until: '2026-09-15T00:00:00Z' }
    const result = await handlers.get('todoist_list_completed_tasks')?.(range) as {
      structuredContent: { tasks: Array<{ id: string; is_completed: boolean }> }
    }

    expect(configs.get('todoist_list_completed_tasks')?.inputSchema.safeParse(range).success).toBe(true)
    expect(configs.get('todoist_list_completed_tasks')?.inputSchema.safeParse({
      since: '2026-09-14T00:00:00Z', until: '2026-09-15T00:00:00Z', unexpected: true,
    }).success).toBe(false)
    expect(configs.get('todoist_list_completed_tasks')?.inputSchema.safeParse({
      since: '2026-09-15T00:00:00Z', until: '2026-09-14T00:00:00Z',
    }).success).toBe(false)
    expect(configs.get('todoist_list_completed_tasks')?.inputSchema.safeParse({
      since: '2026-01-01T00:00:00Z', until: '2026-04-02T00:00:00Z',
    }).success).toBe(false)
    expect(taskService.listCompletedTasks).toHaveBeenCalledWith(range.since, range.until)
    expect(result.structuredContent.tasks).toEqual([{ id: 'done-1', content: 'Completed today', is_completed: true }])
  })

  it('executes task writes directly without asking for application approval', async () => {
    const { handlers, taskService, deleteApprovalService } = setup()
    const created = await handlers.get('todoist_create_task')?.({ content: 'Plan the day' }) as { structuredContent: unknown }
    const updated = await handlers.get('todoist_update_task')?.({ task_id: 'task-1', content: 'Revised plan' }) as { structuredContent: unknown }
    const completed = await handlers.get('todoist_complete_task')?.({ task_id: 'task-1' }) as { structuredContent: { completed: true } }
    const reopened = await handlers.get('todoist_reopen_task')?.({ task_id: 'task-1' }) as { structuredContent: { reopened: true } }

    expect(created.structuredContent).toMatchObject({ id: 'task-2', content: 'Plan the day' })
    expect(updated.structuredContent).toMatchObject({ id: 'task-1', content: 'Updated task' })
    expect(completed.structuredContent).toEqual({ completed: true })
    expect(reopened.structuredContent).toEqual({ reopened: true })
    expect(deleteApprovalService.confirmTaskDeletion).not.toHaveBeenCalled()
  })

  it('asks for confirmation only before deleting a task and its subtasks', async () => {
    const { handlers, taskService, deleteApprovalService } = setup()
    const result = await handlers.get('todoist_delete_task')?.({ task_id: 'task-1' }) as { structuredContent: { deleted: true; subtasks_also_deleted: true } }

    expect(deleteApprovalService.confirmTaskDeletion).toHaveBeenCalledWith('task-1')
    expect(taskService.deleteTask).toHaveBeenCalledWith('task-1')
    expect(result.structuredContent).toEqual({ deleted: true, subtasks_also_deleted: true })
  })

  it('does not delete when task deletion confirmation is cancelled', async () => {
    const { handlers, taskService } = setup(false)
    const result = await handlers.get('todoist_delete_task')?.({ task_id: 'task-1' }) as { isError: boolean }

    expect(result.isError).toBe(true)
    expect(taskService.deleteTask).not.toHaveBeenCalled()
  })
})
