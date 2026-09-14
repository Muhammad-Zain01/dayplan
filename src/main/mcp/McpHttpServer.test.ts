import { afterEach, describe, expect, it, vi } from 'vitest'
import { request as httpRequest } from 'node:http'
import { McpServer } from '@modelcontextprotocol/server'
import { McpHttpServer } from './McpHttpServer'
import { TodoistTaskMcpTools } from './TodoistTaskMcpTools'

const modernEnvelope = {
  'io.modelcontextprotocol/protocolVersion': '2026-07-28',
  'io.modelcontextprotocol/clientCapabilities': {},
  'io.modelcontextprotocol/clientInfo': { name: 'Dayplan transport test', version: '1.0.0' },
}

function requestBody(id: number, method: string, params: Record<string, unknown> = {}): string {
  return JSON.stringify({
    jsonrpc: '2.0',
    id,
    method,
    params: { ...params, _meta: modernEnvelope },
  })
}

function protocolHeaders(method: string, extra: Record<string, string> = {}, name?: string): Record<string, string> {
  return {
    'content-type': 'application/json',
    accept: 'application/json, text/event-stream',
    'mcp-method': method,
    ...(name ? { 'mcp-name': name } : {}),
    ...extra,
  }
}

function rawPost(url: string, headers: Record<string, string>, body: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const request = httpRequest(url, { method: 'POST', headers }, (response) => {
      let responseBody = ''
      response.setEncoding('utf8')
      response.on('data', (chunk: string) => { responseBody += chunk })
      response.on('end', () => resolve({ status: response.statusCode ?? 0, body: responseBody }))
    })
    request.on('error', reject)
    request.end(body)
  })
}

describe('McpHttpServer', () => {
  let httpServer: McpHttpServer | undefined

  afterEach(async () => {
    await httpServer?.stop()
    httpServer = undefined
  })

  it('serves Streamable HTTP discovery, direct writes, and delete-only confirmation over loopback', async () => {
    let confirmDeletion = true
    const task = { id: 'task-1', content: 'Plan', description: '', project_id: null, labels: [], priority: 1, due: null }
    const taskService = {
      listTasks: vi.fn(async () => [task]),
      getTask: vi.fn(async () => task),
      listProjects: vi.fn(async () => []),
      listLabels: vi.fn(async () => []),
      createTask: vi.fn(async () => task),
      updateTask: vi.fn(async () => task),
      completeTask: vi.fn(async () => ({ completed: true as const })),
      reopenTask: vi.fn(async () => ({ reopened: true as const })),
      deleteTask: vi.fn(async () => ({ deleted: true as const, subtasks_also_deleted: true as const })),
    }
    const deleteApprovalService = {
      confirmTaskDeletion: vi.fn(async (_taskId: string) => confirmDeletion),
    }
    const tools = new TodoistTaskMcpTools(taskService as never, deleteApprovalService as never)
    httpServer = new McpHttpServer(() => {
      const server = new McpServer({ name: 'Dayplan test', version: '1.0.0' })
      tools.register(server)
      return server
    }, { port: 0 })
    await httpServer.start()

    const discovery = await fetch(httpServer.url, {
      method: 'POST',
      headers: protocolHeaders('server/discover'),
      body: requestBody(1, 'server/discover'),
    })
    const discoveryText = await discovery.text()
    expect(discovery.status, discoveryText).toBe(200)
    expect(discoveryText).toContain('2026-07-28')

    const listResponse = await fetch(httpServer.url, {
      method: 'POST',
      headers: protocolHeaders('tools/list'),
      body: requestBody(2, 'tools/list'),
    })
    expect(listResponse.status).toBe(200)
    const listPayload = await listResponse.json() as { result?: { tools?: Array<{ name: string }> } }
    expect(listPayload.result?.tools?.map(({ name }) => name)).toEqual([
      'todoist_list_tasks', 'todoist_get_task', 'todoist_list_projects', 'todoist_list_labels',
      'todoist_create_task', 'todoist_update_task', 'todoist_complete_task', 'todoist_reopen_task',
      'todoist_delete_task',
    ])

    const readResponse = await fetch(httpServer.url, {
      method: 'POST',
      headers: protocolHeaders('tools/call', {}, 'todoist_list_tasks'),
      body: requestBody(3, 'tools/call', { name: 'todoist_list_tasks', arguments: {} }),
    })
    const readText = await readResponse.text()
    expect(readResponse.status, readText).toBe(200)
    expect(readText).toContain('task-1')
    expect(taskService.listTasks).toHaveBeenCalledOnce()
    const createResponse = await fetch(httpServer.url, {
      method: 'POST',
      headers: protocolHeaders('tools/call', {}, 'todoist_create_task'),
      body: requestBody(4, 'tools/call', { name: 'todoist_create_task', arguments: { content: 'Created directly' } }),
    })
    expect(createResponse.status).toBe(200)
    expect(await createResponse.text()).toContain('task-1')
    expect(taskService.createTask).toHaveBeenCalledOnce()

    const deleteResponse = await fetch(httpServer.url, {
      method: 'POST',
      headers: protocolHeaders('tools/call', {}, 'todoist_delete_task'),
      body: requestBody(5, 'tools/call', { name: 'todoist_delete_task', arguments: { task_id: 'task-1' } }),
    })
    expect(deleteResponse.status).toBe(200)
    expect(await deleteResponse.text()).toContain('task-1')
    expect(deleteApprovalService.confirmTaskDeletion).toHaveBeenCalledWith('task-1')
    expect(taskService.deleteTask).toHaveBeenCalledOnce()

    confirmDeletion = false
    const cancelledDelete = await fetch(httpServer.url, {
      method: 'POST',
      headers: protocolHeaders('tools/call', {}, 'todoist_delete_task'),
      body: requestBody(6, 'tools/call', { name: 'todoist_delete_task', arguments: { task_id: 'task-2' } }),
    })
    expect(cancelledDelete.status).toBe(200)
    expect(await cancelledDelete.text()).toContain('cancelled task deletion')
    expect(taskService.deleteTask).toHaveBeenCalledOnce()
  })

  it('rejects untrusted Host and Origin headers and becomes unreachable after stopping', async () => {
    httpServer = new McpHttpServer(() => new McpServer({ name: 'Dayplan test', version: '1.0.0' }), { port: 0 })
    await httpServer.start()

    const invalidHost = await rawPost(httpServer.url, protocolHeaders('server/discover', { host: 'attacker.example' }), requestBody(1, 'server/discover'))
    expect(invalidHost.status).toBe(403)

    const invalidOrigin = await rawPost(httpServer.url, protocolHeaders('server/discover', { origin: 'https://attacker.example' }), requestBody(2, 'server/discover'))
    expect(invalidOrigin.status).toBe(403)

    const endpoint = httpServer.url
    await httpServer.stop()
    await expect(fetch(endpoint, { method: 'POST' })).rejects.toThrow()
  })
})
