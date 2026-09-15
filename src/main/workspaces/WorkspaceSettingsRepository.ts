import type Database from 'better-sqlite3'

export type WorkspaceSettingKey = 'todoist_token' | 'focus_timer_preferences'

export class WorkspaceSettingsRepository {
  constructor(private readonly database: Database.Database) {}

  get(workspaceId: string, key: WorkspaceSettingKey): Buffer | undefined {
    const row = this.database.prepare(`
      SELECT value FROM workspace_settings WHERE workspace_id = ? AND key = ?
    `).get(workspaceId, key) as { value: Buffer } | undefined
    return row?.value
  }

  set(workspaceId: string, key: WorkspaceSettingKey, value: Buffer): void {
    this.database.prepare(`
      INSERT INTO workspace_settings(workspace_id, key, value, updated_at) VALUES (?, ?, ?, ?)
      ON CONFLICT(workspace_id, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `).run(workspaceId, key, value, new Date().toISOString())
  }

  remove(workspaceId: string, key: WorkspaceSettingKey): void {
    this.database.prepare('DELETE FROM workspace_settings WHERE workspace_id = ? AND key = ?').run(workspaceId, key)
  }
}
