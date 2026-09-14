import { dialog } from 'electron'

export class TodoistDeleteApprovalService {
  async confirmTaskDeletion(taskId: string): Promise<boolean> {
    const result = await dialog.showMessageBox({
      type: 'warning',
      title: 'Delete Todoist task',
      message: 'Permanently delete this Todoist task?',
      detail: `Task ID: ${taskId}\n\nTodoist will also delete all subtasks.`,
      buttons: ['Delete task', 'Cancel'],
      defaultId: 1,
      cancelId: 1,
      noLink: true,
    })
    return result.response === 0
  }
}
