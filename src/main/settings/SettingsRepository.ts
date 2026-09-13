import type { DatabaseService } from '../database/DatabaseService'

export class SettingsRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  get(key: 'todoist_token'): Buffer | undefined {
    const row = this.databaseService.database
      .prepare('SELECT value FROM settings WHERE key = ?')
      .get(key) as { value: Buffer } | undefined
    return row?.value
  }

  set(key: 'todoist_token', value: Buffer): void {
    this.databaseService.database.prepare(`
      INSERT INTO settings(key, value, updated_at) VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `).run(key, value, new Date().toISOString())
  }

  remove(key: 'todoist_token'): void {
    this.databaseService.database.prepare('DELETE FROM settings WHERE key = ?').run(key)
  }
}
