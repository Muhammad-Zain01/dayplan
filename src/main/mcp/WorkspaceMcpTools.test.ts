import { describe, expect, it, vi } from 'vitest'
import type { McpServer } from '@modelcontextprotocol/server'
import { WorkspaceMcpTools } from './WorkspaceMcpTools'

describe('WorkspaceMcpTools', () => {
  it('lists active workspace identifiers and configured status without exposing credential values', async () => {
    const handler = vi.fn(() => [{ id: 'workspace-1', name: 'Studio', todoistConfigured: true }])
    let registeredHandler: (() => Promise<unknown>) | undefined
    let schema: { safeParse: (value: unknown) => { success: boolean } } | undefined
    const server = {
      registerTool: (_name: string, config: { inputSchema: typeof schema }, toolHandler: () => Promise<unknown>) => {
        schema = config.inputSchema
        registeredHandler = toolHandler
      },
    }

    new WorkspaceMcpTools({ listWorkspaces: handler } as never).register(server as unknown as McpServer)
    const result = await registeredHandler?.() as { structuredContent: { workspaces: Array<Record<string, unknown>> } }

    expect(schema?.safeParse({}).success).toBe(true)
    expect(schema?.safeParse({ include_archived: true }).success).toBe(false)
    expect(handler).toHaveBeenCalledWith()
    expect(result.structuredContent.workspaces).toEqual([{ id: 'workspace-1', name: 'Studio', todoistConfigured: true }])
    expect(JSON.stringify(result)).not.toContain('token')
  })
})
