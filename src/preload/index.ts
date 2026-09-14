import { contextBridge, ipcRenderer } from 'electron'
import type { AppearanceMode, DashboardMetrics, FocusDashboardMetrics, FocusTimerPreferences, FocusTimerSnapshot, McpHttpStatus, TaskDraft, TaskPatch, TodoistLabel, TodoistProject, TodoistTask } from '../shared/domain'

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
  getFocusTimerState: (): Promise<FocusTimerSnapshot> => ipcRenderer.invoke('focus-timer:get-state'),
  startFocusTimer: (minutes: number): Promise<FocusTimerSnapshot> => ipcRenderer.invoke('focus-timer:start-focus', minutes),
  startBreakTimer: (minutes: number): Promise<FocusTimerSnapshot> => ipcRenderer.invoke('focus-timer:start-break', minutes),
  pauseFocusTimer: (): Promise<FocusTimerSnapshot> => ipcRenderer.invoke('focus-timer:pause'),
  resumeFocusTimer: (): Promise<FocusTimerSnapshot> => ipcRenderer.invoke('focus-timer:resume'),
  setFocusTimerRemaining: (minutes: number): Promise<FocusTimerSnapshot> => ipcRenderer.invoke('focus-timer:set-remaining', minutes),
  endFocusTimer: (): Promise<FocusTimerSnapshot> => ipcRenderer.invoke('focus-timer:end'),
  getFocusTimerPreferences: (): Promise<FocusTimerPreferences> => ipcRenderer.invoke('focus-timer:get-preferences'),
  setFocusTimerPreferences: (preferences: FocusTimerPreferences): Promise<FocusTimerPreferences> => ipcRenderer.invoke('focus-timer:set-preferences', preferences),
  getFocusDashboardMetrics: (days: 7 | 30): Promise<FocusDashboardMetrics> => ipcRenderer.invoke('focus-dashboard:metrics', days),
  onFocusTimerState: (listener: (snapshot: FocusTimerSnapshot) => void): (() => void) => {
    const handleState = (_event: Electron.IpcRendererEvent, snapshot: FocusTimerSnapshot): void => listener(snapshot)
    ipcRenderer.on('focus-timer:state', handleState)
    return () => ipcRenderer.removeListener('focus-timer:state', handleState)
  },
  getAppearance: (): Promise<AppearanceMode> => ipcRenderer.invoke('settings:get-appearance'),
  setAppearance: (mode: AppearanceMode): Promise<void> => ipcRenderer.invoke('settings:set-appearance', mode),
  getTodoistStatus: (): Promise<{ configured: boolean }> => ipcRenderer.invoke('settings:todoist-status'),
  testNotification: (): Promise<{ shown: true }> => ipcRenderer.invoke('settings:test-notification'),
  saveTodoistToken: (token: string): Promise<void> => ipcRenderer.invoke('settings:save-todoist-token', token),
  removeTodoistToken: (): Promise<void> => ipcRenderer.invoke('settings:remove-todoist-token'),
  testTodoistConnection: (): Promise<{ connected: true }> => ipcRenderer.invoke('settings:test-todoist'),
  getMcpHttpStatus: (): Promise<McpHttpStatus> => ipcRenderer.invoke('settings:mcp-http-status'),
  setMcpHttpEnabled: (enabled: boolean): Promise<McpHttpStatus> => ipcRenderer.invoke('settings:set-mcp-http-enabled', enabled),
}

contextBridge.exposeInMainWorld('dayplan', dayplanApi)
