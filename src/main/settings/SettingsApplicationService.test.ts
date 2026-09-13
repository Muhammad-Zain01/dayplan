import { describe, expect, it, vi } from 'vitest'
import { SettingsApplicationService } from './SettingsApplicationService'

describe('SettingsApplicationService appearance', () => {
  it('defaults to System and persists the selected appearance locally', () => {
    let storedMode: Buffer | undefined
    const settingsRepository = {
      get: vi.fn(() => storedMode),
      set: vi.fn((_key: string, value: Buffer) => { storedMode = value }),
    }
    const service = new SettingsApplicationService({} as never, {} as never, settingsRepository as never)

    expect(service.getAppearance()).toBe('system')

    service.setAppearance('dark')

    expect(settingsRepository.set).toHaveBeenCalledWith('appearance', Buffer.from('dark', 'utf8'))
    expect(service.getAppearance()).toBe('dark')
  })

  it('falls back to System if the saved appearance value is invalid', () => {
    const settingsRepository = { get: vi.fn(() => Buffer.from('neon', 'utf8')), set: vi.fn() }
    const service = new SettingsApplicationService({} as never, {} as never, settingsRepository as never)

    expect(service.getAppearance()).toBe('system')
  })

  it('rejects unsupported appearance values before persistence', () => {
    const settingsRepository = { get: vi.fn(), set: vi.fn() }
    const service = new SettingsApplicationService({} as never, {} as never, settingsRepository as never)

    expect(() => service.setAppearance('neon' as never)).toThrow('Choose System, Light, or Dark')
    expect(settingsRepository.set).not.toHaveBeenCalled()
  })
})
