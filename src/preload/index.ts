import { contextBridge, ipcRenderer } from 'electron'
import type { AppearanceMode, DashboardMetrics, TaskDraft, TaskPatch, TodoistLabel, TodoistProject, TodoistTask } from '../shared/domain'

const dayplanApi = {
  listTasks: (projectId?: string): Promise<TodoistTask[]> => ipcRenderer.invoke('tasks:list', projectId ? { project_id: projectId } : {}),
  getTask: (taskId: string): Promise<TodoistTask> => ipcRenderer.invoke('tasks:get', taskId),
  listProjects: (): Promise<TodoistProject[]> => ipcRenderer.invoke('tasks:projects'),
  listLabels: (): Promise<TodoistLabel[]> => ipcRenderer.invoke('tasks:labels'),
  listCompletedTasks: (since: string, until: string): Promise<TodoistTask[]> => ipcRenderer.invoke('tasks:completed', { since, until }),
  createTask: (draft: TaskDraft): Promise<TodoistTask> => ipcRenderer.invoke('tasks:create', draft),
  updateTask: (taskId: string, patch: TaskPatch): Promise<TodoistTask> => ipcRenderer.invoke('tasks:update', { task_id: taskId, ...patch }),
  completeTask: (taskId: string): Promise<{ completed: true }> => ipcRenderer.invoke('tasks:complete', taskId),
  reopenTask: (taskId: string): Promise<{ reopened: true }> => ipcRenderer.invoke('tasks:reopen', taskId),
  deleteTask: (taskId: string): Promise<{ deleted: true; subtasks_also_deleted: true }> => ipcRenderer.invoke('tasks:delete', taskId),
  getDashboardMetrics: (): Promise<DashboardMetrics> => ipcRenderer.invoke('dashboard:metrics'),
  getAppearance: (): Promise<AppearanceMode> => ipcRenderer.invoke('settings:get-appearance'),
  setAppearance: (mode: AppearanceMode): Promise<void> => ipcRenderer.invoke('settings:set-appearance', mode),
  getTodoistStatus: (): Promise<{ configured: boolean }> => ipcRenderer.invoke('settings:todoist-status'),
  saveTodoistToken: (token: string): Promise<void> => ipcRenderer.invoke('settings:save-todoist-token', token),
  removeTodoistToken: (): Promise<void> => ipcRenderer.invoke('settings:remove-todoist-token'),
  testTodoistConnection: (): Promise<{ connected: true }> => ipcRenderer.invoke('settings:test-todoist'),
}

contextBridge.exposeInMainWorld('dayplan', dayplanApi)
