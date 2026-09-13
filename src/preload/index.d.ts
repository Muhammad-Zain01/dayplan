import type { DashboardMetrics, TaskDraft, TaskPatch, TodoistLabel, TodoistProject, TodoistTask } from '../shared/domain'

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
      getTodoistStatus(): Promise<{ configured: boolean }>
      saveTodoistToken(token: string): Promise<void>
      removeTodoistToken(): Promise<void>
      testTodoistConnection(): Promise<{ connected: true }>
    }
  }
}

export {}
