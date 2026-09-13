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
