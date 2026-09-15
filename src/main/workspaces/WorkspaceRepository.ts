import { randomUUID } from 'node:crypto'
import type Database from 'better-sqlite3'
import type { OwnerProfile, WorkspaceSummary } from '../../shared/domain'

interface WorkspaceRow {
  id: string
  name: string
  created_at: string
  updated_at: string
  archived_at: string | null
}

export class WorkspaceRepository {
  constructor(private readonly database: Database.Database) {}

  list(includeArchived = false): WorkspaceSummary[] {
    const rows = this.database.prepare(`
      SELECT id, name, created_at, updated_at, archived_at
      FROM workspaces ${includeArchived ? '' : 'WHERE archived_at IS NULL'}
      ORDER BY created_at, name
    `).all() as WorkspaceRow[]
    return rows.map((row) => this.toSummary(row))
  }

  get(workspaceId: string): WorkspaceSummary | null {
    const row = this.database.prepare(`
      SELECT id, name, created_at, updated_at, archived_at FROM workspaces WHERE id = ?
    `).get(workspaceId) as WorkspaceRow | undefined
    return row ? this.toSummary(row) : null
  }

  create(name: string, setupComplete: boolean): WorkspaceSummary {
    const id = randomUUID()
    const now = new Date().toISOString()
    const create = this.database.transaction(() => {
      this.database.prepare(`
        INSERT INTO workspaces (id, name, created_at, updated_at, onboarding_completed_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(id, name, now, now, setupComplete ? now : null)
      this.database.prepare('UPDATE app_state SET active_workspace_id = ? WHERE id = 1').run(id)
    }).immediate
    create()
    const workspace = this.get(id)
    if (!workspace) throw new Error('The workspace could not be created.')
    return workspace
  }

  rename(workspaceId: string, name: string): void {
    const result = this.database.prepare(`
      UPDATE workspaces SET name = ?, updated_at = ? WHERE id = ? AND archived_at IS NULL
    `).run(name, new Date().toISOString(), workspaceId)
    if (result.changes !== 1) throw new Error('This workspace no longer exists or has been archived.')
  }

  archive(workspaceId: string): string {
    const now = new Date().toISOString()
    const update = this.database.prepare(`
      UPDATE workspaces SET archived_at = ?, updated_at = ? WHERE id = ? AND archived_at IS NULL
    `)
    const selectFallback = this.database.prepare(`
      SELECT id FROM workspaces WHERE id <> ? AND archived_at IS NULL ORDER BY created_at, name LIMIT 1
    `)
    const setActive = this.database.prepare('UPDATE app_state SET active_workspace_id = ? WHERE id = 1')
    const archive = this.database.transaction(() => {
      const result = update.run(now, now, workspaceId)
      if (result.changes !== 1) throw new Error('This workspace no longer exists or has already been archived.')
      const active = this.database.prepare('SELECT active_workspace_id FROM app_state WHERE id = 1').get() as { active_workspace_id: string }
      if (active.active_workspace_id !== workspaceId) return active.active_workspace_id
      const fallback = selectFallback.get(workspaceId) as { id: string } | undefined
      if (!fallback) throw new Error('Create another workspace before archiving the last active workspace.')
      setActive.run(fallback.id)
      return fallback.id
    }).immediate
    return archive()
  }

  restore(workspaceId: string): void {
    const result = this.database.prepare(`
      UPDATE workspaces SET archived_at = NULL, updated_at = ? WHERE id = ? AND archived_at IS NOT NULL
    `).run(new Date().toISOString(), workspaceId)
    if (result.changes !== 1) throw new Error('This workspace is not archived or no longer exists.')
  }

  setActive(workspaceId: string): void {
    const workspace = this.database.prepare('SELECT id FROM workspaces WHERE id = ? AND archived_at IS NULL').get(workspaceId)
    if (!workspace) throw new Error('Choose an active workspace.')
    this.database.prepare('UPDATE app_state SET active_workspace_id = ? WHERE id = 1').run(workspaceId)
  }

  getActiveId(): string {
    const row = this.database.prepare('SELECT active_workspace_id FROM app_state WHERE id = 1').get() as { active_workspace_id: string } | undefined
    if (!row) throw new Error('Dayplan has no active workspace.')
    return row.active_workspace_id
  }

  isInitialSetupRequired(): boolean {
    const row = this.database.prepare('SELECT initial_setup_required FROM app_state WHERE id = 1').get() as { initial_setup_required: number } | undefined
    return row?.initial_setup_required === 1
  }

  completeInitialSetup(): void {
    const now = new Date().toISOString()
    const finish = this.database.transaction(() => {
      this.database.prepare('UPDATE app_state SET initial_setup_required = 0 WHERE id = 1').run()
      this.database.prepare('UPDATE workspaces SET onboarding_completed_at = COALESCE(onboarding_completed_at, ?), updated_at = ? WHERE id = ?')
        .run(now, now, this.getActiveId())
    })
    finish()
  }

  getOwnerProfile(): OwnerProfile {
    const row = this.database.prepare('SELECT display_name FROM owner_profile WHERE id = 1').get() as { display_name: string | null } | undefined
    if (!row) throw new Error('The owner profile could not be loaded.')
    return { displayName: row.display_name }
  }

  setOwnerName(displayName: string): OwnerProfile {
    this.database.prepare('UPDATE owner_profile SET display_name = ?, updated_at = ? WHERE id = 1')
      .run(displayName, new Date().toISOString())
    return this.getOwnerProfile()
  }

  setInitialIdentity(displayName: string, workspaceName: string): void {
    const now = new Date().toISOString()
    const save = this.database.transaction(() => {
      this.database.prepare('UPDATE owner_profile SET display_name = ?, updated_at = ? WHERE id = 1').run(displayName, now)
      const activeWorkspaceId = this.getActiveId()
      const result = this.database.prepare(`
        UPDATE workspaces SET name = ?, updated_at = ? WHERE id = ? AND archived_at IS NULL
      `).run(workspaceName, now, activeWorkspaceId)
      if (result.changes !== 1) throw new Error('The first workspace could not be saved.')
    })
    save.immediate()
  }

  completeWorkspaceSetup(workspaceId: string): void {
    const now = new Date().toISOString()
    const result = this.database.prepare(`
      UPDATE workspaces SET onboarding_completed_at = ?, updated_at = ? WHERE id = ? AND archived_at IS NULL
    `).run(now, now, workspaceId)
    if (result.changes !== 1) throw new Error('This workspace no longer exists or has been archived.')
  }

  private toSummary(row: WorkspaceRow): WorkspaceSummary {
    return {
      id: row.id,
      name: row.name,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      archivedAt: row.archived_at,
      todoistConfigured: false,
    }
  }
}
