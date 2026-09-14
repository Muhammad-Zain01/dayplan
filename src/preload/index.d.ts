import type { AppearanceMode, DashboardMetrics, FocusDashboardMetrics, FocusTimerPreferences, FocusTimerSnapshot, McpHttpStatus, TaskDraft, TaskPatch, TodoistLabel, TodoistProject, TodoistTask } from '../shared/domain'

declare global {
  interface Window {
    dayplan: {
      listTasks(projectId?: string): Promise<TodoistTask[]>
      getTask(taskId: string): Promise<TodoistTask>
      listProjects(): Promise<TodoistProject[]>
      listLabels(): Promise<TodoistLabel[]>
      listCompletedTasks(since: string, until: string): Promise<TodoistTask[]>
      createTask(draft: TaskDraft): Promise<TodoistTask>
      updateTask(taskId: string, patch: TaskPatch): Promise<TodoistTask>
      completeTask(taskId: string): Promise<{ completed: true }>
      reopenTask(taskId: string): Promise<{ reopened: true }>
      deleteTask(taskId: string): Promise<{ deleted: true; subtasks_also_deleted: true }>
      getDashboardMetrics(): Promise<DashboardMetrics>
      getFocusTimerState(): Promise<FocusTimerSnapshot>
      startFocusTimer(minutes: number): Promise<FocusTimerSnapshot>
      startBreakTimer(minutes: number): Promise<FocusTimerSnapshot>
      pauseFocusTimer(): Promise<FocusTimerSnapshot>
      resumeFocusTimer(): Promise<FocusTimerSnapshot>
      setFocusTimerRemaining(minutes: number): Promise<FocusTimerSnapshot>
      endFocusTimer(): Promise<FocusTimerSnapshot>
      getFocusTimerPreferences(): Promise<FocusTimerPreferences>
      setFocusTimerPreferences(preferences: FocusTimerPreferences): Promise<FocusTimerPreferences>
      getFocusDashboardMetrics(days: 7 | 30): Promise<FocusDashboardMetrics>
      onFocusTimerState(listener: (snapshot: FocusTimerSnapshot) => void): () => void
      getAppearance(): Promise<AppearanceMode>
      setAppearance(mode: AppearanceMode): Promise<void>
      getTodoistStatus(): Promise<{ configured: boolean }>
      testNotification(): Promise<{ shown: true }>
      saveTodoistToken(token: string): Promise<void>
      removeTodoistToken(): Promise<void>
      testTodoistConnection(): Promise<{ connected: true }>
      getMcpHttpStatus(): Promise<McpHttpStatus>
      setMcpHttpEnabled(enabled: boolean): Promise<McpHttpStatus>
    }
  }
}

export {}
