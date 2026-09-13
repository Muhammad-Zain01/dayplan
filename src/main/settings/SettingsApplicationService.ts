import type { CredentialService } from '../security/CredentialService'
import type { TodoistApiClient } from '../integrations/todoist/TodoistApiClient'

export class SettingsApplicationService {
  constructor(
    private readonly credentialService: CredentialService,
    private readonly todoistApiClient: TodoistApiClient,
  ) {}

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
