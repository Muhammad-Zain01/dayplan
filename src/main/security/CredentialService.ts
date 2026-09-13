import type { SettingsRepository } from '../settings/SettingsRepository'

const LEGACY_ENCRYPTED_FORMATS = new Set([1, 2])

export class CredentialService {
  private cachedTodoistToken: string | null | undefined
  private pendingTodoistTokenRead: Promise<string | null> | null = null

  constructor(private readonly settingsRepository: SettingsRepository) {}

  async saveTodoistToken(token: string): Promise<void> {
    const normalizedToken = token.trim()
    if (normalizedToken.length < 20 || normalizedToken.length > 4096) {
      throw new Error('Enter a valid Todoist API token.')
    }

    this.settingsRepository.set('todoist_token', Buffer.from(normalizedToken, 'utf8'))
    this.cachedTodoistToken = normalizedToken
  }

  async readTodoistToken(): Promise<string | null> {
    if (this.cachedTodoistToken !== undefined) return this.cachedTodoistToken
    if (this.pendingTodoistTokenRead) return this.pendingTodoistTokenRead

    this.pendingTodoistTokenRead = Promise.resolve(this.readStoredTodoistToken())
    try {
      const token = await this.pendingTodoistTokenRead
      this.cachedTodoistToken = token
      return token
    } finally {
      this.pendingTodoistTokenRead = null
    }
  }

  async removeTodoistToken(): Promise<void> {
    this.settingsRepository.remove('todoist_token')
    this.cachedTodoistToken = null
  }

  isTodoistConfigured(): boolean {
    const value = this.settingsRepository.get('todoist_token')
    return value !== undefined && !this.isLegacyEncryptedValue(value)
  }

  private readStoredTodoistToken(): string | null {
    const value = this.settingsRepository.get('todoist_token')
    if (!value || this.isLegacyEncryptedValue(value)) return null
    return value.toString('utf8')
  }

  private isLegacyEncryptedValue(value: Buffer): boolean {
    // Previous builds prefixed encrypted values with a binary format marker.
    return value.length > 1 && LEGACY_ENCRYPTED_FORMATS.has(value[0] ?? -1)
  }
}
