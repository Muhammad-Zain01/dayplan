import type { DatabaseService } from './DatabaseService'
import { randomUUID } from 'node:crypto'

export class DatabaseMigrator {
  constructor(private readonly databaseService: DatabaseService) {}

  migrate(): void {
    const database = this.databaseService.database
    database.exec('CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)')
    const migrations = [
      {
        version: 1,
        sql: 'CREATE TABLE settings (key TEXT PRIMARY KEY, value BLOB NOT NULL, updated_at TEXT NOT NULL);',
      },
      {
        version: 2,
        sql: `
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
          CREATE UNIQUE INDEX focus_sessions_single_active
            ON focus_sessions((1)) WHERE status IN ('running', 'paused');
          CREATE INDEX focus_sessions_kind_status_started
            ON focus_sessions(kind, status, started_at);
          CREATE TABLE focus_intervals (
            id TEXT PRIMARY KEY,
            session_id TEXT NOT NULL REFERENCES focus_sessions(id) ON DELETE CASCADE,
            started_at TEXT NOT NULL,
            ended_at TEXT,
            actual_seconds INTEGER CHECK (actual_seconds IS NULL OR actual_seconds >= 0)
          );
          CREATE UNIQUE INDEX focus_intervals_single_open
            ON focus_intervals(session_id) WHERE ended_at IS NULL;
          CREATE INDEX focus_intervals_started_ended
            ON focus_intervals(started_at, ended_at);
        `,
      },
    ]
    const currentVersion = database.prepare('SELECT COALESCE(MAX(version), 0) AS version FROM schema_migrations').get() as { version: number }
    const startingVersion = currentVersion.version
    for (const migration of migrations) {
      if (migration.version <= currentVersion.version) continue
      const applyMigration = database.transaction(() => {
        database.exec(migration.sql)
        database.prepare('INSERT INTO schema_migrations(version, applied_at) VALUES (?, ?)')
          .run(migration.version, new Date().toISOString())
      })
      applyMigration()
    }

    if (startingVersion < 3) this.migrateWorkspaces(startingVersion)
  }

  private migrateWorkspaces(startingVersion: number): void {
    const database = this.databaseService.database
    const workspaceId = randomUUID()
    const now = new Date().toISOString()
    const freshInstall = startingVersion === 0
    const migration = database.transaction(() => {
      database.exec(`
        CREATE TABLE workspaces (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 80),
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          archived_at TEXT,
          onboarding_completed_at TEXT
        );
        CREATE TABLE owner_profile (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          display_name TEXT,
          avatar_path TEXT,
          updated_at TEXT NOT NULL
        );
        CREATE TABLE workspace_settings (
          workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
          key TEXT NOT NULL CHECK (key IN ('todoist_token', 'focus_timer_preferences')),
          value BLOB NOT NULL,
          updated_at TEXT NOT NULL,
          PRIMARY KEY (workspace_id, key)
        );
      `)
      database.prepare(`
        INSERT INTO workspaces (id, name, created_at, updated_at, onboarding_completed_at)
        VALUES (?, 'Personal', ?, ?, ?)
      `).run(workspaceId, now, now, freshInstall ? null : now)
      database.prepare('INSERT INTO owner_profile (id, display_name, avatar_path, updated_at) VALUES (1, NULL, NULL, ?)')
        .run(now)
      database.prepare(`
        INSERT INTO workspace_settings (workspace_id, key, value, updated_at)
        SELECT ?, key, value, updated_at FROM settings
        WHERE key IN ('todoist_token', 'focus_timer_preferences')
      `).run(workspaceId)
      database.prepare("DELETE FROM settings WHERE key IN ('todoist_token', 'focus_timer_preferences')").run()

      database.pragma('defer_foreign_keys = ON')
      database.exec(`
        CREATE TABLE focus_sessions_v3 (
          id TEXT PRIMARY KEY,
          workspace_id TEXT NOT NULL REFERENCES workspaces(id),
          kind TEXT NOT NULL CHECK (kind IN ('focus', 'break')),
          status TEXT NOT NULL CHECK (status IN ('running', 'paused', 'completed', 'ended_early')),
          target_seconds INTEGER NOT NULL CHECK (target_seconds > 0),
          actual_seconds INTEGER NOT NULL DEFAULT 0 CHECK (actual_seconds >= 0),
          started_at TEXT NOT NULL,
          ended_at TEXT,
          last_heartbeat_at TEXT NOT NULL,
          created_at TEXT NOT NULL
        );
        CREATE TABLE focus_intervals_v3 (
          id TEXT PRIMARY KEY,
          session_id TEXT NOT NULL REFERENCES focus_sessions_v3(id) ON DELETE CASCADE,
          started_at TEXT NOT NULL,
          ended_at TEXT,
          actual_seconds INTEGER CHECK (actual_seconds IS NULL OR actual_seconds >= 0)
        );
      `)
      database.prepare(`
        INSERT INTO focus_sessions_v3
          (id, workspace_id, kind, status, target_seconds, actual_seconds, started_at, ended_at, last_heartbeat_at, created_at)
        SELECT id, ?, kind, status, target_seconds, actual_seconds, started_at, ended_at, last_heartbeat_at, created_at
        FROM focus_sessions
      `).run(workspaceId)
      database.exec(`
        INSERT INTO focus_intervals_v3 (id, session_id, started_at, ended_at, actual_seconds)
        SELECT id, session_id, started_at, ended_at, actual_seconds FROM focus_intervals;
        DROP TABLE focus_intervals;
        DROP TABLE focus_sessions;
        ALTER TABLE focus_sessions_v3 RENAME TO focus_sessions;
        ALTER TABLE focus_intervals_v3 RENAME TO focus_intervals;
        CREATE UNIQUE INDEX focus_sessions_single_active
          ON focus_sessions((1)) WHERE status IN ('running', 'paused');
        CREATE INDEX focus_sessions_workspace_kind_status_started
          ON focus_sessions(workspace_id, kind, status, started_at);
        CREATE UNIQUE INDEX focus_intervals_single_open
          ON focus_intervals(session_id) WHERE ended_at IS NULL;
        CREATE INDEX focus_intervals_started_ended
          ON focus_intervals(started_at, ended_at);
        CREATE TABLE app_state (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          active_workspace_id TEXT NOT NULL REFERENCES workspaces(id),
          initial_setup_required INTEGER NOT NULL CHECK (initial_setup_required IN (0, 1))
        );
      `)
      database.prepare('INSERT INTO app_state (id, active_workspace_id, initial_setup_required) VALUES (1, ?, ?)')
        .run(workspaceId, freshInstall ? 1 : 0)
      database.prepare('INSERT INTO schema_migrations(version, applied_at) VALUES (3, ?)').run(now)
    })
    migration.immediate()
  }
}
