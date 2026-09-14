import { DEFAULT_FOCUS_TIMER_PREFERENCES, FOCUS_TIMER_DURATION_LIMITS, type FocusSessionKind, type FocusTimerSnapshot } from '../../shared/domain'
import { FocusSessionRepository } from './FocusSessionRepository'

export interface FocusCompletionNotifier {
  notifyCompletion(kind: FocusSessionKind): void
}

export type FocusTimerListener = (snapshot: FocusTimerSnapshot) => void

const HEARTBEAT_INTERVAL_MS = 10_000
const TIMER_TICK_INTERVAL_MS = 1_000
const BREAK_DURATION_SECONDS = DEFAULT_FOCUS_TIMER_PREFERENCES.breakMinutes * 60

export class FocusTimerService {
  private readonly listeners = new Set<FocusTimerListener>()
  private ticker: NodeJS.Timeout | null = null
  private lastHeartbeatAt = 0
  private lastPublishedState: string | null = null

  constructor(
    private readonly sessionRepository: FocusSessionRepository,
    private readonly notifier: FocusCompletionNotifier,
    private readonly clock: () => Date = () => new Date(),
  ) {
    const recovery = this.sessionRepository.recoverInterruptedSession(this.clock())
    if (recovery.completedDuringDowntime) this.notifier.notifyCompletion(recovery.session?.kind ?? 'focus')
    if (recovery.session?.status === 'running') this.lastHeartbeatAt = new Date(recovery.session.lastHeartbeatAt).getTime()
    this.startTicker()
  }

  getSnapshot(): FocusTimerSnapshot {
    this.advanceIfExpired()
    return this.createSnapshot()
  }

  startFocus(minutes: number): FocusTimerSnapshot {
    if (!Number.isInteger(minutes) || minutes < FOCUS_TIMER_DURATION_LIMITS.focus.min || minutes > FOCUS_TIMER_DURATION_LIMITS.focus.max) {
      throw new Error('Focus duration must be between 1 and 240 minutes.')
    }
    this.ensureNoActiveSession()
    const now = this.clock()
    this.sessionRepository.createSession('focus', minutes * 60, now)
    this.lastHeartbeatAt = now.getTime()
    this.startTicker()
    return this.publish()
  }

  startBreak(minutes = BREAK_DURATION_SECONDS / 60): FocusTimerSnapshot {
    if (!Number.isInteger(minutes) || minutes < FOCUS_TIMER_DURATION_LIMITS.break.min || minutes > FOCUS_TIMER_DURATION_LIMITS.break.max) {
      throw new Error('Break duration must be between 1 and 120 minutes.')
    }
    this.ensureNoActiveSession()
    const now = this.clock()
    this.sessionRepository.createSession('break', minutes * 60, now)
    this.lastHeartbeatAt = now.getTime()
    this.startTicker()
    return this.publish()
  }

  pause(): FocusTimerSnapshot {
    this.advanceIfExpired()
    const session = this.sessionRepository.getActiveSession()
    if (!session) {
      const latest = this.sessionRepository.getLatestSession()
      if (latest?.status === 'completed') return this.createSnapshot()
      throw new Error('There is no running timer to pause.')
    }
    if (session.status !== 'running') throw new Error('There is no running timer to pause.')
    this.sessionRepository.pauseSession(session.id, this.clock())
    return this.publish()
  }

  resume(): FocusTimerSnapshot {
    this.advanceIfExpired()
    const session = this.sessionRepository.getActiveSession()
    if (!session || session.status !== 'paused') throw new Error('There is no paused timer to resume.')
    const now = this.clock()
    this.sessionRepository.resumeSession(session.id, now)
    this.lastHeartbeatAt = now.getTime()
    return this.publish()
  }

  setRemainingMinutes(minutes: number): FocusTimerSnapshot {
    if (!Number.isInteger(minutes)) throw new Error('Enter a whole number of minutes.')
    this.advanceIfExpired()
    const session = this.sessionRepository.getActiveSession()
    if (!session) throw new Error('There is no active timer to adjust.')
    const limits = session.kind === 'focus' ? FOCUS_TIMER_DURATION_LIMITS.focus : FOCUS_TIMER_DURATION_LIMITS.break
    if (minutes < limits.min || minutes > limits.max) {
      throw new Error(`Remaining time must be between ${limits.min} and ${limits.max} minutes.`)
    }
    const now = this.clock()
    const elapsedSeconds = session.actualSeconds + (session.status === 'running' && session.activeIntervalStartedAt
      ? Math.max(0, Math.floor((now.getTime() - new Date(session.activeIntervalStartedAt).getTime()) / 1000))
      : 0)
    this.sessionRepository.updateTargetSeconds(session.id, elapsedSeconds + minutes * 60)
    return this.publish()
  }

  endEarly(): FocusTimerSnapshot {
    this.advanceIfExpired()
    const session = this.sessionRepository.getActiveSession()
    if (!session) {
      if (this.sessionRepository.getLatestSession()?.status === 'completed') return this.createSnapshot()
      throw new Error('There is no active timer to end.')
    }
    this.sessionRepository.endSessionEarly(session.id, this.clock())
    return this.publish()
  }

  handleSystemSuspend(): void {
    this.advanceIfExpired()
    const session = this.sessionRepository.getActiveSession()
    if (!session || session.status !== 'running') return
    this.sessionRepository.pauseSession(session.id, this.clock())
    this.publish()
  }

  shutdown(): void {
    this.advanceIfExpired()
    const session = this.sessionRepository.getActiveSession()
    if (session) this.sessionRepository.endSessionEarly(session.id, this.clock())
    this.stopTicker()
  }

  dispose(): void {
    this.stopTicker()
  }

  subscribe(listener: FocusTimerListener): () => void {
    const snapshot = this.getSnapshot()
    this.listeners.add(listener)
    this.lastPublishedState = this.stateSignature(snapshot)
    listener(snapshot)
    return () => this.listeners.delete(listener)
  }

  private ensureNoActiveSession(): void {
    this.advanceIfExpired()
    if (this.sessionRepository.getActiveSession()) throw new Error('End or pause the current timer before starting another.')
  }

  private advanceIfExpired(): boolean {
    const session = this.sessionRepository.getActiveSession()
    if (!session || session.status !== 'running' || !session.activeIntervalStartedAt) return false
    const now = this.clock()
    const intervalStart = new Date(session.activeIntervalStartedAt)
    const elapsed = session.actualSeconds + Math.floor((now.getTime() - intervalStart.getTime()) / 1000)
    if (elapsed >= session.targetSeconds) {
      const completion = this.sessionRepository.completeSessionIfActive(session.id, now)
      if (completion.completedNow) this.notifier.notifyCompletion(session.kind)
      this.publish()
      return true
    }
    if (now.getTime() - this.lastHeartbeatAt >= HEARTBEAT_INTERVAL_MS) {
      this.sessionRepository.heartbeat(session.id, now)
      this.lastHeartbeatAt = now.getTime()
    }
    return false
  }

  private createSnapshot(): FocusTimerSnapshot {
    const session = this.sessionRepository.getActiveSession() ?? this.sessionRepository.getLatestSession()
    if (!session) {
      return {
        sessionId: null,
        kind: null,
        status: 'idle',
        targetSeconds: 0,
        elapsedSeconds: 0,
        remainingSeconds: 0,
        updatedAt: this.clock().toISOString(),
      }
    }

    let elapsedSeconds = session.actualSeconds
    if (session.status === 'running' && session.activeIntervalStartedAt) {
      elapsedSeconds += Math.max(0, Math.floor((this.clock().getTime() - new Date(session.activeIntervalStartedAt).getTime()) / 1000))
    }
    elapsedSeconds = Math.min(session.targetSeconds, elapsedSeconds)
    return {
      sessionId: session.id,
      kind: session.kind,
      status: session.status,
      targetSeconds: session.targetSeconds,
      elapsedSeconds,
      remainingSeconds: Math.max(0, session.targetSeconds - elapsedSeconds),
      updatedAt: this.clock().toISOString(),
    }
  }

  private publish(): FocusTimerSnapshot {
    const snapshot = this.createSnapshot()
    const signature = this.stateSignature(snapshot)
    if (signature === this.lastPublishedState) return snapshot
    this.lastPublishedState = signature
    for (const listener of this.listeners) listener(snapshot)
    return snapshot
  }

  private stateSignature(snapshot: FocusTimerSnapshot): string {
    return JSON.stringify({
      sessionId: snapshot.sessionId,
      kind: snapshot.kind,
      status: snapshot.status,
      targetSeconds: snapshot.targetSeconds,
      elapsedSeconds: snapshot.elapsedSeconds,
      remainingSeconds: snapshot.remainingSeconds,
    })
  }

  private startTicker(): void {
    if (this.ticker) return
    this.ticker = setInterval(() => {
      if (!this.advanceIfExpired()) this.publish()
    }, TIMER_TICK_INTERVAL_MS)
    this.ticker.unref()
  }

  private stopTicker(): void {
    if (!this.ticker) return
    clearInterval(this.ticker)
    this.ticker = null
  }
}
