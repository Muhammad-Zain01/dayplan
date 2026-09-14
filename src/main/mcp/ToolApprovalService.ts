import { dialog } from 'electron'

export class ToolApprovalService {
  async requestApproval(toolName: string, argumentsValue: unknown): Promise<boolean> {
    const isDelete = toolName === 'todoist_delete_task'
    const result = await dialog.showMessageBox({
      type: isDelete ? 'warning' : 'question',
      title: 'Dayplan MCP request',
      message: this.messageFor(toolName),
      detail: `${JSON.stringify(argumentsValue, null, 2)}${isDelete ? '\n\nTodoist will also delete all subtasks.' : ''}`,
      buttons: [isDelete ? 'Delete task' : 'Approve', 'Deny'],
      defaultId: 1,
      cancelId: 1,
      noLink: true,
    })
    return result.response === 0
  }

  private messageFor(toolName: string): string {
    const actions: Record<string, string> = {
      todoist_create_task: 'Allow the AI host to create this Todoist task?',
      todoist_update_task: 'Allow the AI host to update this Todoist task?',
      todoist_complete_task: 'Allow the AI host to complete this Todoist task?',
      todoist_reopen_task: 'Allow the AI host to reopen this Todoist task?',
      todoist_delete_task: 'Permanently delete this Todoist task?',
      focus_timer_start_focus: 'Allow the AI host to start this focus timer?',
      focus_timer_start_break: 'Allow the AI host to start a break timer with this duration?',
      focus_timer_pause: 'Allow the AI host to pause the Dayplan timer?',
      focus_timer_resume: 'Allow the AI host to resume the Dayplan timer?',
      focus_timer_set_remaining: 'Allow the AI host to change the timer’s remaining time?',
      focus_timer_end: 'Allow the AI host to end the Dayplan timer and save its active time?',
    }
    return actions[toolName] ?? 'Allow this Dayplan action?'
  }
}
