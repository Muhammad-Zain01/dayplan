import type { CredentialService } from '../security/CredentialService'
import type { TodoistApiClient } from '../integrations/todoist/TodoistApiClient'
import { DEFAULT_FOCUS_TIMER_PREFERENCES, FOCUS_TIMER_DURATION_LIMITS, type AppearanceMode, type FocusTimerPreferences } from '../../shared/domain'
import type { SettingsRepository } from './SettingsRepository'
import type { WorkspaceSettingsRepository } from '../workspaces/WorkspaceSettingsRepository'

export class SettingsApplicationService {
  constructor(
    private readonly credentialService: CredentialService,
    private readonly todoistApiClient: TodoistApiClient,
    private readonly settingsRepository: SettingsRepository,
    private readonly workspaceSettingsRepository: WorkspaceSettingsRepository,
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

  isMcpHttpEnabled(): boolean {
    return this.settingsRepository.get('mcp_http_enabled')?.toString('utf8') === 'true'
  }

  setMcpHttpEnabled(enabled: boolean): void {
    if (typeof enabled !== 'boolean') throw new Error('Choose whether the local MCP server is enabled.')
    this.settingsRepository.set('mcp_http_enabled', Buffer.from(String(enabled), 'utf8'))
  }

  getFocusTimerPreferences(workspaceId: string): FocusTimerPreferences {
    const storedValue = this.workspaceSettingsRepository.get(workspaceId, 'focus_timer_preferences')?.toString('utf8')
    if (!storedValue) return { ...DEFAULT_FOCUS_TIMER_PREFERENCES }
    try {
      const parsed: unknown = JSON.parse(storedValue)
      return this.isValidFocusTimerPreferences(parsed) ? parsed : { ...DEFAULT_FOCUS_TIMER_PREFERENCES }
    } catch {
      return { ...DEFAULT_FOCUS_TIMER_PREFERENCES }
    }
  }

  setFocusTimerPreferences(workspaceId: string, preferences: FocusTimerPreferences): FocusTimerPreferences {
    if (!this.isValidFocusTimerPreferences(preferences)) {
      throw new Error('Focus duration must be 1–240 minutes and break duration must be 1–120 minutes.')
    }
    this.workspaceSettingsRepository.set(workspaceId, 'focus_timer_preferences', Buffer.from(JSON.stringify(preferences), 'utf8'))
    return { ...preferences }
  }

  private isValidFocusTimerPreferences(value: unknown): value is FocusTimerPreferences {
    if (!value || typeof value !== 'object') return false
    const preferences = value as Partial<FocusTimerPreferences>
    return typeof preferences.focusMinutes === 'number'
      && Number.isInteger(preferences.focusMinutes)
      && preferences.focusMinutes >= FOCUS_TIMER_DURATION_LIMITS.focus.min
      && preferences.focusMinutes <= FOCUS_TIMER_DURATION_LIMITS.focus.max
      && typeof preferences.breakMinutes === 'number'
      && Number.isInteger(preferences.breakMinutes)
      && preferences.breakMinutes >= FOCUS_TIMER_DURATION_LIMITS.break.min
      && preferences.breakMinutes <= FOCUS_TIMER_DURATION_LIMITS.break.max
  }

  getTodoistStatus(workspaceId: string): { configured: boolean } {
    return { configured: this.credentialService.isTodoistConfigured(workspaceId) }
  }

  saveTodoistToken(workspaceId: string, token: string): Promise<void> {
    return this.credentialService.saveTodoistToken(workspaceId, token)
  }

  removeTodoistToken(workspaceId: string): Promise<void> {
    return this.credentialService.removeTodoistToken(workspaceId)
  }

  async testTodoistConnection(workspaceId: string, candidateToken?: string): Promise<{ connected: true }> {
    await this.todoistApiClient.testConnection(workspaceId, candidateToken)
    return { connected: true }
  }
}
