import { describe, expect, it, vi } from 'vitest'
import { TodoistApiClient } from './TodoistApiClient'

function credentialService(token: string | null) {
  return { readTodoistToken: vi.fn(async () => token) }
}

describe('TodoistApiClient', () => {
  it('uses bearer authentication and follows Todoist task cursors up to the requested cap', async () => {
    const credentials = credentialService('secret-test-token')
    const request = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ results: [{ id: 'one' }], next_cursor: 'next' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ results: [{ id: 'two' }], next_cursor: null }), { status: 200 }))
    const client = new TodoistApiClient(credentials as never, request)

    const result = await client.listTasks({ limit: 2, project_id: 'project/1' })

    expect(result.map((task) => task.id)).toEqual(['one', 'two'])
    expect(request).toHaveBeenCalledTimes(2)
    expect(request.mock.calls[0]?.[0].toString()).toContain('project_id=project%2F1')
    expect(request.mock.calls[1]?.[0].toString()).toContain('cursor=next')
    expect(new Headers(request.mock.calls[0]?.[1]?.headers).get('Authorization')).toBe('Bearer secret-test-token')
  })

  it('reads completed-task history from Todoist items pages and follows its cursor', async () => {
    const request = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ items: [{ id: 'done-1' }], next_cursor: 'next' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ items: [{ id: 'done-2' }], next_cursor: null }), { status: 200 }))
    const client = new TodoistApiClient(credentialService('token') as never, request)

    const result = await client.listCompletedTasks('2026-09-07T00:00:00Z', '2026-09-14T00:00:00Z')

    expect(result.map((task) => task.id)).toEqual(['done-1', 'done-2'])
    expect(request).toHaveBeenCalledTimes(2)
    expect(request.mock.calls[0]?.[0].toString()).toContain('/tasks/completed/by_completion_date')
    expect(request.mock.calls[1]?.[0].toString()).toContain('cursor=next')
  })

  it('does not send a request when credentials are missing', async () => {
    const request = vi.fn<typeof fetch>()
    const client = new TodoistApiClient(credentialService(null) as never, request)

    await expect(client.listTasks()).rejects.toThrow('Add your Todoist API token in Settings')
    expect(request).not.toHaveBeenCalled()
  })

  it('sends explicit due-date clearing in task updates', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response(JSON.stringify({ id: 't1' }), { status: 200 }))
    const client = new TodoistApiClient(credentialService('token') as never, request)

    await client.updateTask('t1', { due_date: null })

    expect(JSON.parse(String(request.mock.calls[0]?.[1]?.body))).toEqual({ due_date: null })
  })

  it('returns a safe authentication error without exposing request details', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response('', { status: 401 }))
    const client = new TodoistApiClient(credentialService('private-token') as never, request)

    await expect(client.listTasks()).rejects.toThrow('Todoist rejected this token')
    await expect(client.listTasks()).rejects.not.toThrow('private-token')
  })
})
