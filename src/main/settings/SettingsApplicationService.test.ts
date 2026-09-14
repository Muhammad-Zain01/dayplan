import { describe, expect, it, vi } from 'vitest'
import { SettingsApplicationService } from './SettingsApplicationService'
import { DEFAULT_FOCUS_TIMER_PREFERENCES } from '../../shared/domain'

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

describe('SettingsApplicationService MCP HTTP preference', () => {
  it('defaults off, persists enablement, and treats invalid stored values as disabled', () => {
    let storedEnabled: Buffer | undefined
    const settingsRepository = {
      get: vi.fn(() => storedEnabled),
      set: vi.fn((_key: string, value: Buffer) => { storedEnabled = value }),
    }
    const service = new SettingsApplicationService({} as never, {} as never, settingsRepository as never)

    expect(service.isMcpHttpEnabled()).toBe(false)
    service.setMcpHttpEnabled(true)
    expect(settingsRepository.set).toHaveBeenCalledWith('mcp_http_enabled', Buffer.from('true', 'utf8'))
    expect(service.isMcpHttpEnabled()).toBe(true)

    storedEnabled = Buffer.from('yes', 'utf8')
    expect(service.isMcpHttpEnabled()).toBe(false)
  })
})

describe('SettingsApplicationService focus timer preferences', () => {
  it('defaults to 30-minute focus and five-minute break, then persists custom durations', () => {
    let storedValue: Buffer | undefined
    const settingsRepository = {
      get: vi.fn(() => storedValue),
      set: vi.fn((_key: string, value: Buffer) => { storedValue = value }),
    }
    const service = new SettingsApplicationService({} as never, {} as never, settingsRepository as never)

    expect(service.getFocusTimerPreferences()).toEqual(DEFAULT_FOCUS_TIMER_PREFERENCES)
    expect(service.setFocusTimerPreferences({ focusMinutes: 45, breakMinutes: 12 }))
      .toEqual({ focusMinutes: 45, breakMinutes: 12 })
    expect(settingsRepository.set).toHaveBeenCalledWith(
      'focus_timer_preferences',
      Buffer.from('{"focusMinutes":45,"breakMinutes":12}', 'utf8'),
    )
    expect(service.getFocusTimerPreferences()).toEqual({ focusMinutes: 45, breakMinutes: 12 })
  })

  it('falls back to defaults for invalid stored values and rejects invalid updates', () => {
    const settingsRepository = { get: vi.fn(() => Buffer.from('{bad json', 'utf8')), set: vi.fn() }
    const service = new SettingsApplicationService({} as never, {} as never, settingsRepository as never)

    expect(service.getFocusTimerPreferences()).toEqual(DEFAULT_FOCUS_TIMER_PREFERENCES)
    expect(() => service.setFocusTimerPreferences({ focusMinutes: 241, breakMinutes: 5 }))
      .toThrow('Focus duration must be 1–240 minutes and break duration must be 1–120 minutes.')
    expect(settingsRepository.set).not.toHaveBeenCalled()
  })
})
