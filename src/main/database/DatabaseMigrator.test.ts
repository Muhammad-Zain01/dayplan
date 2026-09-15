import Database from 'better-sqlite3'
import { afterEach, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { DatabaseMigrator } from './DatabaseMigrator'

const temporaryDirectories: string[] = []

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) rmSync(directory, { recursive: true, force: true })
})

function createDatabase(): Database.Database {
  const directory = mkdtempSync(join(tmpdir(), 'dayplan-workspaces-'))
  temporaryDirectories.push(directory)
  return new Database(join(directory, 'test.sqlite3'))
}

function createV2Schema(database: Database.Database): void {
  database.exec(`
    CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);
    INSERT INTO schema_migrations(version, applied_at) VALUES (1, '2026-01-01T00:00:00.000Z'), (2, '2026-01-02T00:00:00.000Z');
    CREATE TABLE settings (key TEXT PRIMARY KEY, value BLOB NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE focus_sessions (
      id TEXT PRIMARY KEY,
      kind TEXT NOT NULL CHECK (kind IN ('focus', 'break')),
      status TEXT NOT NULL CHECK (status IN ('running', 'paused', 'completed', 'ended_early')),
      target_seconds INTEGER NOT NULL CHECK (target_seconds > 0),
      actual_seconds INTEGER NOT NULL DEFAULT 0 CHECK (actual_seconds >= 0),
      started_at TEXT NOT NULL,
      ended_at TEXT,
      last_heartbeat_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE UNIQUE INDEX focus_sessions_single_active ON focus_sessions((1)) WHERE status IN ('running', 'paused');
    CREATE INDEX focus_sessions_kind_status_started ON focus_sessions(kind, status, started_at);
    CREATE TABLE focus_intervals (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES focus_sessions(id) ON DELETE CASCADE,
      started_at TEXT NOT NULL,
      ended_at TEXT,
      actual_seconds INTEGER CHECK (actual_seconds IS NULL OR actual_seconds >= 0)
    );
    CREATE UNIQUE INDEX focus_intervals_single_open ON focus_intervals(session_id) WHERE ended_at IS NULL;
    CREATE INDEX focus_intervals_started_ended ON focus_intervals(started_at, ended_at);
  `)
}

describe('DatabaseMigrator workspace migration', () => {
  it('creates a default workspace and routes a fresh install to onboarding', () => {
    const database = createDatabase()

    new DatabaseMigrator({ database } as never).migrate()

    const workspace = database.prepare('SELECT id, name, onboarding_completed_at FROM workspaces').get() as {
      id: string; name: string; onboarding_completed_at: string | null
    }
    const appState = database.prepare('SELECT active_workspace_id, initial_setup_required FROM app_state WHERE id = 1').get() as {
      active_workspace_id: string; initial_setup_required: number
    }
    expect(workspace.name).toBe('Personal')
    expect(workspace.onboarding_completed_at).toBeNull()
    expect(appState).toEqual({ active_workspace_id: workspace.id, initial_setup_required: 1 })
    expect(database.prepare('PRAGMA foreign_key_check').all()).toEqual([])
  })

  it('moves legacy workspace settings and focus history without changing their data', () => {
    const database = createDatabase()
    createV2Schema(database)
    const token = Buffer.from('a-valid-long-todoist-token', 'utf8')
    const preferences = Buffer.from('{"focusMinutes":45,"breakMinutes":10}', 'utf8')
    database.prepare('INSERT INTO settings(key, value, updated_at) VALUES (?, ?, ?)')
      .run('todoist_token', token, '2026-02-01T00:00:00.000Z')
    database.prepare('INSERT INTO settings(key, value, updated_at) VALUES (?, ?, ?)')
      .run('focus_timer_preferences', preferences, '2026-02-02T00:00:00.000Z')
    database.prepare('INSERT INTO settings(key, value, updated_at) VALUES (?, ?, ?)')
      .run('appearance', Buffer.from('dark'), '2026-02-03T00:00:00.000Z')
    database.prepare(`
      INSERT INTO focus_sessions VALUES (?, 'focus', 'completed', 1800, 1800, ?, ?, ?, ?)
    `).run('session-1', '2026-02-04T10:00:00.000Z', '2026-02-04T10:30:00.000Z', '2026-02-04T10:30:00.000Z', '2026-02-04T10:00:00.000Z')
    database.prepare('INSERT INTO focus_intervals VALUES (?, ?, ?, ?, ?)')
      .run('interval-1', 'session-1', '2026-02-04T10:00:00.000Z', '2026-02-04T10:30:00.000Z', 1800)

    new DatabaseMigrator({ database } as never).migrate()

    const workspaceId = (database.prepare('SELECT id FROM workspaces').get() as { id: string }).id
    expect(database.prepare('SELECT key, value FROM workspace_settings WHERE workspace_id = ? ORDER BY key').all(workspaceId))
      .toEqual([
        { key: 'focus_timer_preferences', value: preferences },
        { key: 'todoist_token', value: token },
      ])
    expect(database.prepare('SELECT value FROM settings WHERE key = ?').get('appearance')).toEqual({ value: Buffer.from('dark') })
    expect(database.prepare('SELECT key FROM settings').all()).toEqual([{ key: 'appearance' }])
    expect(database.prepare('SELECT id, workspace_id, status, actual_seconds FROM focus_sessions').get())
      .toEqual({ id: 'session-1', workspace_id: workspaceId, status: 'completed', actual_seconds: 1800 })
    expect(database.prepare('SELECT id, session_id, actual_seconds FROM focus_intervals').get())
      .toEqual({ id: 'interval-1', session_id: 'session-1', actual_seconds: 1800 })
    expect(database.prepare('SELECT initial_setup_required FROM app_state').get()).toEqual({ initial_setup_required: 0 })
    expect(database.prepare('PRAGMA foreign_key_check').all()).toEqual([])

    new DatabaseMigrator({ database } as never).migrate()
    expect(database.prepare('SELECT COUNT(*) AS count FROM workspaces').get()).toEqual({ count: 1 })
  })

  it('rolls back the workspace migration when a legacy focus table is incomplete', () => {
    const database = createDatabase()
    createV2Schema(database)
    database.exec('DROP TABLE focus_intervals')

    expect(() => new DatabaseMigrator({ database } as never).migrate()).toThrow()

    expect(database.prepare('SELECT MAX(version) AS version FROM schema_migrations').get()).toEqual({ version: 2 })
    expect(database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'workspaces'").get()).toBeUndefined()
    expect(database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'focus_sessions'").get()).toEqual({ name: 'focus_sessions' })
  })

  it('preserves a live timer and recreates its single-active-session constraints', () => {
    const database = createDatabase()
    createV2Schema(database)
    const startedAt = '2026-02-04T10:00:00.000Z'
    database.prepare(`
      INSERT INTO focus_sessions (id, kind, status, target_seconds, actual_seconds, started_at, last_heartbeat_at, created_at)
      VALUES ('running-1', 'focus', 'running', 1800, 120, ?, ?, ?)
    `).run(startedAt, startedAt, startedAt)
    database.prepare('INSERT INTO focus_intervals (id, session_id, started_at) VALUES (?, ?, ?)')
      .run('open-interval', 'running-1', startedAt)

    new DatabaseMigrator({ database } as never).migrate()

    const workspaceId = (database.prepare('SELECT id FROM workspaces').get() as { id: string }).id
    expect(database.prepare('SELECT id, workspace_id, status, actual_seconds FROM focus_sessions').get())
      .toEqual({ id: 'running-1', workspace_id: workspaceId, status: 'running', actual_seconds: 120 })
    expect(database.prepare('SELECT id, session_id, started_at, ended_at FROM focus_intervals').get())
      .toEqual({ id: 'open-interval', session_id: 'running-1', started_at: startedAt, ended_at: null })
    expect(database.prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'focus_sessions_single_active'").get())
      .toEqual({ name: 'focus_sessions_single_active' })
    expect(() => database.prepare(`
      INSERT INTO focus_sessions (id, workspace_id, kind, status, target_seconds, started_at, last_heartbeat_at, created_at)
      VALUES ('running-2', ?, 'focus', 'paused', 1800, ?, ?, ?)
    `).run(workspaceId, startedAt, startedAt, startedAt)).toThrow()
    expect(database.prepare('PRAGMA foreign_key_check').all()).toEqual([])
  })
})
