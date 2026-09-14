import { randomUUID } from 'node:crypto'
import type Database from 'better-sqlite3'
import type { DailyFocusTotal, FocusDashboardMetrics, FocusSessionKind, FocusSessionStatus } from '../../shared/domain'

export interface FocusSessionRecord {
  id: string
  kind: FocusSessionKind
  status: FocusSessionStatus
  targetSeconds: number
  actualSeconds: number
  startedAt: string
  endedAt: string | null
  lastHeartbeatAt: string
  activeIntervalStartedAt: string | null
}

export interface FocusSessionRecovery {
  session: FocusSessionRecord | null
  completedDuringDowntime: boolean
}

interface FocusSessionRow {
  id: string
  kind: FocusSessionKind
  status: FocusSessionStatus
  target_seconds: number
  actual_seconds: number
  started_at: string
  ended_at: string | null
  last_heartbeat_at: string
  active_interval_started_at: string | null
}

interface FocusIntervalRow {
  started_at: string
  ended_at: string | null
}

export class FocusSessionRepository {
  constructor(private readonly database: Database.Database) {}

  createSession(kind: FocusSessionKind, targetSeconds: number, startedAt: Date): FocusSessionRecord {
    if (!Number.isInteger(targetSeconds) || targetSeconds <= 0) throw new Error('Timer duration must be a positive number of seconds.')
    const id = randomUUID()
    const timestamp = startedAt.toISOString()
    const insert = this.database.transaction(() => {
      this.database.prepare(`
        INSERT INTO focus_sessions (id, kind, status, target_seconds, actual_seconds, started_at, last_heartbeat_at, created_at)
        VALUES (?, ?, 'running', ?, 0, ?, ?, ?)
      `).run(id, kind, targetSeconds, timestamp, timestamp, timestamp)
      this.database.prepare(`
        INSERT INTO focus_intervals (id, session_id, started_at)
        VALUES (?, ?, ?)
      `).run(randomUUID(), id, timestamp)
    }).immediate
    insert()
    const session = this.getSession(id)
    if (!session) throw new Error('The focus session could not be created.')
    return session
  }

  getActiveSession(): FocusSessionRecord | null {
    const row = this.database.prepare(`
      SELECT s.id, s.kind, s.status, s.target_seconds, s.actual_seconds, s.started_at, s.ended_at,
        s.last_heartbeat_at,
        (SELECT i.started_at FROM focus_intervals i WHERE i.session_id = s.id AND i.ended_at IS NULL LIMIT 1) AS active_interval_started_at
      FROM focus_sessions s WHERE s.status IN ('running', 'paused') LIMIT 1
    `).get() as FocusSessionRow | undefined
    return row ? this.toSession(row) : null
  }

  getLatestSession(): FocusSessionRecord | null {
    const row = this.database.prepare(`
      SELECT s.id, s.kind, s.status, s.target_seconds, s.actual_seconds, s.started_at, s.ended_at,
        s.last_heartbeat_at, NULL AS active_interval_started_at
      FROM focus_sessions s ORDER BY s.created_at DESC LIMIT 1
    `).get() as FocusSessionRow | undefined
    return row ? this.toSession(row) : null
  }

  pauseSession(sessionId: string, at: Date): FocusSessionRecord {
    return this.closeActiveInterval(sessionId, at, 'paused')
  }

  resumeSession(sessionId: string, at: Date): FocusSessionRecord {
    const timestamp = at.toISOString()
    const resume = this.database.transaction(() => {
      const session = this.getSession(sessionId)
      if (!session || session.status !== 'paused') throw new Error('Only a paused timer can be resumed.')
      this.database.prepare(`
        UPDATE focus_sessions SET status = 'running', last_heartbeat_at = ? WHERE id = ? AND status = 'paused'
      `).run(timestamp, sessionId)
      this.database.prepare('INSERT INTO focus_intervals (id, session_id, started_at) VALUES (?, ?, ?)')
        .run(randomUUID(), sessionId, timestamp)
    }).immediate
    resume()
    const session = this.getSession(sessionId)
    if (!session) throw new Error('The focus session could not be resumed.')
    return session
  }

  updateTargetSeconds(sessionId: string, targetSeconds: number): FocusSessionRecord {
    if (!Number.isInteger(targetSeconds) || targetSeconds <= 0) throw new Error('Timer duration must be a positive number of seconds.')
    const update = this.database.transaction(() => {
      const session = this.getSession(sessionId)
      if (!session || (session.status !== 'running' && session.status !== 'paused')) {
        throw new Error('Only an active timer can have its time changed.')
      }
      if (targetSeconds <= session.actualSeconds) throw new Error('The new timer duration must be longer than the time already recorded.')
      this.database.prepare(`
        UPDATE focus_sessions SET target_seconds = ? WHERE id = ? AND status IN ('running', 'paused')
      `).run(targetSeconds, sessionId)
    }).immediate
    update()
    const session = this.getSession(sessionId)
    if (!session) throw new Error('The timer duration could not be changed.')
    return session
  }

  completeSession(sessionId: string, at: Date): FocusSessionRecord {
    const result = this.completeSessionIfActive(sessionId, at)
    return result.session
  }

  completeSessionIfActive(sessionId: string, at: Date): { session: FocusSessionRecord; completedNow: boolean } {
    const complete = this.database.transaction(() => {
      const session = this.getSession(sessionId)
      if (!session) throw new Error('The timer session no longer exists.')
      if (session.status === 'completed') return false
      if (session.status !== 'running' && session.status !== 'paused') throw new Error('The timer is no longer active.')
      const remainingSeconds = Math.max(0, session.targetSeconds - session.actualSeconds)
      let endedAt = at
      if (session.status === 'running' && session.activeIntervalStartedAt) {
        const intervalStart = new Date(session.activeIntervalStartedAt)
        endedAt = new Date(Math.min(at.getTime(), intervalStart.getTime() + remainingSeconds * 1000))
        this.database.prepare(`
          UPDATE focus_intervals SET ended_at = ?, actual_seconds = ?
          WHERE session_id = ? AND ended_at IS NULL
        `).run(endedAt.toISOString(), remainingSeconds, sessionId)
      }
      this.database.prepare(`
        UPDATE focus_sessions SET status = 'completed', actual_seconds = target_seconds, ended_at = ?, last_heartbeat_at = ?
        WHERE id = ?
      `).run(endedAt.toISOString(), endedAt.toISOString(), sessionId)
      return true
    }).immediate
    const completedNow = complete()
    const session = this.getSession(sessionId)
    if (!session) throw new Error('The focus session could not be completed.')
    return { session, completedNow }
  }

  endSessionEarly(sessionId: string, at: Date): FocusSessionRecord {
    return this.closeActiveInterval(sessionId, at, 'ended_early')
  }

  heartbeat(sessionId: string, at: Date): void {
    this.database.prepare(`
      UPDATE focus_sessions SET last_heartbeat_at = ? WHERE id = ? AND status = 'running'
    `).run(at.toISOString(), sessionId)
  }

  recoverInterruptedSession(now: Date, staleHeartbeatMs = 15_000): FocusSessionRecovery {
    const session = this.getActiveSession()
    if (!session || session.status !== 'running' || !session.activeIntervalStartedAt) {
      return { session, completedDuringDowntime: false }
    }
    if (now.getTime() - new Date(session.lastHeartbeatAt).getTime() < staleHeartbeatMs) {
      return { session, completedDuringDowntime: false }
    }

    const intervalStart = new Date(session.activeIntervalStartedAt)
    const lastHeartbeat = new Date(session.lastHeartbeatAt)
    const recoveredUntil = new Date(Math.min(now.getTime(), Math.max(intervalStart.getTime(), lastHeartbeat.getTime())))
    const intervalSeconds = Math.max(0, Math.floor((recoveredUntil.getTime() - intervalStart.getTime()) / 1000))
    const remainingSeconds = Math.max(0, session.targetSeconds - session.actualSeconds)

    if (intervalSeconds >= remainingSeconds) {
      const completionTime = new Date(intervalStart.getTime() + remainingSeconds * 1000)
      const completion = this.completeSessionIfActive(session.id, completionTime)
      return { session: completion.session, completedDuringDowntime: completion.completedNow }
    }

    const recovered = this.database.transaction(() => {
      this.database.prepare(`
        UPDATE focus_intervals SET ended_at = ?, actual_seconds = ?
        WHERE session_id = ? AND ended_at IS NULL
      `).run(recoveredUntil.toISOString(), intervalSeconds, session.id)
      this.database.prepare(`
        UPDATE focus_sessions SET status = 'paused', actual_seconds = actual_seconds + ? WHERE id = ? AND status = 'running'
      `).run(intervalSeconds, session.id)
    }).immediate
    recovered()
    return { session: this.getSession(session.id), completedDuringDowntime: false }
  }

  getDashboardMetrics(days: 7 | 30, now: Date): FocusDashboardMetrics {
    const firstDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - days + 1)
    const dayTotals = new Map<string, number>()
    for (let offset = 0; offset < days; offset += 1) {
      const date = new Date(firstDate.getFullYear(), firstDate.getMonth(), firstDate.getDate() + offset)
      dayTotals.set(this.localDateKey(date), 0)
    }

    const intervals = this.database.prepare(`
      SELECT i.started_at, i.ended_at
      FROM focus_intervals i JOIN focus_sessions s ON s.id = i.session_id
      WHERE s.kind = 'focus' AND i.started_at < ? AND (i.ended_at IS NULL OR i.ended_at > ?)
    `).all(this.nextLocalDay(now).toISOString(), firstDate.toISOString()) as FocusIntervalRow[]
    for (const interval of intervals) {
      this.addIntervalToLocalDays(interval, firstDate, now, dayTotals)
    }

    const todayKey = this.localDateKey(now)
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
    const tomorrowStart = this.nextLocalDay(now).toISOString()
    const count = this.database.prepare(`
      SELECT COUNT(*) AS count FROM focus_sessions
      WHERE kind = 'focus' AND status = 'completed' AND ended_at >= ? AND ended_at < ?
    `).get(todayStart, tomorrowStart) as { count: number }

    const recentFocusTime: DailyFocusTotal[] = [...dayTotals].map(([date, seconds]) => ({ date, seconds }))
    return {
      todaySeconds: dayTotals.get(todayKey) ?? 0,
      todayCompletedSessions: count.count,
      recentFocusTime,
      refreshedAt: now.toISOString(),
    }
  }

  private closeActiveInterval(sessionId: string, at: Date, nextStatus: 'paused' | 'ended_early'): FocusSessionRecord {
    const close = this.database.transaction(() => {
      const session = this.getSession(sessionId)
      if (!session || (session.status !== 'running' && !(nextStatus === 'ended_early' && session.status === 'paused'))) {
        throw new Error(nextStatus === 'paused' ? 'Only a running timer can be paused.' : 'Only an active timer can be ended.')
      }
      if (session.status === 'paused') {
        this.database.prepare(`
          UPDATE focus_sessions SET status = 'ended_early', ended_at = ?, last_heartbeat_at = ? WHERE id = ?
        `).run(at.toISOString(), at.toISOString(), sessionId)
        return
      }
      if (!session.activeIntervalStartedAt) throw new Error('The running timer has no active interval.')
      const remainingSeconds = Math.max(0, session.targetSeconds - session.actualSeconds)
      const intervalStart = new Date(session.activeIntervalStartedAt)
      const elapsedSeconds = Math.min(remainingSeconds, Math.max(0, Math.floor((at.getTime() - intervalStart.getTime()) / 1000)))
      const endedAt = new Date(Math.min(at.getTime(), intervalStart.getTime() + elapsedSeconds * 1000))
      this.database.prepare(`
        UPDATE focus_intervals SET ended_at = ?, actual_seconds = ?
        WHERE session_id = ? AND ended_at IS NULL
      `).run(endedAt.toISOString(), elapsedSeconds, sessionId)
      this.database.prepare(`
        UPDATE focus_sessions SET status = ?, actual_seconds = actual_seconds + ?, ended_at = ?, last_heartbeat_at = ?
        WHERE id = ?
      `).run(nextStatus, elapsedSeconds, nextStatus === 'ended_early' ? endedAt.toISOString() : null, endedAt.toISOString(), sessionId)
    }).immediate
    close()
    const session = this.getSession(sessionId)
    if (!session) throw new Error('The focus session could not be updated.')
    return session
  }

  private getSession(sessionId: string): FocusSessionRecord | null {
    const row = this.database.prepare(`
      SELECT s.id, s.kind, s.status, s.target_seconds, s.actual_seconds, s.started_at, s.ended_at,
        s.last_heartbeat_at,
        (SELECT i.started_at FROM focus_intervals i WHERE i.session_id = s.id AND i.ended_at IS NULL LIMIT 1) AS active_interval_started_at
      FROM focus_sessions s WHERE s.id = ?
    `).get(sessionId) as FocusSessionRow | undefined
    return row ? this.toSession(row) : null
  }

  private toSession(row: FocusSessionRow): FocusSessionRecord {
    return {
      id: row.id,
      kind: row.kind,
      status: row.status,
      targetSeconds: row.target_seconds,
      actualSeconds: row.actual_seconds,
      startedAt: row.started_at,
      endedAt: row.ended_at,
      lastHeartbeatAt: row.last_heartbeat_at,
      activeIntervalStartedAt: row.active_interval_started_at,
    }
  }

  private addIntervalToLocalDays(interval: FocusIntervalRow, rangeStart: Date, now: Date, totals: Map<string, number>): void {
    const intervalStart = new Date(interval.started_at)
    const intervalEnd = interval.ended_at ? new Date(interval.ended_at) : now
    let cursor = new Date(Math.max(intervalStart.getTime(), rangeStart.getTime()))
    const clippedEnd = Math.min(intervalEnd.getTime(), now.getTime())
    while (cursor.getTime() < clippedEnd) {
      const nextDay = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1)
      const segmentEnd = Math.min(nextDay.getTime(), clippedEnd)
      const key = this.localDateKey(cursor)
      if (totals.has(key)) totals.set(key, (totals.get(key) ?? 0) + Math.floor((segmentEnd - cursor.getTime()) / 1000))
      cursor = nextDay
    }
  }

  private nextLocalDay(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1)
  }

  private localDateKey(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  }
}
