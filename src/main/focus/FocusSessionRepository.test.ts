import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { DatabaseService } from '../database/DatabaseService'
import { DatabaseMigrator } from '../database/DatabaseMigrator'
import { FocusSessionRepository } from './FocusSessionRepository'

const WORKSPACE_ID = '00000000-0000-4000-8000-000000000001'

describe('FocusSessionRepository', () => {
  let directory: string | null = null
  let database: DatabaseService | null = null

  afterEach(() => {
    database?.close()
    database = null
    if (directory) rmSync(directory, { recursive: true, force: true })
    directory = null
  })

  it('stores only active focus time across pauses and resumes', () => {
    const repository = createRepository()
    const start = new Date(2026, 5, 4, 9, 0, 0)
    const session = repository.createSession(WORKSPACE_ID, 'focus', 30 * 60, start)
    repository.pauseSession(session.id, new Date(start.getTime() + 60_000))
    repository.resumeSession(session.id, new Date(start.getTime() + 30 * 60_000))
    repository.endSessionEarly(session.id, new Date(start.getTime() + 30 * 60_000 + 30_000))

    const metrics = repository.getDashboardMetrics(WORKSPACE_ID, 7, new Date(start.getTime() + 31 * 60_000))
    expect(metrics.todaySeconds).toBe(90)
    expect(metrics.todayCompletedSessions).toBe(0)
  })

  it('recovers a crashed timer as paused and excludes unrecorded process downtime', () => {
    const repository = createRepository()
    const start = new Date(2026, 5, 4, 9, 0, 0)
    const session = repository.createSession(WORKSPACE_ID, 'focus', 30 * 60, start)
    repository.heartbeat(session.id, new Date(start.getTime() + 20_000))

    const recovery = repository.recoverInterruptedSession(new Date(start.getTime() + 30 * 60_000))
    expect(recovery.completedDuringDowntime).toBe(false)
    expect(recovery.session?.status).toBe('paused')
    expect(recovery.session?.actualSeconds).toBe(20)
  })

  it('leaves a session running when another Dayplan process has a fresh heartbeat', () => {
    const repository = createRepository()
    const start = new Date(2026, 5, 4, 9, 0, 0)
    const session = repository.createSession(WORKSPACE_ID, 'focus', 30 * 60, start)
    repository.heartbeat(session.id, new Date(start.getTime() + 20_000))

    const recovery = repository.recoverInterruptedSession(new Date(start.getTime() + 25_000))
    expect(recovery.session?.status).toBe('running')
    expect(recovery.session?.activeIntervalStartedAt).toBe(start.toISOString())
    expect(recovery.completedDuringDowntime).toBe(false)
  })

  it('completes concurrent expiration checks only once', () => {
    const repository = createRepository()
    const start = new Date(2026, 5, 4, 9, 0, 0)
    const session = repository.createSession(WORKSPACE_ID, 'focus', 60, start)
    const due = new Date(start.getTime() + 60_000)

    expect(repository.completeSessionIfActive(session.id, due).completedNow).toBe(true)
    expect(repository.completeSessionIfActive(session.id, due).completedNow).toBe(false)
  })

  it('splits a focus interval that crosses local midnight across both days', () => {
    const repository = createRepository()
    const start = new Date(2026, 5, 4, 23, 59, 30)
    const end = new Date(2026, 5, 5, 0, 0, 30)
    const session = repository.createSession(WORKSPACE_ID, 'focus', 2 * 60, start)
    repository.endSessionEarly(session.id, end)

    const totals = repository.getDashboardMetrics(WORKSPACE_ID, 7, end).recentFocusTime
    const yesterday = totals.find((entry) => entry.date === localDateKey(start))
    const today = totals.find((entry) => entry.date === localDateKey(end))
    expect(yesterday?.seconds).toBe(30)
    expect(today?.seconds).toBe(30)
  })

  it('keeps break sessions out of focus totals', () => {
    const repository = createRepository()
    const start = new Date(2026, 5, 4, 11, 0, 0)
    const session = repository.createSession(WORKSPACE_ID, 'break', 5 * 60, start)
    repository.completeSession(session.id, new Date(start.getTime() + 5 * 60_000))

    expect(repository.getDashboardMetrics(WORKSPACE_ID, 7, new Date(start.getTime() + 6 * 60_000)).todaySeconds).toBe(0)
  })

  it('splits today focus into local hourly buckets and excludes breaks', () => {
    const repository = createRepository()
    const start = new Date(2026, 5, 4, 9, 45, 0)
    const focus = repository.createSession(WORKSPACE_ID, 'focus', 30 * 60, start)
    repository.endSessionEarly(focus.id, new Date(2026, 5, 4, 10, 15, 0))
    const breakSession = repository.createSession(WORKSPACE_ID, 'break', 15 * 60, new Date(2026, 5, 4, 10, 30, 0))
    repository.completeSession(breakSession.id, new Date(2026, 5, 4, 10, 45, 0))

    const hourly = repository.getDashboardMetrics(WORKSPACE_ID, 7, new Date(2026, 5, 4, 11, 0, 0)).hourlyFocusTime
    expect(hourly).toHaveLength(24)
    expect(hourly[9]?.seconds).toBe(15 * 60)
    expect(hourly[10]?.seconds).toBe(15 * 60)
    expect(hourly.reduce((sum, entry) => sum + entry.seconds, 0)).toBe(30 * 60)
  })

  function createRepository(): FocusSessionRepository {
    directory = mkdtempSync(join(tmpdir(), 'dayplan-focus-test-'))
    database = new DatabaseService(directory)
    new DatabaseMigrator(database).migrate()
    database.database.prepare(`
      INSERT INTO workspaces (id, name, created_at, updated_at, onboarding_completed_at)
      VALUES (?, 'Test workspace', ?, ?, ?)
    `).run(WORKSPACE_ID, new Date().toISOString(), new Date().toISOString(), new Date().toISOString())
    return new FocusSessionRepository(database.database)
  }

  function localDateKey(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  }
})
