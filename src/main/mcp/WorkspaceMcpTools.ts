import { McpServer } from '@modelcontextprotocol/server'
import * as z from 'zod/v4'
import type { WorkspaceApplicationService } from '../workspaces/WorkspaceApplicationService'

const WorkspaceSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  todoistConfigured: z.boolean(),
})

export class WorkspaceMcpTools {
  constructor(private readonly workspaceService: WorkspaceApplicationService) {}

  register(server: McpServer): void {
    server.registerTool('workspace_list', {
      description: 'List active Dayplan workspaces to discover their IDs for workspace-scoped task and focus tools. Does not reveal Todoist credentials.',
      inputSchema: z.object({}).strict(),
      outputSchema: z.object({ workspaces: z.array(WorkspaceSchema) }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    }, async () => {
      const workspaces = this.workspaceService.listWorkspaces()
      const value = { workspaces }
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(value) }],
        structuredContent: value,
      }
    })
  }
}
