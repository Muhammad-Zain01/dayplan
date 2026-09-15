import type { DatabaseService } from './database/DatabaseService'
import { DashboardService } from './dashboard/DashboardService'
import { FocusDashboardService } from './focus/FocusDashboardService'
import { FocusSessionRepository } from './focus/FocusSessionRepository'
import { TodoistApiClient } from './integrations/todoist/TodoistApiClient'
import { TodoistDeleteApprovalService } from './mcp/TodoistDeleteApprovalService'
import { TodoistTaskMcpTools } from './mcp/TodoistTaskMcpTools'
import { CredentialService } from './security/CredentialService'
import { SettingsApplicationService } from './settings/SettingsApplicationService'
import { SettingsRepository } from './settings/SettingsRepository'
import { TaskApplicationService } from './tasks/TaskApplicationService'
import { WorkspaceRepository } from './workspaces/WorkspaceRepository'
import { WorkspaceSettingsRepository } from './workspaces/WorkspaceSettingsRepository'
import { WorkspaceApplicationService } from './workspaces/WorkspaceApplicationService'
import { WorkspaceMcpTools } from './mcp/WorkspaceMcpTools'

export class AppServices {
  readonly credentialService: CredentialService
  readonly todoistApiClient: TodoistApiClient
  readonly taskService: TaskApplicationService
  readonly dashboardService: DashboardService
  readonly focusSessionRepository: FocusSessionRepository
  readonly focusDashboardService: FocusDashboardService
  readonly settingsService: SettingsApplicationService
  readonly deleteApprovalService: TodoistDeleteApprovalService
  readonly mcpTools: TodoistTaskMcpTools
  readonly workspaceService: WorkspaceApplicationService
  readonly workspaceMcpTools: WorkspaceMcpTools

  constructor(databaseService: DatabaseService) {
    const settingsRepository = new SettingsRepository(databaseService)
    const workspaceRepository = new WorkspaceRepository(databaseService.database)
    const workspaceSettingsRepository = new WorkspaceSettingsRepository(databaseService.database)
    this.credentialService = new CredentialService(workspaceSettingsRepository)
    this.workspaceService = new WorkspaceApplicationService(workspaceRepository, this.credentialService)
    this.todoistApiClient = new TodoistApiClient(this.credentialService)
    this.taskService = new TaskApplicationService(this.todoistApiClient)
    this.dashboardService = new DashboardService(this.taskService)
    this.focusSessionRepository = new FocusSessionRepository(databaseService.database)
    this.focusDashboardService = new FocusDashboardService(this.focusSessionRepository)
    this.settingsService = new SettingsApplicationService(this.credentialService, this.todoistApiClient, settingsRepository, workspaceSettingsRepository)
    this.deleteApprovalService = new TodoistDeleteApprovalService()
    this.mcpTools = new TodoistTaskMcpTools(this.taskService, this.deleteApprovalService, this.workspaceService)
    this.workspaceMcpTools = new WorkspaceMcpTools(this.workspaceService)
  }
}
