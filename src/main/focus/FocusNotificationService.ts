import { Notification } from 'electron'
import type { FocusSessionKind } from '../../shared/domain'
import type { FocusCompletionNotifier } from './FocusTimerService'

export class FocusNotificationService implements FocusCompletionNotifier {
  private readonly activeNotifications = new Set<Notification>()

  constructor(private readonly onClick: () => void) {}

  notifyCompletion(kind: FocusSessionKind): void {
    if (!Notification.isSupported()) return
    const isFocus = kind === 'focus'
    const notification = this.createAudibleNotification(
      isFocus ? 'Focus session complete' : 'Break is over',
      isFocus ? 'You completed your focus block. Take a short break when you are ready.' : 'Your break is complete. Ready to focus again?',
    )
    this.activeNotifications.add(notification)
    notification.once('click', this.onClick)
    notification.once('close', () => this.activeNotifications.delete(notification))
    notification.show()
  }

  testNotification(): Promise<{ shown: true }> {
    if (!Notification.isSupported()) {
      return Promise.reject(new Error('Desktop notifications are not supported on this system.'))
    }

    const notification = this.createAudibleNotification(
      'Dayplan test notification',
      'Notifications are working. Focus and break alerts will appear here.',
    )
    this.activeNotifications.add(notification)

    return new Promise((resolve, reject) => {
      let settled = false
      const timeout = setTimeout(() => {
        finish(new Error(process.platform === 'darwin'
          ? 'macOS did not confirm the notification. Check Dayplan’s notification permission; native notifications also require a code-signed build.'
          : 'The operating system did not confirm the notification. Check this app’s notification permissions.'))
        notification.close()
      }, 5000)
      const onShow = (): void => finish()
      const onFailed = (_event: Electron.Event, error: string): void => {
        finish(new Error(process.platform === 'darwin'
          ? `macOS rejected the notification. Check Dayplan’s notification permission and use a code-signed build. ${error}`
          : error))
        notification.close()
      }
      const onClose = (): void => { this.activeNotifications.delete(notification) }
      const finish = (error?: Error): void => {
        if (settled) return
        settled = true
        clearTimeout(timeout)
        notification.removeListener('show', onShow)
        notification.removeListener('failed', onFailed)
        if (error) reject(error)
        else resolve({ shown: true })
      }

      notification.once('close', onClose)
      notification.once('show', onShow)
      notification.once('failed', onFailed)
      try {
        notification.show()
      } catch (error) {
        finish(error instanceof Error ? error : new Error('The notification could not be shown.'))
      }
    })
  }

  private createAudibleNotification(title: string, body: string): Notification {
    const options: Electron.NotificationConstructorOptions = { title, body, silent: false }
    if (process.platform === 'darwin') options.sound = 'Glass'
    return new Notification(options)
  }
}
