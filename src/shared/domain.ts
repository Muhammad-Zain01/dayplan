export interface TodoistTask {
  id: string
  content: string
  description: string
  project_id: string | null
  labels: string[]
  priority: number
  due: { date: string; datetime?: string | null; string?: string | null } | null
  is_completed?: boolean
  completed_at?: string | null
}

export interface TodoistProject {
  id: string
  name: string
  is_inbox_project: boolean
  color?: string
}

export interface TodoistLabel {
  id?: string
  name: string
  color?: string
}

export interface TaskDraft {
  content: string
  description?: string
  project_id?: string | null
  due_date?: string | null
  priority?: number
  labels?: string[]
}

export interface TaskPatch {
  content?: string
  description?: string
  due_date?: string | null
  priority?: number
  labels?: string[]
}

export interface DashboardMetrics {
  openTasks: number
  dueToday: number
  overdue: number
  completedToday: number
  priorityCounts: Array<{ priority: number; count: number }>
  upcoming: TodoistTask[]
  recentCompletions: Array<{ date: string; count: number }>
  refreshedAt: string
}

export type AppSection = 'dashboard' | 'today' | 'tasks' | 'settings'

export type AppearanceMode = 'system' | 'light' | 'dark'
