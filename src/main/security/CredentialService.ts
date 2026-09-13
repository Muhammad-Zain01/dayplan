import { safeStorage } from 'electron'
import type { SettingsRepository } from '../settings/SettingsRepository'

export class CredentialService {
  constructor(private readonly settingsRepository: SettingsRepository) {}

  async saveTodoistToken(token: string): Promise<void> {
    const normalizedToken = token.trim()
    if (normalizedToken.length < 20 || normalizedToken.length > 4096) {
      throw new Error('Enter a valid Todoist API token.')
    }
    if (!(await safeStorage.isAsyncEncryptionAvailable())) {
      throw new Error('Secure credential storage is unavailable on this device.')
    }
    const ciphertext = await safeStorage.encryptStringAsync(normalizedToken)
    this.settingsRepository.set('todoist_token', Buffer.concat([Buffer.from([1]), ciphertext]))
  }

  async readTodoistToken(): Promise<string | null> {
    const value = this.settingsRepository.get('todoist_token')
    if (!value) return null
    if (value[0] !== 1) throw new Error('The saved Todoist token uses an unknown format.')
    if (!(await safeStorage.isAsyncEncryptionAvailable())) {
      throw new Error('Secure credential storage is unavailable on this device.')
    }
    const decrypted = await safeStorage.decryptStringAsync(value.subarray(1))
    if (decrypted.shouldReEncrypt) await this.saveTodoistToken(decrypted.result)
    return decrypted.result
  }

  async removeTodoistToken(): Promise<void> {
    this.settingsRepository.remove('todoist_token')
  }

  isTodoistConfigured(): boolean {
    return this.settingsRepository.get('todoist_token') !== undefined
  }
}
