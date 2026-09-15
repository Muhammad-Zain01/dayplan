import Database from 'better-sqlite3'
import { afterEach, describe, expect, it } from 'vitest'
import { DatabaseMigrator } from '../database/DatabaseMigrator'
import { WorkspaceApplicationService } from './WorkspaceApplicationService'
import { WorkspaceRepository } from './WorkspaceRepository'

describe('workspace lifecycle', () => {
  let database: Database.Database | null = null

  afterEach(() => {
    database?.close()
    database = null
  })

  function createService(): WorkspaceApplicationService {
    database = new Database(':memory:')
    database.pragma('foreign_keys = ON')
    new DatabaseMigrator({ database } as never).migrate()
    return new WorkspaceApplicationService(new WorkspaceRepository(database), { isTodoistConfigured: () => false } as never)
  }

  it('creates the first workspace, saves the owner profile, and completes first-run setup', () => {
    const service = createService()
    const initial = service.getSetupStatus()

    expect(initial.initialSetupRequired).toBe(true)
    expect(initial.activeWorkspace.name).toBe('Personal')
    expect(initial.ownerProfile.displayName).toBeNull()

    service.saveInitialIdentity('  Zain  ', 'Personal setup')
    service.completeInitialSetup()

    expect(service.getSetupStatus()).toMatchObject({
      initialSetupRequired: false,
      ownerProfile: { displayName: 'Zain' },
      activeWorkspace: { name: 'Personal setup' },
    })
    expect(database?.prepare('SELECT onboarding_completed_at FROM workspaces').get()).toMatchObject({ onboarding_completed_at: expect.any(String) })
  })

  it('archives, restores, and switches workspaces without deleting their records', () => {
    const service = createService()
    const original = service.getActiveWorkspace()
    const second = service.createWorkspace('Studio')

    expect(service.getActiveWorkspaceId()).toBe(second.id)
    expect(service.archiveWorkspace(second.id)).toEqual({ archived: true, activeWorkspaceId: original.id })
    expect(service.listWorkspaces()).toHaveLength(1)
    expect(service.listWorkspaces(true)).toHaveLength(2)
    expect(() => service.assertUsableWorkspace(second.id)).toThrow('This workspace is archived.')

    expect(service.restoreWorkspace(second.id)).toMatchObject({ id: second.id, archivedAt: null })
    expect(service.selectWorkspace(second.id).id).toBe(second.id)
  })

  it('refuses to archive the last active workspace and validates names', () => {
    const service = createService()
    const onlyWorkspace = service.getActiveWorkspace()

    expect(() => service.archiveWorkspace(onlyWorkspace.id)).toThrow('Create another workspace before archiving the last active workspace.')
    expect(() => service.createWorkspace('  ')).toThrow('Workspace name must be 1 to 80 characters.')
    expect(service.listWorkspaces()).toHaveLength(1)
  })
})
