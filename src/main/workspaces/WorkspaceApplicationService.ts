import type { OwnerProfile, WorkspaceSetupStatus, WorkspaceSummary } from '../../shared/domain'
import type { WorkspaceRepository } from './WorkspaceRepository'
import type { CredentialService } from '../security/CredentialService'

export class WorkspaceApplicationService {
  constructor(
    private readonly workspaceRepository: WorkspaceRepository,
    private readonly credentialService: CredentialService,
  ) {}

  listWorkspaces(includeArchived = false): WorkspaceSummary[] {
    return this.workspaceRepository.list(includeArchived).map((workspace) => ({
      ...workspace,
      todoistConfigured: this.credentialService.isTodoistConfigured(workspace.id),
    }))
  }

  getWorkspace(workspaceId: string): WorkspaceSummary {
    this.validateId(workspaceId)
    const workspace = this.workspaceRepository.get(workspaceId)
    if (!workspace) throw new Error('The workspace does not exist.')
    return {
      ...workspace,
      todoistConfigured: this.credentialService.isTodoistConfigured(workspace.id),
    }
  }

  getActiveWorkspaceId(): string {
    const workspaceId = this.workspaceRepository.getActiveId()
    this.assertUsableWorkspace(workspaceId)
    return workspaceId
  }

  getActiveWorkspace(): WorkspaceSummary {
    return this.getWorkspace(this.getActiveWorkspaceId())
  }

  getOwnerProfile(): OwnerProfile {
    return this.workspaceRepository.getOwnerProfile()
  }

  getSetupStatus(): WorkspaceSetupStatus {
    return {
      initialSetupRequired: this.workspaceRepository.isInitialSetupRequired(),
      activeWorkspaceId: this.getActiveWorkspaceId(),
      activeWorkspace: this.getActiveWorkspace(),
      ownerProfile: this.getOwnerProfile(),
    }
  }

  createWorkspace(name: string): WorkspaceSummary {
    const normalizedName = this.validateName(name)
    const workspace = this.workspaceRepository.create(normalizedName, true)
    this.workspaceRepository.setActive(workspace.id)
    return this.getWorkspace(workspace.id)
  }

  renameWorkspace(workspaceId: string, name: string): WorkspaceSummary {
    this.assertUsableWorkspace(workspaceId)
    this.workspaceRepository.rename(workspaceId, this.validateName(name))
    return this.getWorkspace(workspaceId)
  }

  archiveWorkspace(workspaceId: string): { archived: true; activeWorkspaceId: string } {
    this.assertUsableWorkspace(workspaceId)
    const activeWorkspaceId = this.workspaceRepository.archive(workspaceId)
    return { archived: true, activeWorkspaceId }
  }

  restoreWorkspace(workspaceId: string): WorkspaceSummary {
    this.validateId(workspaceId)
    this.workspaceRepository.restore(workspaceId)
    return this.getWorkspace(workspaceId)
  }

  selectWorkspace(workspaceId: string): WorkspaceSummary {
    this.assertUsableWorkspace(workspaceId)
    this.workspaceRepository.setActive(workspaceId)
    return this.getWorkspace(workspaceId)
  }

  setOwnerName(name: string): OwnerProfile {
    const normalizedName = name.trim()
    if (normalizedName.length < 1 || normalizedName.length > 80) throw new Error('Owner name must be 1 to 80 characters.')
    return this.workspaceRepository.setOwnerName(normalizedName)
  }

  saveInitialIdentity(ownerName: string, workspaceName: string): void {
    const normalizedOwnerName = ownerName.trim()
    if (normalizedOwnerName.length < 1 || normalizedOwnerName.length > 80) throw new Error('Owner name must be 1 to 80 characters.')
    this.workspaceRepository.setInitialIdentity(normalizedOwnerName, this.validateName(workspaceName))
  }

  completeInitialSetup(): void {
    if (!this.getOwnerProfile().displayName) throw new Error('Enter your name to finish setup.')
    this.workspaceRepository.completeInitialSetup()
  }

  completeWorkspaceSetup(workspaceId: string): void {
    this.assertUsableWorkspace(workspaceId)
    this.workspaceRepository.completeWorkspaceSetup(workspaceId)
  }

  assertUsableWorkspace(workspaceId: string): void {
    this.validateId(workspaceId)
    const workspace = this.workspaceRepository.get(workspaceId)
    if (!workspace) throw new Error('The workspace does not exist.')
    if (workspace.archivedAt) throw new Error('This workspace is archived.')
  }

  private validateId(workspaceId: string): void {
    if (typeof workspaceId !== 'string' || !/^[0-9a-f-]{36}$/i.test(workspaceId)) {
      throw new Error('Choose a valid workspace.')
    }
  }

  private validateName(name: string): string {
    if (typeof name !== 'string') throw new Error('Workspace name must be 1 to 80 characters.')
    const normalizedName = name.trim()
    if (normalizedName.length < 1 || normalizedName.length > 80) throw new Error('Workspace name must be 1 to 80 characters.')
    return normalizedName
  }
}
