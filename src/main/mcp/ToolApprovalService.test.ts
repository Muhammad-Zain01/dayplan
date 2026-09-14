import { beforeEach, describe, expect, it, vi } from 'vitest'

const { showMessageBox } = vi.hoisted(() => ({ showMessageBox: vi.fn() }))

vi.mock('electron', () => ({ dialog: { showMessageBox } }))

import { ToolApprovalService } from './ToolApprovalService'

describe('ToolApprovalService', () => {
  beforeEach(() => {
    showMessageBox.mockReset().mockResolvedValue({ response: 1 })
  })

  it('explains that deleting a Todoist task also deletes its subtasks', async () => {
    await new ToolApprovalService().requestApproval('todoist_delete_task', { task_id: 'task-1' })

    expect(showMessageBox).toHaveBeenCalledWith(expect.objectContaining({
      type: 'warning',
      message: 'Permanently delete this Todoist task?',
      detail: expect.stringContaining('Todoist will also delete all subtasks.'),
      defaultId: 1,
      cancelId: 1,
    }))
  })
})
