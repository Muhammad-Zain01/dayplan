import { beforeEach, describe, expect, it, vi } from 'vitest'

const secureStorage = vi.hoisted(() => ({
  isAsyncEncryptionAvailable: vi.fn<() => Promise<boolean>>(),
  encryptStringAsync: vi.fn<(value: string) => Promise<Buffer>>(),
  decryptStringAsync: vi.fn<(value: Buffer) => Promise<{ result: string; shouldReEncrypt: boolean }>>(),
}))

vi.mock('electron', () => ({ safeStorage: secureStorage }))

import { CredentialService } from './CredentialService'

describe('CredentialService', () => {
  beforeEach(() => vi.resetAllMocks())

  it('stores only a versioned ciphertext blob and decrypts it in the main process', async () => {
    const encrypted = Buffer.from('encrypted-secret')
    const settingsRepository = {
      get: vi.fn(() => Buffer.concat([Buffer.from([1]), encrypted])),
      set: vi.fn(),
      remove: vi.fn(),
    }
    secureStorage.isAsyncEncryptionAvailable.mockResolvedValue(true)
    secureStorage.encryptStringAsync.mockResolvedValue(encrypted)
    secureStorage.decryptStringAsync.mockResolvedValue({ result: 'a-valid-long-todoist-token', shouldReEncrypt: false })
    const service = new CredentialService(settingsRepository as never)

    await service.saveTodoistToken('  a-valid-long-todoist-token  ')
    const token = await service.readTodoistToken()

    expect(settingsRepository.set).toHaveBeenCalledWith('todoist_token', Buffer.concat([Buffer.from([1]), encrypted]))
    expect(settingsRepository.set.mock.calls[0]?.[1].toString()).not.toContain('a-valid-long-todoist-token')
    expect(token).toBe('a-valid-long-todoist-token')
  })

  it('fails closed instead of saving a plaintext token when OS encryption is unavailable', async () => {
    const settingsRepository = { get: vi.fn(), set: vi.fn(), remove: vi.fn() }
    secureStorage.isAsyncEncryptionAvailable.mockResolvedValue(false)
    const service = new CredentialService(settingsRepository as never)

    await expect(service.saveTodoistToken('a-valid-long-todoist-token')).rejects.toThrow('Secure credential storage is unavailable')
    expect(settingsRepository.set).not.toHaveBeenCalled()
  })
})
