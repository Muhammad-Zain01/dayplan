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
  upcoming: TodoistTask[]
  recentCompletions: Array<{ date: string; count: number }>
  refreshedAt: string
}

export type FocusSessionKind = 'focus' | 'break'
export type FocusSessionStatus = 'running' | 'paused' | 'completed' | 'ended_early'
export type FocusTimerStatus = 'idle' | FocusSessionStatus

export const FOCUS_TIMER_DURATION_LIMITS = {
  focus: { min: 1, max: 240 },
  break: { min: 1, max: 120 },
} as const

export interface FocusTimerPreferences {
  focusMinutes: number
  breakMinutes: number
}

export const DEFAULT_FOCUS_TIMER_PREFERENCES: FocusTimerPreferences = {
  focusMinutes: 30,
  breakMinutes: 5,
}

export interface FocusTimerSnapshot {
  sessionId: string | null
  workspaceId: string | null
  kind: FocusSessionKind | null
  status: FocusTimerStatus
  targetSeconds: number
  elapsedSeconds: number
  remainingSeconds: number
  updatedAt: string
}

export interface DailyFocusTotal {
  date: string
  seconds: number
}

export interface FocusDashboardMetrics {
  todaySeconds: number
  todayCompletedSessions: number
  recentFocusTime: DailyFocusTotal[]
  refreshedAt: string
}

export type AppSection = 'dashboard' | 'today' | 'tasks' | 'focus' | 'tools' | 'settings'

export type AppearanceMode = 'system' | 'light' | 'dark'

export interface McpHttpStatus {
  enabled: boolean
  running: boolean
  url: string
  error: string | null
}

export interface WorkspaceSummary {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  archivedAt: string | null
  todoistConfigured: boolean
}

export interface OwnerProfile {
  displayName: string | null
}

export interface WorkspaceSetupStatus {
  initialSetupRequired: boolean
  activeWorkspaceId: string
  activeWorkspace: WorkspaceSummary
  ownerProfile: OwnerProfile
}
