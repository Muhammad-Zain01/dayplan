import { beforeEach, describe, expect, it, vi } from 'vitest'

const { showMessageBox } = vi.hoisted(() => ({ showMessageBox: vi.fn() }))

vi.mock('electron', () => ({ dialog: { showMessageBox } }))

import { TodoistDeleteApprovalService } from './TodoistDeleteApprovalService'

describe('TodoistDeleteApprovalService', () => {
  beforeEach(() => {
    showMessageBox.mockReset().mockResolvedValue({ response: 1 })
  })

  it('explains that deleting a Todoist task also deletes its subtasks', async () => {
    await new TodoistDeleteApprovalService().confirmTaskDeletion('task-1')

    expect(showMessageBox).toHaveBeenCalledWith(expect.objectContaining({
      type: 'warning',
      message: 'Permanently delete this Todoist task?',
      detail: expect.stringContaining('Todoist will also delete all subtasks.'),
      buttons: ['Delete task', 'Cancel'],
      defaultId: 1,
      cancelId: 1,
    }))
  })

  it('returns true only when the user confirms deletion', async () => {
    showMessageBox.mockResolvedValueOnce({ response: 0 })

    await expect(new TodoistDeleteApprovalService().confirmTaskDeletion('task-1')).resolves.toBe(true)
    await expect(new TodoistDeleteApprovalService().confirmTaskDeletion('task-2')).resolves.toBe(false)
  })
})
