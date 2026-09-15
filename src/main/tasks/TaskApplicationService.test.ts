import { describe, expect, it, vi } from 'vitest'
import { TaskApplicationService } from './TaskApplicationService'
import type { TaskDraft } from '../../shared/domain'

const WORKSPACE_ID = '00000000-0000-4000-8000-000000000001'

describe('TaskApplicationService', () => {
  it('trims task content and defaults optional fields in the shared service boundary', async () => {
    const client = { createTask: vi.fn(async (_workspaceId: string, draft: TaskDraft) => ({ id: 't1', ...draft })) }
    const service = new TaskApplicationService(client as never)

    const task = await service.createTask(WORKSPACE_ID, { content: '  Plan the day  ' })

    expect(client.createTask).toHaveBeenCalledWith(WORKSPACE_ID, { content: 'Plan the day' })
    expect(task.content).toBe('Plan the day')
  })

  it('rejects empty task names, unsupported priority values, and malformed due dates', async () => {
    const service = new TaskApplicationService({ createTask: vi.fn() } as never)

    await expect(service.createTask(WORKSPACE_ID, { content: '  ' })).rejects.toThrow('Task name')
    await expect(service.createTask(WORKSPACE_ID, { content: 'Task', priority: 5 })).rejects.toThrow('Priority')
    await expect(service.createTask(WORKSPACE_ID, { content: 'Task', due_date: '2026-02-31' })).rejects.toThrow('YYYY-MM-DD')
  })

  it('preserves a null due date when explicitly clearing it', async () => {
    const client = { updateTask: vi.fn(async (_workspaceId: string, _id: string, patch: { due_date?: string | null }) => ({ id: 't1', ...patch })) }
    const service = new TaskApplicationService(client as never)

    await service.updateTask(WORKSPACE_ID, 't1', { due_date: null })

    expect(client.updateTask).toHaveBeenCalledWith(WORKSPACE_ID, 't1', { due_date: null })
  })

  it('rejects an empty task patch before reaching Todoist', async () => {
    const client = { updateTask: vi.fn() }
    const service = new TaskApplicationService(client as never)

    await expect(service.updateTask(WORKSPACE_ID, 't1', {})).rejects.toThrow('at least one field')
    expect(client.updateTask).not.toHaveBeenCalled()
  })

  it('validates completed-task date ranges before querying Todoist', async () => {
    const client = { listCompletedTasks: vi.fn(async () => [{ id: 'done-1', content: 'Completed' }]) }
    const service = new TaskApplicationService(client as never)

    await service.listCompletedTasks(WORKSPACE_ID, '2026-09-14T00:00:00Z', '2026-09-15T00:00:00Z')
    expect(client.listCompletedTasks).toHaveBeenCalledWith(WORKSPACE_ID, '2026-09-14T00:00:00Z', '2026-09-15T00:00:00Z')

    await expect(service.listCompletedTasks(WORKSPACE_ID, '2026-09-15T00:00:00Z', '2026-09-14T00:00:00Z'))
      .rejects.toThrow('valid, increasing')
    await expect(service.listCompletedTasks(WORKSPACE_ID, '2026-02-30T00:00:00Z', '2026-03-01T00:00:00Z'))
      .rejects.toThrow('valid, increasing')
    await expect(service.listCompletedTasks(WORKSPACE_ID, '2026-01-01T00:00:00Z', '2026-04-02T00:00:00Z'))
      .rejects.toThrow('three calendar months')
    expect(client.listCompletedTasks).toHaveBeenCalledOnce()
  })
})
