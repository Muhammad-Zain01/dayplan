import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { FocusSessionKind } from '../../shared/domain'
import { DatabaseService } from '../database/DatabaseService'
import { DatabaseMigrator } from '../database/DatabaseMigrator'
import { FocusSessionRepository } from './FocusSessionRepository'
import { FocusTimerService } from './FocusTimerService'

describe('FocusTimerService', () => {
  let directory: string | null = null
  let database: DatabaseService | null = null
  let timer: FocusTimerService | null = null

  afterEach(() => {
    timer?.shutdown()
    timer = null
    database?.close()
    database = null
    if (directory) rmSync(directory, { recursive: true, force: true })
    directory = null
  })

  it('counts active time, preserves pause/resume, and records early ending', () => {
    let now = new Date(2026, 5, 4, 9, 0, 0)
    timer = createTimer(() => now)

    expect(timer.startFocus(30).targetSeconds).toBe(1_800)
    now = new Date(now.getTime() + 3 * 60_000)
    const paused = timer.pause()
    expect(paused.status).toBe('paused')
    expect(paused.elapsedSeconds).toBe(180)

    now = new Date(now.getTime() + 20 * 60_000)
    timer.resume()
    now = new Date(now.getTime() + 5 * 60_000)
    const ended = timer.endEarly()
    expect(ended.status).toBe('ended_early')
    expect(ended.elapsedSeconds).toBe(480)
  })

  it('notifies once when a focus countdown reaches its deadline', () => {
    let now = new Date(2026, 5, 4, 9, 0, 0)
    const notifications: FocusSessionKind[] = []
    timer = createTimer(() => now, (kind) => notifications.push(kind))
    timer.startFocus(30)

    now = new Date(now.getTime() + 30 * 60_000)
    const completed = timer.getSnapshot()
    timer.getSnapshot()

    expect(completed.status).toBe('completed')
    expect(completed.remainingSeconds).toBe(0)
    expect(notifications).toEqual(['focus'])
  })

  it('notifies when a break countdown reaches its deadline', () => {
    let now = new Date(2026, 5, 4, 9, 0, 0)
    const notifications: FocusSessionKind[] = []
    timer = createTimer(() => now, (kind) => notifications.push(kind))
    timer.startBreak(1)

    now = new Date(now.getTime() + 60_000)
    const completed = timer.getSnapshot()
    timer.getSnapshot()

    expect(completed.status).toBe('completed')
    expect(notifications).toEqual(['break'])
  })

  it('observes a timer started by another local Dayplan process through the shared database', () => {
    let now = new Date(2026, 5, 4, 9, 0, 0)
    timer = createTimer(() => now)
    const secondDatabase = new DatabaseService(directory as string)
    const secondProcess = new FocusTimerService(
      new FocusSessionRepository(secondDatabase.database),
      { notifyCompletion: () => undefined },
      () => now,
    )
    try {
      secondProcess.startFocus(30)
      expect(timer.getSnapshot()).toMatchObject({ status: 'running', targetSeconds: 1800 })
    } finally {
      secondProcess.dispose()
      secondDatabase.close()
    }
  })

  it('rejects unsupported focus durations', () => {
    timer = createTimer(() => new Date(2026, 5, 4, 9, 0, 0))
    expect(() => timer?.startFocus(0)).toThrow('Focus duration must be between 1 and 240 minutes.')
    expect(() => timer?.startFocus(241)).toThrow('Focus duration must be between 1 and 240 minutes.')
    expect(() => timer?.startBreak(121)).toThrow('Break duration must be between 1 and 120 minutes.')
  })

  it('starts custom focus and break lengths and adjusts the remaining time while active', () => {
    let now = new Date(2026, 5, 4, 9, 0, 0)
    timer = createTimer(() => now)

    expect(timer.startFocus(45).targetSeconds).toBe(45 * 60)
    now = new Date(now.getTime() + 2 * 60_000)
    const adjusted = timer.setRemainingMinutes(7)
    expect(adjusted).toMatchObject({ status: 'running', targetSeconds: 9 * 60, elapsedSeconds: 120, remainingSeconds: 7 * 60 })
    timer.endEarly()

    const breakTimer = timer.startBreak(17)
    expect(breakTimer).toMatchObject({ kind: 'break', targetSeconds: 17 * 60, remainingSeconds: 17 * 60 })
  })

  function createTimer(clock: () => Date, onComplete: (kind: FocusSessionKind) => void = () => undefined): FocusTimerService {
    directory = mkdtempSync(join(tmpdir(), 'dayplan-focus-timer-test-'))
    database = new DatabaseService(directory)
    new DatabaseMigrator(database).migrate()
    const repository = new FocusSessionRepository(database.database)
    return new FocusTimerService(repository, { notifyCompletion: onComplete }, clock)
  }
})
