import type { DatabaseService } from './DatabaseService'

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
    for (const migration of migrations) {
      if (migration.version <= currentVersion.version) continue
      const applyMigration = database.transaction(() => {
        database.exec(migration.sql)
        database.prepare('INSERT INTO schema_migrations(version, applied_at) VALUES (?, ?)')
          .run(migration.version, new Date().toISOString())
      })
      applyMigration()
    }
  }
}
