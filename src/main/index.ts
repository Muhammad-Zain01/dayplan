import { app, BrowserWindow, ipcMain, nativeTheme } from 'electron'
import { join } from 'node:path'
import { serveStdio } from '@modelcontextprotocol/server/stdio'
import { McpServer } from '@modelcontextprotocol/server'
import { DatabaseService } from './database/DatabaseService'
import { DatabaseMigrator } from './database/DatabaseMigrator'
import { AppServices } from './AppServices'
import { IpcController } from './ipc/IpcController'

const isMcpProcess = process.argv.includes('--mcp')
app.setName('Dayplan')
let databaseService: DatabaseService | null = null
let mainWindow: BrowserWindow | null = null

async function startApplication(): Promise<void> {
  databaseService = new DatabaseService(app.getPath('userData'))
  new DatabaseMigrator(databaseService).migrate()
  const services = new AppServices(databaseService)

  if (isMcpProcess) {
    if (process.platform === 'darwin') app.dock?.hide()
    serveStdio(() => {
      const server = new McpServer({ name: 'dayplan', version: app.getVersion() })
      services.mcpTools.register(server)
      return server
    }, {
      onerror: (error) => process.stderr.write(`Dayplan MCP transport error: ${error.message}\n`),
    })
    process.stdin.once('end', () => app.quit())
    return
  }

  const appearance = services.settingsService.getAppearance()
  const useDarkWindowBackground = appearance === 'dark' || (appearance === 'system' && nativeTheme.shouldUseDarkColors)
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 860,
    minHeight: 620,
    backgroundColor: useDarkWindowBackground ? '#151b1c' : '#f7f8fa',
    title: 'Dayplan',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  if (!app.isPackaged) {
    mainWindow.webContents.on('did-fail-load', (_event, code, description, url) => {
      process.stderr.write(`Dayplan renderer load failed (${code}): ${description} [${url}]\n`)
    })
    mainWindow.webContents.on('console-message', (details) => {
      if (details.level === 'error') process.stderr.write(`Dayplan renderer: ${details.message}\n`)
    })
    mainWindow.webContents.on('did-finish-load', () => process.stderr.write('Dayplan renderer loaded.\n'))
  }
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  mainWindow.webContents.on('will-navigate', (event) => event.preventDefault())
  new IpcController(services.taskService, services.dashboardService, services.settingsService).register(mainWindow)

  if (process.env.ELECTRON_RENDERER_URL) {
    await mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    await mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

void app.whenReady().then(startApplication).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown startup error.'
  process.stderr.write(`Dayplan startup failed: ${message}\n`)
  app.quit()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  ipcMain.removeAllListeners()
  databaseService?.close()
})
