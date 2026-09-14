import { app, dialog, Menu, MenuItem, nativeImage, Tray } from 'electron'
import type { FocusTimerSnapshot } from '../../shared/domain'
import { FocusTimerService } from './FocusTimerService'

export class FocusTrayController {
  private readonly tray: Tray
  private readonly statusItem: MenuItem
  private readonly pauseItem: MenuItem
  private readonly endItem: MenuItem
  private readonly unsubscribe: () => void

  constructor(
    iconPath: string,
    private readonly timerService: FocusTimerService,
    private readonly onOpen: () => void,
  ) {
    const icon = nativeImage.createFromPath(iconPath)
    if (icon.isEmpty()) throw new Error(`Dayplan tray icon could not be loaded: ${iconPath}`)
    if (process.platform === 'darwin') icon.setTemplateImage(true)
    this.tray = new Tray(icon)
    this.tray.setToolTip('Dayplan')

    this.statusItem = new MenuItem({ label: 'No timer running' })
    const menu = new Menu()
    menu.append(this.statusItem)
    menu.append(new MenuItem({ type: 'separator' }))
    menu.append(new MenuItem({ label: 'Start 30-minute focus', click: () => this.runAction(() => this.timerService.startFocus(30)) }))
    menu.append(new MenuItem({ label: 'Start 60-minute focus', click: () => this.runAction(() => this.timerService.startFocus(60)) }))
    menu.append(new MenuItem({ label: 'Start 5-minute break', click: () => this.runAction(() => this.timerService.startBreak()) }))
    this.pauseItem = new MenuItem({ label: 'Pause timer', click: () => this.runAction(() => {
      const snapshot = this.timerService.getSnapshot()
      if (snapshot.status === 'paused') return this.timerService.resume()
      if (snapshot.status === 'running') return this.timerService.pause()
      return snapshot
    }) })
    this.endItem = new MenuItem({ label: 'End timer', click: () => this.runAction(() => {
      const snapshot = this.timerService.getSnapshot()
      return snapshot.status === 'running' || snapshot.status === 'paused' ? this.timerService.endEarly() : snapshot
    }) })
    menu.append(this.pauseItem)
    menu.append(this.endItem)
    menu.append(new MenuItem({ type: 'separator' }))
    menu.append(new MenuItem({ label: 'Open Dayplan', click: this.onOpen }))
    menu.append(new MenuItem({ label: 'Quit Dayplan', click: () => app.quit() }))
    this.tray.setContextMenu(menu)
    this.unsubscribe = this.timerService.subscribe((snapshot) => this.update(snapshot))
  }

  destroy(): void {
    this.unsubscribe()
    this.tray.destroy()
  }

  private update(snapshot: FocusTimerSnapshot): void {
    const hasActiveSession = snapshot.status === 'running' || snapshot.status === 'paused'
    const remaining = this.formatTime(snapshot.remainingSeconds)
    const mode = snapshot.kind === 'focus' ? 'Focus' : snapshot.kind === 'break' ? 'Break' : 'Timer'
    const state = snapshot.status === 'paused' ? 'Paused' : snapshot.status === 'running' ? remaining : 'Complete'
    this.statusItem.label = hasActiveSession ? `${mode} · ${state}` : snapshot.status === 'completed' ? `${mode} complete` : 'No timer running'
    this.pauseItem.label = snapshot.status === 'paused' ? 'Resume timer' : 'Pause timer'
    this.endItem.label = snapshot.status === 'ended_early' ? 'Timer ended' : 'End timer'
    this.tray.setToolTip(hasActiveSession ? `Dayplan · ${mode} · ${state}` : 'Dayplan')
    if (process.platform === 'darwin') this.tray.setTitle(hasActiveSession ? remaining : '', { fontType: 'monospacedDigit' })
  }

  private runAction(action: () => FocusTimerSnapshot): void {
    try {
      action()
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'The timer action could not be completed.'
      dialog.showErrorBox('Dayplan Timer', message)
    }
  }

  private formatTime(seconds: number): string {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`
  }
}
