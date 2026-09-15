import { describe, expect, it, vi } from 'vitest'
import { CredentialService } from './CredentialService'

const WORKSPACE_ID = '00000000-0000-4000-8000-000000000001'

describe('CredentialService', () => {
  it('stores and reads the token directly from the workspace settings value', async () => {
    let storedValue: Buffer | undefined
    const settingsRepository = {
      get: vi.fn(() => storedValue),
      set: vi.fn((_workspaceId: string, _key: string, value: Buffer) => { storedValue = value }),
      remove: vi.fn(() => { storedValue = undefined }),
    }
    const service = new CredentialService(settingsRepository as never)

    await service.saveTodoistToken(WORKSPACE_ID, '  a-valid-long-todoist-token  ')

    expect(settingsRepository.set).toHaveBeenCalledWith(WORKSPACE_ID, 'todoist_token', Buffer.from('a-valid-long-todoist-token', 'utf8'))
    expect(storedValue?.toString('utf8')).toBe('a-valid-long-todoist-token')
    expect(await new CredentialService(settingsRepository as never).readTodoistToken(WORKSPACE_ID)).toBe('a-valid-long-todoist-token')
    expect(service.isTodoistConfigured(WORKSPACE_ID)).toBe(true)
  })

  it('keeps workspace credentials independent', async () => {
    const values = new Map<string, Buffer>()
    const settingsRepository = {
      get: vi.fn((workspaceId: string) => values.get(workspaceId)),
      set: vi.fn((workspaceId: string, _key: string, value: Buffer) => { values.set(workspaceId, value) }),
      remove: vi.fn((workspaceId: string) => { values.delete(workspaceId) }),
    }
    const service = new CredentialService(settingsRepository as never)
    const secondWorkspace = '00000000-0000-4000-8000-000000000002'
    await service.saveTodoistToken(WORKSPACE_ID, 'workspace-one-valid-todoist-token')
    await service.saveTodoistToken(secondWorkspace, 'workspace-two-valid-todoist-token')
    await service.removeTodoistToken(WORKSPACE_ID)

    expect(await service.readTodoistToken(WORKSPACE_ID)).toBeNull()
    expect(await service.readTodoistToken(secondWorkspace)).toBe('workspace-two-valid-todoist-token')
  })

  it('rejects empty or implausibly long tokens without changing settings', async () => {
    const settingsRepository = { get: vi.fn(), set: vi.fn(), remove: vi.fn() }
    const service = new CredentialService(settingsRepository as never)

    await expect(service.saveTodoistToken(WORKSPACE_ID, '  ')).rejects.toThrow('Enter a valid Todoist API token.')
    await expect(service.saveTodoistToken(WORKSPACE_ID, 'x'.repeat(4097))).rejects.toThrow('Enter a valid Todoist API token.')
    expect(settingsRepository.set).not.toHaveBeenCalled()
  })

  it('shares concurrent reads and caches the token in the main process', async () => {
    const settingsRepository = {
      get: vi.fn(() => Buffer.from('a-valid-long-todoist-token', 'utf8')),
      set: vi.fn(),
      remove: vi.fn(),
    }
    const service = new CredentialService(settingsRepository as never)

    const [first, second] = await Promise.all([service.readTodoistToken(WORKSPACE_ID), service.readTodoistToken(WORKSPACE_ID)])
    const third = await service.readTodoistToken(WORKSPACE_ID)

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

    expect(service.isTodoistConfigured(WORKSPACE_ID)).toBe(false)
    await expect(service.readTodoistToken(WORKSPACE_ID)).resolves.toBeNull()
  })

  it('replaces a legacy encrypted value with plain SQLite token bytes', async () => {
    let storedValue: Buffer<ArrayBufferLike> = Buffer.concat([Buffer.from([2]), Buffer.from('old-ciphertext')])
    const settingsRepository = {
      get: vi.fn(() => storedValue),
      set: vi.fn((_workspaceId: string, _key: string, value: Buffer) => { storedValue = value }),
      remove: vi.fn(),
    }
    const service = new CredentialService(settingsRepository as never)

    await service.saveTodoistToken(WORKSPACE_ID, 'a-valid-long-todoist-token')

    expect(storedValue.toString('utf8')).toBe('a-valid-long-todoist-token')
    expect(service.isTodoistConfigured(WORKSPACE_ID)).toBe(true)
  })
})
