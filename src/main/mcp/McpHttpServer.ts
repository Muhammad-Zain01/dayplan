import { createServer, type Server } from 'node:http'
import { createMcpHandler, type McpHttpHandler, type McpServer } from '@modelcontextprotocol/server'
import { hostHeaderValidation, originValidation, toNodeHandler } from '@modelcontextprotocol/node'

export const MCP_HTTP_HOST = '127.0.0.1'
export const MCP_HTTP_PORT = 47631
export const MCP_HTTP_PATH = '/mcp'
export const MCP_HTTP_URL = `http://${MCP_HTTP_HOST}:${MCP_HTTP_PORT}${MCP_HTTP_PATH}`

export interface McpHttpServerOptions {
  host?: string
  port?: number
  path?: string
  onerror?: (error: Error) => void
}

export class McpHttpServer {
  private server: Server | null = null
  private handler: McpHttpHandler | null = null
  private endpointUrl = MCP_HTTP_URL

  constructor(
    private readonly createMcpServer: () => McpServer,
    private readonly options: McpHttpServerOptions = {},
  ) {}

  get url(): string {
    return this.endpointUrl
  }

  get isRunning(): boolean {
    return this.server?.listening ?? false
  }

  async start(): Promise<void> {
    if (this.isRunning) return

    const host = this.options.host ?? MCP_HTTP_HOST
    const port = this.options.port ?? MCP_HTTP_PORT
    const path = this.options.path ?? MCP_HTTP_PATH
    const onerror = this.options.onerror ?? (() => undefined)
    const handler = createMcpHandler(this.createMcpServer, { legacy: 'stateless', onerror })
    const nodeHandler = toNodeHandler(handler, { onerror })
    const validateHost = hostHeaderValidation([host])
    const validateOrigin = originValidation([host])
    const server = createServer((request, response) => {
      if (!validateHost(request, response) || !validateOrigin(request, response)) return

      let requestPath: string
      try {
        requestPath = new URL(request.url ?? '/', `http://${host}`).pathname
      } catch {
        response.writeHead(400).end()
        return
      }
      if (requestPath !== path) {
        response.writeHead(404).end()
        return
      }

      const adapterRequest = {
        method: request.method ?? '',
        ...(request.url !== undefined ? { url: request.url } : {}),
        headers: request.headers,
        [Symbol.asyncIterator]: () => request[Symbol.asyncIterator](),
      }
      void nodeHandler(adapterRequest, response).catch(() => {
        onerror(new Error('The MCP HTTP request could not be handled.'))
        if (!response.headersSent) response.writeHead(500, { 'Content-Type': 'text/plain' }).end('MCP request failed.')
        else response.destroy()
      })
    })
    server.requestTimeout = 30_000
    server.headersTimeout = 10_000
    server.maxHeadersCount = 100

    try {
      await this.listen(server, host, port)
    } catch (error) {
      await handler.close()
      throw error
    }

    const address = server.address()
    const boundPort = address && typeof address !== 'string' ? address.port : port
    this.endpointUrl = `http://${host}:${boundPort}${path}`
    this.handler = handler
    this.server = server
  }

  async stop(): Promise<void> {
    const handler = this.handler
    const server = this.server
    this.handler = null
    this.server = null
    this.endpointUrl = MCP_HTTP_URL
    const serverClosed = server?.listening
      ? new Promise<void>((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve())
      })
      : Promise.resolve()

    try {
      await handler?.close()
    } finally {
      await serverClosed
    }
  }

  private listen(server: Server, host: string, port: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const onError = (error: Error): void => {
        server.off('listening', onListening)
        reject(error)
      }
      const onListening = (): void => {
        server.off('error', onError)
        resolve()
      }
      server.once('error', onError)
      server.once('listening', onListening)
      server.listen(port, host)
    })
  }
}
