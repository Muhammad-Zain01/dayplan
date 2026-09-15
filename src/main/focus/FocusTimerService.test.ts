import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { FocusSessionKind } from '../../shared/domain'
import { DatabaseService } from '../database/DatabaseService'
import { DatabaseMigrator } from '../database/DatabaseMigrator'
import { FocusSessionRepository } from './FocusSessionRepository'
import { FocusTimerService } from './FocusTimerService'

const WORKSPACE_ID = '00000000-0000-4000-8000-000000000001'

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

    expect(timer.startFocus(WORKSPACE_ID, 30).targetSeconds).toBe(1_800)
    now = new Date(now.getTime() + 3 * 60_000)
    const paused = timer.pause(WORKSPACE_ID)
    expect(paused.status).toBe('paused')
    expect(paused.elapsedSeconds).toBe(180)

    now = new Date(now.getTime() + 20 * 60_000)
    timer.resume(WORKSPACE_ID)
    now = new Date(now.getTime() + 5 * 60_000)
    const ended = timer.endEarly(WORKSPACE_ID)
    expect(ended.status).toBe('ended_early')
    expect(ended.elapsedSeconds).toBe(480)
  })

  it('notifies once when a focus countdown reaches its deadline', () => {
    let now = new Date(2026, 5, 4, 9, 0, 0)
    const notifications: FocusSessionKind[] = []
    timer = createTimer(() => now, (kind) => notifications.push(kind))
    timer.startFocus(WORKSPACE_ID, 30)

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
    timer.startBreak(WORKSPACE_ID, 1)

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
      secondProcess.startFocus(WORKSPACE_ID, 30)
      expect(timer.getSnapshot()).toMatchObject({ status: 'running', targetSeconds: 1800 })
    } finally {
      secondProcess.dispose()
      secondDatabase.close()
    }
  })

  it('keeps a device-wide timer pinned to its workspace when another workspace is selected', () => {
    const secondWorkspaceId = '00000000-0000-4000-8000-000000000002'
    let now = new Date(2026, 5, 4, 9, 0, 0)
    timer = createTimer(() => now)
    database?.database.prepare(`
      INSERT INTO workspaces (id, name, created_at, updated_at, onboarding_completed_at)
      VALUES (?, 'Second workspace', ?, ?, ?)
    `).run(secondWorkspaceId, now.toISOString(), now.toISOString(), now.toISOString())

    const started = timer.startFocus(WORKSPACE_ID, 25)

    expect(started.workspaceId).toBe(WORKSPACE_ID)
    expect(timer.getSnapshot(secondWorkspaceId)).toMatchObject({ status: 'idle', workspaceId: secondWorkspaceId })
    expect(timer.getSnapshot()).toMatchObject({ status: 'running', workspaceId: WORKSPACE_ID })
    expect(() => timer?.pause(secondWorkspaceId)).toThrow('This timer belongs to a different workspace.')
  })

  it('rejects unsupported focus durations', () => {
    timer = createTimer(() => new Date(2026, 5, 4, 9, 0, 0))
    expect(() => timer?.startFocus(WORKSPACE_ID, 0)).toThrow('Focus duration must be between 1 and 240 minutes.')
    expect(() => timer?.startFocus(WORKSPACE_ID, 241)).toThrow('Focus duration must be between 1 and 240 minutes.')
    expect(() => timer?.startBreak(WORKSPACE_ID, 121)).toThrow('Break duration must be between 1 and 120 minutes.')
  })

  it('starts custom focus and break lengths and adjusts the remaining time while active', () => {
    let now = new Date(2026, 5, 4, 9, 0, 0)
    timer = createTimer(() => now)

    expect(timer.startFocus(WORKSPACE_ID, 45).targetSeconds).toBe(45 * 60)
    now = new Date(now.getTime() + 2 * 60_000)
    const adjusted = timer.setRemainingMinutes(WORKSPACE_ID, 7)
    expect(adjusted).toMatchObject({ status: 'running', targetSeconds: 9 * 60, elapsedSeconds: 120, remainingSeconds: 7 * 60 })
    timer.endEarly(WORKSPACE_ID)

    const breakTimer = timer.startBreak(WORKSPACE_ID, 17)
    expect(breakTimer).toMatchObject({ kind: 'break', targetSeconds: 17 * 60, remainingSeconds: 17 * 60 })
  })

  function createTimer(clock: () => Date, onComplete: (kind: FocusSessionKind) => void = () => undefined): FocusTimerService {
    directory = mkdtempSync(join(tmpdir(), 'dayplan-focus-timer-test-'))
    database = new DatabaseService(directory)
    new DatabaseMigrator(database).migrate()
    database.database.prepare(`
      INSERT INTO workspaces (id, name, created_at, updated_at, onboarding_completed_at)
      VALUES (?, 'Test workspace', ?, ?, ?)
    `).run(WORKSPACE_ID, new Date().toISOString(), new Date().toISOString(), new Date().toISOString())
    const repository = new FocusSessionRepository(database.database)
    return new FocusTimerService(repository, { notifyCompletion: onComplete }, clock)
  }
})
