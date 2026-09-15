import { app, BrowserWindow, ipcMain, nativeTheme, powerMonitor } from 'electron'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { serveStdio } from '@modelcontextprotocol/server/stdio'
import { McpServer } from '@modelcontextprotocol/server'
import { DatabaseService } from './database/DatabaseService'
import { DatabaseMigrator } from './database/DatabaseMigrator'
import { AppServices } from './AppServices'
import { IpcController } from './ipc/IpcController'
import { McpHttpService } from './mcp/McpHttpService'
import { FocusNotificationService } from './focus/FocusNotificationService'
import { FocusTimerService } from './focus/FocusTimerService'
import { FocusTrayController } from './focus/FocusTrayController'
import { FocusTimerMcpTools } from './mcp/FocusTimerMcpTools'

const isMcpProcess = process.argv.includes('--mcp')
const hasApplicationLock = isMcpProcess || app.requestSingleInstanceLock()
if (!hasApplicationLock) app.quit()
// Keep the existing application-data directory so local settings and tasks remain in place.
app.setName('DayPlan')
// Preserve existing settings and credentials when the displayed product name changes.
const userDataPath = join(app.getPath('appData'), 'DayPlan')
mkdirSync(userDataPath, { recursive: true })
app.setPath('userData', userDataPath)
let databaseService: DatabaseService | null = null
let mainWindow: BrowserWindow | null = null
let mcpHttpService: McpHttpService | null = null
let focusTimerService: FocusTimerService | null = null
let focusTrayController: FocusTrayController | null = null
let isQuitting = false
let quitCleanupStarted = false
let quitCleanupComplete = false

if (!isMcpProcess) {
  app.on('second-instance', () => {
    mainWindow?.show()
    mainWindow?.focus()
  })
}

function createMcpServer(services: AppServices): McpServer {
  const server = new McpServer({ name: 'Dayplan', version: app.getVersion() })
  services.mcpTools.register(server)
  services.workspaceMcpTools.register(server)
  if (focusTimerService) {
    new FocusTimerMcpTools(focusTimerService, services.focusDashboardService, services.workspaceService).register(server)
  }
  return server
}

async function startApplication(): Promise<void> {
  databaseService = new DatabaseService(app.getPath('userData'))
  new DatabaseMigrator(databaseService).migrate()
  const services = new AppServices(databaseService)
  const focusNotifier = new FocusNotificationService(() => {
    mainWindow?.show()
    mainWindow?.focus()
  }, (workspaceId) => services.workspaceService.getWorkspace(workspaceId).name)
  focusTimerService = new FocusTimerService(services.focusSessionRepository, focusNotifier)
  powerMonitor.on('suspend', () => focusTimerService?.handleSystemSuspend())
  const createServer = (): McpServer => createMcpServer(services)

  if (isMcpProcess) {
    if (process.platform === 'darwin') app.dock?.hide()
    serveStdio(createServer, {
      onerror: (error) => process.stderr.write(`Dayplan MCP transport error: ${error.message}\n`),
    })
    process.stdin.once('end', () => app.quit())
    return
  }

  mcpHttpService = new McpHttpService(services.settingsService, createServer)
  await mcpHttpService.initialize()

  const trayIconPath = app.isPackaged
    ? join(process.resourcesPath, process.platform === 'darwin' ? 'dayplan-trayTemplate.png' : 'dayplan-tray.ico')
    : join(app.getAppPath(), 'assets/branding', process.platform === 'darwin' ? 'dayplan-trayTemplate.png' : 'dayplan-tray.ico')
  focusTrayController = new FocusTrayController(trayIconPath, focusTimerService, services.workspaceService, () => {
    mainWindow?.show()
    mainWindow?.focus()
  })

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
  new IpcController(
    services.taskService,
    services.dashboardService,
    services.settingsService,
    mcpHttpService,
    focusTimerService,
    services.focusDashboardService,
    focusNotifier,
    services.workspaceService,
  ).register(mainWindow)
  mainWindow.on('close', (event) => {
    if (isQuitting) return
    event.preventDefault()
    mainWindow?.hide()
  })
  if (process.env.ELECTRON_RENDERER_URL) {
    await mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    await mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

void app.whenReady().then(async () => {
  if (hasApplicationLock) await startApplication()
}).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown startup error.'
  process.stderr.write(`Dayplan startup failed: ${message}\n`)
  app.quit()
})

app.on('window-all-closed', () => undefined)

app.on('activate', () => {
  mainWindow?.show()
  mainWindow?.focus()
})

app.on('before-quit', (event) => {
  if (quitCleanupComplete) {
    ipcMain.removeAllListeners()
    databaseService?.close()
    return
  }
  event.preventDefault()
  if (quitCleanupStarted) return
  quitCleanupStarted = true
  isQuitting = true
  if (isMcpProcess) focusTimerService?.dispose()
  else focusTimerService?.shutdown()
  focusTrayController?.destroy()
  focusTrayController = null
  void (async () => {
    try {
      await mcpHttpService?.shutdown()
    } catch {
      process.stderr.write('Dayplan could not stop the MCP HTTP server cleanly.\n')
    } finally {
      ipcMain.removeAllListeners()
      databaseService?.close()
      quitCleanupComplete = true
      app.quit()
    }
  })()
})
