import { describe, expect, it, vi } from 'vitest'
import { CredentialService } from './CredentialService'

describe('CredentialService', () => {
  it('stores and reads the token directly from the SQLite settings value', async () => {
    let storedValue: Buffer | undefined
    const settingsRepository = {
      get: vi.fn(() => storedValue),
      set: vi.fn((_key: string, value: Buffer) => { storedValue = value }),
      remove: vi.fn(() => { storedValue = undefined }),
    }
    const service = new CredentialService(settingsRepository as never)

    await service.saveTodoistToken('  a-valid-long-todoist-token  ')

    expect(settingsRepository.set).toHaveBeenCalledWith('todoist_token', Buffer.from('a-valid-long-todoist-token', 'utf8'))
    expect(storedValue?.toString('utf8')).toBe('a-valid-long-todoist-token')
    expect(await new CredentialService(settingsRepository as never).readTodoistToken()).toBe('a-valid-long-todoist-token')
    expect(service.isTodoistConfigured()).toBe(true)
  })

  it('rejects empty or implausibly long tokens without changing settings', async () => {
    const settingsRepository = { get: vi.fn(), set: vi.fn(), remove: vi.fn() }
    const service = new CredentialService(settingsRepository as never)

    await expect(service.saveTodoistToken('  ')).rejects.toThrow('Enter a valid Todoist API token.')
    await expect(service.saveTodoistToken('x'.repeat(4097))).rejects.toThrow('Enter a valid Todoist API token.')
    expect(settingsRepository.set).not.toHaveBeenCalled()
  })

  it('shares concurrent reads and caches the token in the main process', async () => {
    const settingsRepository = {
      get: vi.fn(() => Buffer.from('a-valid-long-todoist-token', 'utf8')),
      set: vi.fn(),
      remove: vi.fn(),
    }
    const service = new CredentialService(settingsRepository as never)

    const [first, second] = await Promise.all([service.readTodoistToken(), service.readTodoistToken()])
    const third = await service.readTodoistToken()

    expect(first).toBe('a-valid-long-todoist-token')
    expect(second).toBe(first)
    expect(third).toBe(first)
    expect(settingsRepository.get).toHaveBeenCalledTimes(1)
  })

  it('treats legacy encrypted values as unconfigured', async () => {
    const settingsRepository = {
      get: vi.fn(() => Buffer.concat([Buffer.from([1]), Buffer.from('old-ciphertext')])),
      set: vi.fn(),
      remove: vi.fn(),
    }
    const service = new CredentialService(settingsRepository as never)

    expect(service.isTodoistConfigured()).toBe(false)
    await expect(service.readTodoistToken()).resolves.toBeNull()
  })

  it('replaces a legacy encrypted value with plain SQLite token bytes', async () => {
    let storedValue: Buffer<ArrayBufferLike> = Buffer.concat([Buffer.from([2]), Buffer.from('old-ciphertext')])
    const settingsRepository = {
      get: vi.fn(() => storedValue),
      set: vi.fn((_key: string, value: Buffer) => { storedValue = value }),
      remove: vi.fn(),
    }
    const service = new CredentialService(settingsRepository as never)

    await service.saveTodoistToken('a-valid-long-todoist-token')

    expect(storedValue.toString('utf8')).toBe('a-valid-long-todoist-token')
    expect(service.isTodoistConfigured()).toBe(true)
  })
})
