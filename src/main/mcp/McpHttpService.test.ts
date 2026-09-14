import { describe, expect, it, vi } from 'vitest'
import { createServer as createNodeServer } from 'node:http'
import { McpServer } from '@modelcontextprotocol/server'
import { McpHttpService } from './McpHttpService'
import { McpHttpServer } from './McpHttpServer'

function createHarness(initial = false, serverError?: Error & { code?: string }) {
  let enabled = initial
  const settings = {
    isMcpHttpEnabled: vi.fn(() => enabled),
    setMcpHttpEnabled: vi.fn((value: boolean) => { enabled = value }),
  }
  const server = {
    isRunning: false,
    url: 'http://127.0.0.1:47631/mcp',
    start: vi.fn(async () => {
      if (serverError) throw serverError
      server.isRunning = true
    }),
    stop: vi.fn(async () => { server.isRunning = false }),
  }
  const service = new McpHttpService(settings as never, () => ({}) as never, () => server)
  return { enabled: () => enabled, settings, server, service }
}

describe('McpHttpService', () => {
  it('defaults off, persists enablement, starts/stops the endpoint, and restores an enabled preference', async () => {
    const harness = createHarness()
    expect(await harness.service.initialize()).toMatchObject({ enabled: false, running: false })

    expect(await harness.service.setEnabled(true)).toMatchObject({ enabled: true, running: true, error: null })
    expect(harness.settings.setMcpHttpEnabled).toHaveBeenCalledWith(true)
    await harness.service.shutdown()
    expect(harness.service.getStatus()).toMatchObject({ enabled: true, running: false })
    expect(harness.settings.setMcpHttpEnabled).toHaveBeenLastCalledWith(true)

    const nextLaunch = createHarness(true)
    expect(await nextLaunch.service.initialize()).toMatchObject({ enabled: true, running: true })
    expect(await nextLaunch.service.setEnabled(false)).toMatchObject({ enabled: false, running: false })
    expect(nextLaunch.settings.setMcpHttpEnabled).toHaveBeenLastCalledWith(false)
  })

  it('opens a real loopback endpoint when enabled and closes it when disabled', async () => {
    let enabled = false
    const settings = {
      isMcpHttpEnabled: () => enabled,
      setMcpHttpEnabled: (value: boolean) => { enabled = value },
    }
    const service = new McpHttpService(
      settings as never,
      () => new McpServer({ name: 'Dayplan lifecycle test', version: '1.0.0' }),
      () => new McpHttpServer(() => new McpServer({ name: 'Dayplan lifecycle test', version: '1.0.0' }), { port: 0 }),
    )
    await service.initialize()
    const running = await service.setEnabled(true)
    expect(running.running).toBe(true)
    const response = await fetch(running.url)
    expect(response.status).not.toBe(0)

    await service.setEnabled(false)
    await expect(fetch(running.url)).rejects.toThrow()
  })

  it('reports a clear error when another process owns the configured port', async () => {
    const blocker = createNodeServer()
    await new Promise<void>((resolve, reject) => {
      blocker.once('error', reject)
      blocker.listen(0, '127.0.0.1', resolve)
    })
    const address = blocker.address()
    if (!address || typeof address === 'string') throw new Error('The test listener did not get a TCP port.')

    let enabled = false
    const settings = {
      isMcpHttpEnabled: () => enabled,
      setMcpHttpEnabled: (value: boolean) => { enabled = value },
    }
    const service = new McpHttpService(
      settings as never,
      () => new McpServer({ name: 'Dayplan port test', version: '1.0.0' }),
      () => new McpHttpServer(() => new McpServer({ name: 'Dayplan port test', version: '1.0.0' }), { port: address.port }),
    )
    try {
      const status = await service.setEnabled(true)
      expect(status).toMatchObject({
        enabled: true,
        running: false,
        error: expect.stringContaining('Port 47631 is already in use'),
      })
    } finally {
      await service.shutdown()
      await new Promise<void>((resolve, reject) => blocker.close((error) => error ? reject(error) : resolve()))
    }
  })

  it('keeps the GUI setting enabled and provides a useful error when the port is occupied', async () => {
    const error = Object.assign(new Error('Address in use'), { code: 'EADDRINUSE' })
    const harness = createHarness(false, error)

    expect(await harness.service.setEnabled(true)).toMatchObject({
      enabled: true,
      running: false,
      error: expect.stringContaining('Port 47631 is already in use'),
    })
    expect(harness.enabled()).toBe(true)
  })
})
