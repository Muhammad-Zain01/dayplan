import type { CredentialService } from '../security/CredentialService'
import type { TodoistApiClient } from '../integrations/todoist/TodoistApiClient'
import type { AppearanceMode } from '../../shared/domain'
import type { SettingsRepository } from './SettingsRepository'

export class SettingsApplicationService {
  constructor(
    private readonly credentialService: CredentialService,
    private readonly todoistApiClient: TodoistApiClient,
    private readonly settingsRepository: SettingsRepository,
  ) {}

  getAppearance(): AppearanceMode {
    const storedMode = this.settingsRepository.get('appearance')?.toString('utf8')
    if (storedMode === 'light' || storedMode === 'dark') return storedMode
    return 'system'
  }

  setAppearance(mode: AppearanceMode): void {
    if (mode !== 'system' && mode !== 'light' && mode !== 'dark') {
      throw new Error('Choose System, Light, or Dark appearance.')
    }
    this.settingsRepository.set('appearance', Buffer.from(mode, 'utf8'))
  }

  getTodoistStatus(): { configured: boolean } {
    return { configured: this.credentialService.isTodoistConfigured() }
  }

  saveTodoistToken(token: string): Promise<void> {
    return this.credentialService.saveTodoistToken(token)
  }

  removeTodoistToken(): Promise<void> {
    return this.credentialService.removeTodoistToken()
  }

  async testTodoistConnection(): Promise<{ connected: true }> {
    await this.todoistApiClient.testConnection()
    return { connected: true }
  }
}
