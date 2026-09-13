import type { DatabaseService } from './database/DatabaseService'
import { DashboardService } from './dashboard/DashboardService'
import { TodoistApiClient } from './integrations/todoist/TodoistApiClient'
import { ToolApprovalService } from './mcp/ToolApprovalService'
import { TodoistTaskMcpTools } from './mcp/TodoistTaskMcpTools'
import { CredentialService } from './security/CredentialService'
import { SettingsApplicationService } from './settings/SettingsApplicationService'
import { SettingsRepository } from './settings/SettingsRepository'
import { TaskApplicationService } from './tasks/TaskApplicationService'

export class AppServices {
  readonly credentialService: CredentialService
  readonly todoistApiClient: TodoistApiClient
  readonly taskService: TaskApplicationService
  readonly dashboardService: DashboardService
  readonly settingsService: SettingsApplicationService
  readonly approvalService: ToolApprovalService
  readonly mcpTools: TodoistTaskMcpTools

  constructor(databaseService: DatabaseService) {
    this.credentialService = new CredentialService(new SettingsRepository(databaseService))
    this.todoistApiClient = new TodoistApiClient(this.credentialService)
    this.taskService = new TaskApplicationService(this.todoistApiClient)
    this.dashboardService = new DashboardService(this.taskService)
    this.settingsService = new SettingsApplicationService(this.credentialService, this.todoistApiClient)
    this.approvalService = new ToolApprovalService()
    this.mcpTools = new TodoistTaskMcpTools(this.taskService, this.approvalService)
  }
}
