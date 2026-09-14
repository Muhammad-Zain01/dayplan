import type { McpHttpStatus } from '../../shared/domain'
import type { SettingsApplicationService } from '../settings/SettingsApplicationService'
import { MCP_HTTP_URL, McpHttpServer } from './McpHttpServer'
import type { McpServer } from '@modelcontextprotocol/server'

export interface McpHttpServerControl {
  readonly isRunning: boolean
  readonly url: string
  start(): Promise<void>
  stop(): Promise<void>
}

export class McpHttpService {
  private enabled = false
  private error: string | null = null
  private server: McpHttpServerControl | null = null

  constructor(
    private readonly settingsService: SettingsApplicationService,
    private readonly createMcpServer: () => McpServer,
    private readonly createHttpServer: () => McpHttpServerControl = () => new McpHttpServer(createMcpServer),
  ) {}

  async initialize(): Promise<McpHttpStatus> {
    this.enabled = this.settingsService.isMcpHttpEnabled()
    if (this.enabled) await this.start()
    return this.getStatus()
  }

  async setEnabled(enabled: boolean): Promise<McpHttpStatus> {
    if (typeof enabled !== 'boolean') throw new Error('Choose whether the local MCP server is enabled.')
    this.settingsService.setMcpHttpEnabled(enabled)
    this.enabled = enabled
    if (enabled) await this.start()
    else await this.stop()
    return this.getStatus()
  }

  getStatus(): McpHttpStatus {
    return {
      enabled: this.enabled,
      running: this.server?.isRunning ?? false,
      url: this.server?.url ?? MCP_HTTP_URL,
      error: this.error,
    }
  }

  async shutdown(): Promise<void> {
    await this.stop()
  }

  private async start(): Promise<void> {
    this.error = null
    this.server ??= this.createHttpServer()
    try {
      await this.server.start()
    } catch (error) {
      this.error = this.toActionableError(error)
    }
  }

  private async stop(): Promise<void> {
    this.error = null
    try {
      await this.server?.stop()
    } catch {
      this.error = 'The local MCP server could not stop cleanly. Restart Dayplan to clear the endpoint.'
    }
  }

  private toActionableError(error: unknown): string {
    const code = error instanceof Error && 'code' in error
      ? error.code
      : undefined
    if (code === 'EADDRINUSE') {
      return 'Port 47631 is already in use. Close the other process using it, then turn the MCP server off and on again.'
    }
    if (code === 'EACCES' || code === 'EPERM') {
      return 'Dayplan cannot open port 47631. Check local network permissions, then restart Dayplan.'
    }
    return 'Dayplan could not start the local MCP server. Restart Dayplan and try again.'
  }
}
