import type { WorkspaceSettingsRepository } from '../workspaces/WorkspaceSettingsRepository'

const LEGACY_ENCRYPTED_FORMATS = new Set([1, 2])

export class CredentialService {
  private readonly cachedTodoistTokens = new Map<string, string | null>()
  private readonly pendingTodoistTokenReads = new Map<string, Promise<string | null>>()

  constructor(private readonly settingsRepository: WorkspaceSettingsRepository) {}

  async saveTodoistToken(workspaceId: string, token: string): Promise<void> {
    const normalizedToken = token.trim()
    if (normalizedToken.length < 20 || normalizedToken.length > 4096) {
      throw new Error('Enter a valid Todoist API token.')
    }

    this.settingsRepository.set(workspaceId, 'todoist_token', Buffer.from(normalizedToken, 'utf8'))
    this.cachedTodoistTokens.set(workspaceId, normalizedToken)
  }

  async readTodoistToken(workspaceId: string): Promise<string | null> {
    const cached = this.cachedTodoistTokens.get(workspaceId)
    if (cached !== undefined) return cached
    const pending = this.pendingTodoistTokenReads.get(workspaceId)
    if (pending) return pending

    const pendingRead = Promise.resolve(this.readStoredTodoistToken(workspaceId))
    this.pendingTodoistTokenReads.set(workspaceId, pendingRead)
    try {
      const token = await pendingRead
      this.cachedTodoistTokens.set(workspaceId, token)
      return token
    } finally {
      this.pendingTodoistTokenReads.delete(workspaceId)
    }
  }

  async removeTodoistToken(workspaceId: string): Promise<void> {
    this.settingsRepository.remove(workspaceId, 'todoist_token')
    this.cachedTodoistTokens.set(workspaceId, null)
  }

  isTodoistConfigured(workspaceId: string): boolean {
    const value = this.settingsRepository.get(workspaceId, 'todoist_token')
    return value !== undefined && !this.isLegacyEncryptedValue(value)
  }

  private readStoredTodoistToken(workspaceId: string): string | null {
    const value = this.settingsRepository.get(workspaceId, 'todoist_token')
    if (!value || this.isLegacyEncryptedValue(value)) return null
    return value.toString('utf8')
  }

  private isLegacyEncryptedValue(value: Buffer): boolean {
    // Previous builds prefixed encrypted values with a binary format marker.
    return value.length > 1 && LEGACY_ENCRYPTED_FORMATS.has(value[0] ?? -1)
  }
}
