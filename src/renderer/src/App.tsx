import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  CalendarDays, Check, CheckCircle2, CircleHelp, Clock3,
  Bell, Coffee, FolderKanban, LayoutDashboard, ListTodo, LoaderCircle, LogOut, Moon, Monitor, Pause, Play, Plus, RotateCcw, Search, Settings2,
  Server, ShieldCheck, Sun, Target, Timer, TriangleAlert,
} from 'lucide-react'
import { DEFAULT_FOCUS_TIMER_PREFERENCES, FOCUS_TIMER_DURATION_LIMITS, type AppearanceMode, type AppSection, type DashboardMetrics, type FocusDashboardMetrics, type FocusTimerSnapshot, type McpHttpStatus, type TaskDraft, type TaskPatch, type TodoistTask } from '../../shared/domain'
import dayplanLogoDark from '../../../assets/branding/dayplan-logo-dark.svg'
import dayplanLogoLight from '../../../assets/branding/dayplan-logo-light.svg'
import dayplanMarkDark from '../../../assets/branding/dayplan-mark-dark.svg'
import dayplanMarkLight from '../../../assets/branding/dayplan-mark-light.svg'
import { TaskComposer } from './components/TaskComposer'
import { DatePicker } from './components/DatePicker'
import DashboardCompletionChart from './components/DashboardCompletionChart'
import DashboardFocusChart from './components/DashboardFocusChart'
import { TaskRow } from './components/TaskRow'
import { Badge } from './components/ui/badge'
import { Button } from './components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card'
import { Input } from './components/ui/input'

const navigation: Array<{ id: AppSection; label: string; icon: typeof LayoutDashboard }> = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'today', label: 'Today', icon: CalendarDays },
  { id: 'tasks', label: 'Tasks', icon: ListTodo },
  { id: 'focus', label: 'Focus', icon: Timer },
]

const todayKey = (): string => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

const dateKeyOffset = (days: number): string => {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export default function App() {
  const [section, setSection] = useState<AppSection>('dashboard')
  const [configured, setConfigured] = useState(false)
  const [tasks, setTasks] = useState<TodoistTask[]>([])
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null)
  const [focusMetrics, setFocusMetrics] = useState<FocusDashboardMetrics | null>(null)
  const timerIsRunning = useRef(false)
  const [showCompletedTasks, setShowCompletedTasks] = useState(false)
  const [showCompletedToday, setShowCompletedToday] = useState(false)
  const [taskDateFilter, setTaskDateFilter] = useState<string | null>(todayKey)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [appearance, setAppearance] = useState<AppearanceMode>('system')
  const [composerOpen, setComposerOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<TodoistTask | undefined>()
  const [search, setSearch] = useState('')

  const refreshFocusMetrics = useCallback(async (): Promise<void> => {
    setFocusMetrics(await window.dayplan.getFocusDashboardMetrics(30))
  }, [])

  useEffect(() => {
    let active = true
    void window.dayplan.getAppearance()
      .then((mode) => { if (active) setAppearance(mode) })
      .catch(() => { if (active) setAppearance('system') })
    return () => { active = false }
  }, [])

  useEffect(() => {
    let active = true
    const handleTimerState = (snapshot: FocusTimerSnapshot): void => {
      timerIsRunning.current = snapshot.status === 'running'
      if (snapshot.status === 'completed' || snapshot.status === 'ended_early') {
        void refreshFocusMetrics()
          .catch((caught: unknown) => { if (active) setError(caught instanceof Error ? caught.message : 'Focus history could not be refreshed.') })
      }
    }
    const unsubscribe = window.dayplan.onFocusTimerState(handleTimerState)
    void window.dayplan.getFocusTimerState()
      .then((snapshot) => { if (active) handleTimerState(snapshot) })
      .catch((caught: unknown) => { if (active) setError(caught instanceof Error ? caught.message : 'Timer state could not be loaded.') })
    return () => { active = false; unsubscribe() }
  }, [refreshFocusMetrics])

  useEffect(() => {
    const systemTheme = window.matchMedia('(prefers-color-scheme: dark)')
    const applyTheme = (): void => {
      document.documentElement.dataset.theme = appearance === 'system'
        ? systemTheme.matches ? 'dark' : 'light'
        : appearance
    }
    applyTheme()
    if (appearance !== 'system') return
    systemTheme.addEventListener('change', applyTheme)
    return () => systemTheme.removeEventListener('change', applyTheme)
  }, [appearance])

  const refresh = useCallback(async (target: AppSection = section): Promise<void> => {
    setLoading(true)
    setError(null)
    try {
      setFocusMetrics(await window.dayplan.getFocusDashboardMetrics(30))
      const status = await window.dayplan.getTodoistStatus()
      setConfigured(status.configured)
      if (!status.configured) {
        setMetrics(null)
        setTasks([])
        return
      }
      if (target === 'dashboard') setMetrics(await window.dayplan.getDashboardMetrics())
      if (target === 'today') {
        if (showCompletedToday) {
          const now = new Date()
          const since = new Date(now.getFullYear(), now.getMonth(), now.getDate())
          const until = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
          setTasks(await window.dayplan.listCompletedTasks(since.toISOString(), until.toISOString()))
        } else {
          setTasks(await window.dayplan.listTasks())
        }
      }
      if (target === 'tasks') {
        if (showCompletedTasks) {
          const until = new Date()
          const since = new Date(until.getFullYear(), until.getMonth(), until.getDate() - 89)
          setTasks(await window.dayplan.listCompletedTasks(since.toISOString(), until.toISOString()))
        } else {
          setTasks(await window.dayplan.listTasks())
        }
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Dayplan could not load your Todoist data.')
    } finally {
      setLoading(false)
    }
  }, [section, showCompletedTasks, showCompletedToday])

  useEffect(() => { void refresh(section) }, [refresh, section])

  useEffect(() => {
    const interval = setInterval(() => {
      if (!timerIsRunning.current) return
      void refreshFocusMetrics()
        .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : 'Focus history could not be refreshed.'))
    }, 60_000)
    return () => clearInterval(interval)
  }, [refreshFocusMetrics])

  useEffect(() => {
    const handleNavigate = (event: Event): void => {
      const target = (event as CustomEvent<AppSection>).detail
      if (target === 'dashboard' || target === 'today' || target === 'tasks' || target === 'focus' || target === 'settings') navigate(target)
    }
    window.addEventListener('dayplan:navigate', handleNavigate)
    return () => window.removeEventListener('dayplan:navigate', handleNavigate)
  }, [])

  const visibleTasks = useMemo(() => {
    const query = search.trim().toLocaleLowerCase()
    const filtered = tasks.filter((task) => {
      if (section === 'today') {
        if (showCompletedToday) return !query || `${task.content} ${task.description} ${task.labels.join(' ')}`.toLocaleLowerCase().includes(query)
        const due = task.due?.date
        if (!due || due > todayKey()) return false
      }
      if (section === 'tasks' && taskDateFilter && task.due?.date !== taskDateFilter) return false
      return !query || `${task.content} ${task.description} ${task.labels.join(' ')}`.toLocaleLowerCase().includes(query)
    })
    return filtered
  }, [section, search, showCompletedToday, taskDateFilter, tasks])

  async function saveTask(draft: TaskDraft | TaskPatch, taskId?: string): Promise<void> {
    if (taskId) await window.dayplan.updateTask(taskId, draft as TaskPatch)
    else await window.dayplan.createTask(draft as TaskDraft)
    await refresh(section)
  }

  async function completeTask(task: TodoistTask): Promise<void> {
    await window.dayplan.completeTask(task.id)
    await refresh(section)
  }

  async function reopenTask(task: TodoistTask): Promise<void> {
    await window.dayplan.reopenTask(task.id)
    await refresh(section)
  }

  async function deleteTask(task: TodoistTask): Promise<void> {
    const accepted = window.confirm(`Delete “${task.content}”? Todoist will also delete its subtasks.`)
    if (!accepted) return
    await window.dayplan.deleteTask(task.id)
    await refresh(section)
  }

  function openCreateTask(): void {
    setEditingTask(undefined)
    setComposerOpen(true)
  }

  function openEditTask(task: TodoistTask): void {
    setEditingTask(task)
    setComposerOpen(true)
  }

  function navigate(target: AppSection): void {
    setSearch('')
    if (target === 'today') setShowCompletedToday(false)
    setSection(target)
  }

  return (
    <div className="app-shell min-h-screen bg-background text-foreground">
      <aside className="sidebar fixed inset-y-0 left-0 z-20 flex w-[236px] flex-col border-r border-sidebar-border bg-sidebar px-3 py-5 text-sidebar-foreground max-[760px]:w-[72px] max-[760px]:items-center max-[760px]:px-2">
        <div className="px-3 pb-8 max-[760px]:px-0">
          <div className="max-[760px]:hidden">
            <img src={dayplanLogoLight} alt="Dayplan" className="h-12 w-[190px] object-contain object-left dark:hidden" />
            <img src={dayplanLogoDark} alt="Dayplan" className="hidden h-12 w-[190px] object-contain object-left dark:block" />
          </div>
          <div className="hidden max-[760px]:block">
            <img src={dayplanMarkLight} alt="Dayplan" className="h-11 w-11 dark:hidden" />
            <img src={dayplanMarkDark} alt="Dayplan" className="hidden h-11 w-11 dark:block" />
          </div>
        </div>

        <div className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-sidebar-muted max-[760px]:hidden">Workspace</div>
        <nav className="grid gap-1" aria-label="Main navigation">
          {navigation.map((item) => {
            const Icon = item.icon
            const selected = section === item.id
            return <button key={item.id} onClick={() => navigate(item.id)} aria-current={selected ? 'page' : undefined} title={item.label} className={`flex h-10 items-center gap-3 rounded-xl px-3 text-[13px] font-medium transition max-[760px]:w-11 max-[760px]:justify-center max-[760px]:px-0 ${selected ? 'bg-sidebar-active text-sidebar-active-foreground shadow-sm' : 'text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-foreground'}`}>
              <Icon size={17} strokeWidth={1.9} /><span className="max-[760px]:hidden">{item.label}</span>
            </button>
          })}
        </nav>

        <div className="mt-auto grid gap-2">
          <button onClick={() => navigate('settings')} title="Settings" className={`flex h-10 items-center gap-3 rounded-xl px-3 text-[13px] font-medium transition max-[760px]:w-11 max-[760px]:justify-center max-[760px]:px-0 ${section === 'settings' ? 'bg-sidebar-active text-sidebar-active-foreground' : 'text-sidebar-muted hover:bg-sidebar-hover hover:text-sidebar-foreground'}`}>
            <Settings2 size={17} /><span className="max-[760px]:hidden">Settings</span>
          </button>
          <div className="flex items-center gap-3 border-t border-sidebar-border px-2 pt-4 max-[760px]:justify-center max-[760px]:px-0">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#dbe8e6] text-xs font-semibold text-[#386d68] dark:bg-[#293736] dark:text-[#b5d0c9]">Z</div>
            <div className="min-w-0 max-[760px]:hidden"><div className="truncate text-xs font-medium">My workspace</div><div className="text-[10px] text-sidebar-muted">Personal</div></div>
          </div>
        </div>
      </aside>

      <main className="main-content ml-[236px] min-h-screen max-[760px]:ml-[72px]">
        <div className="mx-auto w-full max-w-[1440px] px-8 py-8 max-[760px]:px-4 max-[760px]:py-5">
          {error && <div role="alert" className="mb-5 flex items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300"><span className="flex items-center gap-2"><TriangleAlert size={16} />{error}</span><Button size="sm" variant="outline" onClick={() => void refresh(section)}>Try again</Button></div>}
          {!configured && section !== 'settings' && section !== 'focus' ? <ConnectTodoist onOpenSettings={() => navigate('settings')} /> : section === 'dashboard' ? <DashboardPage metrics={metrics} focusMetrics={focusMetrics} loading={loading} onCreate={openCreateTask} onOpenFocus={() => navigate('focus')} onEdit={openEditTask} onComplete={completeTask} onReopen={reopenTask} onDelete={deleteTask} /> : section === 'focus' ? <FocusTimerPage metrics={focusMetrics} onMetricsRefresh={refreshFocusMetrics} /> : section === 'settings' ? <SettingsPage configured={configured} appearance={appearance} onAppearanceChange={setAppearance} onSaved={() => { setSection('dashboard'); void refresh('dashboard') }} onRemoved={() => { setConfigured(false); setSection('settings') }} /> : <TaskPage section={section} tasks={visibleTasks} loading={loading} search={search} showCompleted={section === 'today' ? showCompletedToday : showCompletedTasks} taskDateFilter={taskDateFilter} onTaskDateChange={setTaskDateFilter} onShowCompleted={section === 'today' ? setShowCompletedToday : setShowCompletedTasks} onSearch={setSearch} onCreate={openCreateTask} onEdit={openEditTask} onComplete={completeTask} onReopen={reopenTask} onDelete={deleteTask} />}
        </div>
      </main>

      <TaskComposer open={composerOpen} task={editingTask} onOpenChange={setComposerOpen} onSave={saveTask} />
    </div>
  )
}

function PageHeading({ title, description, eyebrow }: { title: string; description: string; eyebrow: string }) {
  return <div className="mb-7"><div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">{eyebrow}</div><h1 className="text-[28px] font-semibold tracking-[-0.04em] sm:text-[32px]">{title}</h1><p className="mt-1.5 text-sm text-muted-foreground">{description}</p></div>
}

function DashboardPage({ metrics, focusMetrics, loading, onCreate, onOpenFocus, onEdit, onComplete, onReopen, onDelete }: {
  metrics: DashboardMetrics | null; focusMetrics: FocusDashboardMetrics | null; loading: boolean; onCreate: () => void; onOpenFocus: () => void; onEdit: (task: TodoistTask) => void
  onComplete: (task: TodoistTask) => Promise<void>; onReopen: (task: TodoistTask) => Promise<void>; onDelete: (task: TodoistTask) => Promise<void>
}) {
  const [completionRange, setCompletionRange] = useState<7 | 30>(7)
  const [focusRange, setFocusRange] = useState<7 | 30>(7)
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  const dateText = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date())

  return <>
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div><div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">{dateText}</div><h1 className="text-[28px] font-semibold tracking-[-0.04em] sm:text-[34px]">{greeting}, Zain <span className="inline-block origin-bottom-right animate-wave">✦</span></h1><p className="mt-1.5 text-sm text-muted-foreground">Make today feel a little more manageable.</p></div>
      <Button onClick={onCreate}><Plus size={16} />Plan a task</Button>
    </div>

    <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
      <MetricCard title="Open tasks" value={metrics?.openTasks} caption="Across your Todoist projects" icon={ListTodo} tint="blue" loading={loading} />
      <MetricCard title="Due today" value={metrics?.dueToday} caption="A clear focus for today" icon={Target} tint="violet" loading={loading} />
      <MetricCard title="Overdue" value={metrics?.overdue} caption="Ready for a quick review" icon={Clock3} tint="amber" loading={loading} />
      <MetricCard title="Completed today" value={metrics?.completedToday} caption="Small steps add up" icon={CheckCircle2} tint="green" loading={loading} />
      <DashboardFocusCard todaySeconds={focusMetrics?.todaySeconds ?? 0} />
    </div>

    <div className="mt-5 grid items-stretch gap-5 xl:grid-cols-2">
      <Card className="h-full">
        <CardHeader className="flex-row items-start justify-between gap-3"><div><CardTitle>{completionRange === 7 ? 'Weekly rhythm' : 'Monthly rhythm'}</CardTitle><p className="mt-1 text-xs text-muted-foreground">Tasks completed in the last {completionRange} days</p></div><div role="group" aria-label="Completion chart date range" className="inline-flex shrink-0 rounded-lg border border-border bg-muted/45 p-0.5">{([7, 30] as const).map((days) => <button key={days} type="button" aria-pressed={completionRange === days} onClick={() => setCompletionRange(days)} className={`rounded-md px-2.5 py-1.5 text-[11px] font-medium transition-colors ${completionRange === days ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>{days} days</button>)}</div></CardHeader>
        <CardContent>
          <DashboardCompletionChart metrics={metrics} loading={loading} days={completionRange} />
          <div className="flex items-center gap-2 border-t border-border/60 pt-3 text-[11px] text-muted-foreground"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />Completion history comes directly from Todoist.</div>
        </CardContent>
      </Card>

      <Card className="h-full">
        <CardHeader><div><CardTitle>Coming up</CardTitle><p className="mt-1 text-xs text-muted-foreground">Your next few dated tasks</p></div><button className="text-xs font-medium text-primary hover:underline" onClick={() => window.dispatchEvent(new CustomEvent('dayplan:navigate', { detail: 'tasks' }))}>View all</button></CardHeader>
        <CardContent>
          {loading ? <div className="flex justify-center py-12"><LoaderCircle className="animate-spin text-muted-foreground" size={18} /></div> : metrics?.upcoming.length ? <div className="-mx-2">{metrics.upcoming.slice(0, 3).map((task) => <TaskRow key={task.id} task={task} onComplete={onComplete} onReopen={onReopen} onEdit={onEdit} onDelete={onDelete} />)}</div> : <EmptyState icon={CalendarDays} title="Nothing on the horizon" description="Add a due date to a task and it will show up here." action={onCreate} />}
        </CardContent>
      </Card>
    </div>
    <Card className="mt-5">
      <CardHeader className="flex-row items-start justify-between gap-3">
        <div><CardTitle>Focus time</CardTitle><p className="mt-1 text-xs text-muted-foreground">Time spent in focus sessions over the last {focusRange} days</p></div>
        <div className="flex shrink-0 items-center gap-2">
          <div role="group" aria-label="Focus chart date range" className="inline-flex rounded-lg border border-border bg-muted/45 p-0.5">{([7, 30] as const).map((days) => <button key={days} type="button" aria-pressed={focusRange === days} onClick={() => setFocusRange(days)} className={`rounded-md px-2.5 py-1.5 text-[11px] font-medium transition-colors ${focusRange === days ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>{days} days</button>)}</div>
          <Button size="sm" variant="outline" onClick={onOpenFocus}><Timer size={14} />Focus</Button>
        </div>
      </CardHeader>
      <CardContent><DashboardFocusChart metrics={focusMetrics} loading={loading && !focusMetrics} days={focusRange} /></CardContent>
    </Card>
  </>
}

function FocusTimerPage({ metrics, onMetricsRefresh }: {
  metrics: FocusDashboardMetrics | null
  onMetricsRefresh: () => Promise<void>
}) {
  const [snapshot, setSnapshot] = useState<FocusTimerSnapshot | null>(null)
  const [focusMinutesInput, setFocusMinutesInput] = useState(String(DEFAULT_FOCUS_TIMER_PREFERENCES.focusMinutes))
  const [breakMinutesInput, setBreakMinutesInput] = useState(String(DEFAULT_FOCUS_TIMER_PREFERENCES.breakMinutes))
  const [remainingMinutesInput, setRemainingMinutesInput] = useState('1')
  const [adjustingTime, setAdjustingTime] = useState(false)
  const [preferencesLoaded, setPreferencesLoaded] = useState(false)
  const [range, setRange] = useState<7 | 30>(7)
  const [commandError, setCommandError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let active = true
    let receivedUpdate = false
    const unsubscribe = window.dayplan.onFocusTimerState((nextSnapshot) => {
      receivedUpdate = true
      if (active) setSnapshot(nextSnapshot)
    })
    void window.dayplan.getFocusTimerState()
      .then((currentSnapshot) => {
        if (active && !receivedUpdate) setSnapshot(currentSnapshot)
      })
      .catch((caught: unknown) => {
        if (active) setCommandError(caught instanceof Error ? caught.message : 'Timer state could not be loaded.')
      })
    void window.dayplan.getFocusTimerPreferences()
      .then((preferences) => {
        if (!active) return
        setFocusMinutesInput(String(preferences.focusMinutes))
        setBreakMinutesInput(String(preferences.breakMinutes))
        setPreferencesLoaded(true)
      })
      .catch((caught: unknown) => {
        if (!active) return
        setPreferencesLoaded(true)
        setCommandError(caught instanceof Error ? caught.message : 'Timer preferences could not be loaded.')
      })
    return () => { active = false; unsubscribe() }
  }, [])

  const active = snapshot?.status === 'running' || snapshot?.status === 'paused'
  const progress = snapshot && snapshot.targetSeconds > 0 ? snapshot.elapsedSeconds / snapshot.targetSeconds : 0
  const modeLabel = snapshot?.kind === 'break' ? 'Break' : 'Focus'
  const phaseLabel = snapshot?.status === 'running' ? 'In progress' : snapshot?.status === 'paused' ? 'Paused' : snapshot?.status === 'completed' ? 'Complete' : snapshot?.status === 'ended_early' ? 'Ended early' : 'Ready when you are'
  const focusMinutes = parseTimerMinutes(focusMinutesInput, FOCUS_TIMER_DURATION_LIMITS.focus.max)
  const breakMinutes = parseTimerMinutes(breakMinutesInput, FOCUS_TIMER_DURATION_LIMITS.break.max)
  const remainingMinutes = parseTimerMinutes(remainingMinutesInput, snapshot?.kind === 'break' ? FOCUS_TIMER_DURATION_LIMITS.break.max : FOCUS_TIMER_DURATION_LIMITS.focus.max)

  async function runCommand(command: () => Promise<FocusTimerSnapshot>): Promise<void> {
    setBusy(true)
    setCommandError(null)
    try {
      await command()
    } catch (caught) {
      setCommandError(caught instanceof Error ? caught.message : 'The timer action could not be completed.')
    } finally {
      setBusy(false)
      await onMetricsRefresh()
    }
  }

  async function endTimer(): Promise<void> {
    if (!window.confirm('End this timer now? Active focus time will still be saved.')) return
    await runCommand(() => window.dayplan.endFocusTimer())
  }

  async function saveTimerPreferences(): Promise<{ focusMinutes: number; breakMinutes: number }> {
    if (focusMinutes === null) throw new Error('Focus time must be a whole number from 1 to 240 minutes.')
    if (breakMinutes === null) throw new Error('Break time must be a whole number from 1 to 120 minutes.')
    const preferences = await window.dayplan.setFocusTimerPreferences({ focusMinutes, breakMinutes })
    setFocusMinutesInput(String(preferences.focusMinutes))
    setBreakMinutesInput(String(preferences.breakMinutes))
    return preferences
  }

  function persistDurationPreferences(): void {
    if (!preferencesLoaded || focusMinutes === null || breakMinutes === null) return
    void window.dayplan.setFocusTimerPreferences({ focusMinutes, breakMinutes })
      .catch((caught: unknown) => setCommandError(caught instanceof Error ? caught.message : 'Timer preferences could not be saved.'))
  }

  function beginAdjustingTime(): void {
    if (!snapshot) return
    setRemainingMinutesInput(String(Math.max(1, Math.ceil(snapshot.remainingSeconds / 60))))
    setAdjustingTime(true)
    setCommandError(null)
  }

  async function saveRemainingTime(): Promise<void> {
    if (remainingMinutes === null) {
      setCommandError(`Remaining time must be a whole number from 1 to ${snapshot?.kind === 'break' ? FOCUS_TIMER_DURATION_LIMITS.break.max : FOCUS_TIMER_DURATION_LIMITS.focus.max} minutes.`)
      return
    }
    await runCommand(async () => {
      const nextSnapshot = await window.dayplan.setFocusTimerRemaining(remainingMinutes)
      setAdjustingTime(false)
      return nextSnapshot
    })
  }

  return <>
    <PageHeading eyebrow="Focus workspace" title="Focus timer" description="Choose a block, keep your attention on one thing, and let Dayplan track the time." />
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(300px,0.7fr)]">
      <Card>
        <CardContent className="flex min-h-[440px] flex-col items-center justify-center p-6 text-center sm:p-9">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-muted/55 px-3 py-1.5 text-xs font-medium text-muted-foreground"><span className={`h-2 w-2 rounded-full ${snapshot?.status === 'running' ? 'bg-emerald-500' : snapshot?.status === 'paused' ? 'bg-amber-500' : 'bg-primary/50'}`} />{phaseLabel}{snapshot?.kind ? ` · ${modeLabel}` : ''}</div>
          <div className="relative mb-5 flex h-56 w-56 items-center justify-center">
            <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 220 220" aria-hidden="true">
              <circle cx="110" cy="110" r="94" fill="none" stroke="var(--muted)" strokeWidth="8" />
              <circle cx="110" cy="110" r="94" fill="none" stroke="var(--primary)" strokeWidth="8" strokeLinecap="round" strokeDasharray={590.62} strokeDashoffset={590.62 * (1 - progress)} className="transition-[stroke-dashoffset] duration-500" />
            </svg>
            <div><div className="font-mono text-[48px] font-semibold leading-none tracking-[-0.06em] tabular-nums">{snapshot ? formatTimerClock(snapshot.remainingSeconds) : '--:--'}</div><div className="mt-3 text-xs text-muted-foreground">{snapshot?.status === 'paused' ? 'Paused' : snapshot?.status === 'completed' ? 'Session complete' : snapshot?.status === 'ended_early' ? `${formatFocusDuration(snapshot.elapsedSeconds)} focused` : snapshot?.kind === 'break' ? 'Time to reset' : 'Time to focus'}</div></div>
          </div>
          {active && adjustingTime ? <div className="flex w-full max-w-[400px] flex-col gap-3">
            <label htmlFor="remaining-timer-minutes" className="text-left text-xs font-medium">Remaining minutes
              <Input id="remaining-timer-minutes" type="number" inputMode="numeric" min={1} max={snapshot?.kind === 'break' ? FOCUS_TIMER_DURATION_LIMITS.break.max : FOCUS_TIMER_DURATION_LIMITS.focus.max} step={1} className="mt-1 h-10 w-full" value={remainingMinutesInput} onChange={(event) => setRemainingMinutesInput(event.target.value)} />
              <span className="mt-1 block text-[10px] font-normal text-muted-foreground">1–{snapshot?.kind === 'break' ? FOCUS_TIMER_DURATION_LIMITS.break.max : FOCUS_TIMER_DURATION_LIMITS.focus.max} minutes</span>
            </label>
            <div className="flex justify-center gap-2">
              <Button disabled={busy || remainingMinutes === null} onClick={() => void saveRemainingTime()}>Apply time</Button>
              <Button variant="ghost" disabled={busy} onClick={() => setAdjustingTime(false)}>Cancel</Button>
            </div>
          </div> : active ? <div className="flex flex-wrap justify-center gap-2">
            {snapshot?.status === 'running' ? <Button variant="secondary" disabled={busy} onClick={() => void runCommand(() => window.dayplan.pauseFocusTimer())}><Pause size={15} />Pause</Button> : <Button disabled={busy} onClick={() => void runCommand(() => window.dayplan.resumeFocusTimer())}><Play size={15} />Resume</Button>}
            <Button variant="outline" disabled={busy} onClick={beginAdjustingTime}><Timer size={15} />Adjust time</Button>
            <Button variant="outline" disabled={busy} onClick={() => void endTimer()}><RotateCcw size={15} />End session</Button>
          </div> : <div className="flex w-full max-w-[560px] flex-col items-center gap-4">
            <div className="grid w-full grid-cols-1 gap-3 text-left sm:grid-cols-2">
              <label htmlFor="focus-duration-minutes" className="text-xs font-medium">Focus duration (minutes)
                <Input id="focus-duration-minutes" type="number" inputMode="numeric" min={FOCUS_TIMER_DURATION_LIMITS.focus.min} max={FOCUS_TIMER_DURATION_LIMITS.focus.max} step={1} className="mt-1" value={focusMinutesInput} onChange={(event) => setFocusMinutesInput(event.target.value)} onBlur={persistDurationPreferences} />
                <span className="mt-1 block text-[10px] font-normal text-muted-foreground">1–240 minutes</span>
              </label>
              <label htmlFor="break-duration-minutes" className="text-xs font-medium">Break duration (minutes)
                <Input id="break-duration-minutes" type="number" inputMode="numeric" min={FOCUS_TIMER_DURATION_LIMITS.break.min} max={FOCUS_TIMER_DURATION_LIMITS.break.max} step={1} className="mt-1" value={breakMinutesInput} onChange={(event) => setBreakMinutesInput(event.target.value)} onBlur={persistDurationPreferences} />
                <span className="mt-1 block text-[10px] font-normal text-muted-foreground">1–120 minutes</span>
              </label>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              <Button disabled={busy || !snapshot || !preferencesLoaded || focusMinutes === null || breakMinutes === null} onClick={() => void runCommand(async () => {
                const preferences = await saveTimerPreferences()
                return window.dayplan.startFocusTimer(preferences.focusMinutes)
              })}><Timer size={15} />Start {focusMinutes ?? '—'} min focus</Button>
              <Button variant="secondary" disabled={busy || !snapshot || !preferencesLoaded || focusMinutes === null || breakMinutes === null} onClick={() => void runCommand(async () => {
                const preferences = await saveTimerPreferences()
                return window.dayplan.startBreakTimer(preferences.breakMinutes)
              })}><Coffee size={15} />Start {breakMinutes ?? '—'} min break</Button>
            </div>
          </div>}
          <p className="mt-5 max-w-md text-xs leading-5 text-muted-foreground">The timer keeps running when you close the window. Closing Dayplan from the tray ends the active session and saves its focused time.</p>
          {commandError && <div role="alert" className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">{commandError}</div>}
        </CardContent>
      </Card>

      <div className="grid gap-4 content-start">
        <MetricCard title="Focus time today" value={formatFocusDuration(metrics?.todaySeconds ?? 0)} caption="Breaks are not included" icon={Clock3} tint="teal" loading={metrics === null} />
        <MetricCard title="Completed focus sessions" value={metrics?.todayCompletedSessions ?? 0} caption="Completed today" icon={CheckCircle2} tint="green" loading={metrics === null} />
      </div>
    </div>
    <Card className="mt-5">
      <CardHeader className="flex-row items-start justify-between gap-3"><div><CardTitle>Daily focus history</CardTitle><p className="mt-1 text-xs text-muted-foreground">Actual focus time per day</p></div><div role="group" aria-label="Focus history date range" className="inline-flex shrink-0 rounded-lg border border-border bg-muted/45 p-0.5">{([7, 30] as const).map((days) => <button key={days} type="button" aria-pressed={range === days} onClick={() => setRange(days)} className={`rounded-md px-2.5 py-1.5 text-[11px] font-medium transition-colors ${range === days ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>{days} days</button>)}</div></CardHeader>
      <CardContent><DashboardFocusChart metrics={metrics} loading={metrics === null} days={range} /><div className="flex items-center gap-2 border-t border-border/60 pt-3 text-[11px] text-muted-foreground"><span className="h-1.5 w-1.5 rounded-full bg-primary" />Only active focus minutes count; breaks and paused time are excluded.</div></CardContent>
    </Card>
  </>
}

function formatFocusDuration(seconds: number): string {
  const totalMinutes = Math.floor(seconds / 60)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours === 0) return `${minutes}m`
  return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`
}

function formatTimerClock(seconds: number): string {
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`
}

function parseTimerMinutes(value: string, maximum: number): number | null {
  const minutes = Number(value)
  return Number.isInteger(minutes) && minutes >= 1 && minutes <= maximum ? minutes : null
}

function DashboardFocusCard({ todaySeconds }: { todaySeconds: number }) {
  const [snapshot, setSnapshot] = useState<FocusTimerSnapshot | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    let receivedUpdate = false
    const unsubscribe = window.dayplan.onFocusTimerState((nextSnapshot) => {
      receivedUpdate = true
      if (active) setSnapshot(nextSnapshot)
    })
    void window.dayplan.getFocusTimerState()
      .then((currentSnapshot) => {
        if (active && !receivedUpdate) setSnapshot(currentSnapshot)
      })
      .catch((caught: unknown) => {
        if (active) setError(caught instanceof Error ? caught.message : 'Timer state could not be loaded.')
      })
    return () => { active = false; unsubscribe() }
  }, [])

  const running = snapshot?.status === 'running'
  const paused = snapshot?.status === 'paused'
  const active = running || paused
  const kindLabel = snapshot?.kind === 'break' ? 'Break' : 'Focus'
  const stateLabel = running
    ? `${kindLabel} · ${formatTimerClock(snapshot?.remainingSeconds ?? 0)} remaining`
    : paused
      ? `${kindLabel} paused · ${formatTimerClock(snapshot?.remainingSeconds ?? 0)} left`
      : snapshot?.status === 'completed'
        ? `${kindLabel} complete`
        : snapshot?.status === 'ended_early'
          ? `${kindLabel} ended`
          : snapshot
            ? 'Ready for a focus block'
            : 'Checking timer…'

  async function runAction(action: () => Promise<FocusTimerSnapshot>): Promise<void> {
    setBusy(true)
    setError(null)
    try {
      await action()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The timer action could not be completed.')
    } finally {
      setBusy(false)
    }
  }

  return <Card className="min-w-0">
    <CardContent className="p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <div className="truncate text-xs font-medium text-muted-foreground">Focus today</div>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300"><Timer size={16} /></div>
      </div>
      <div className="mt-3 text-[27px] font-semibold leading-none tracking-[-0.04em]">{formatFocusDuration(todaySeconds)}</div>
      <div className="mt-2 flex min-w-0 items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5 truncate text-[10px] text-muted-foreground sm:text-[11px]" aria-live="off">
          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${running ? 'bg-emerald-500' : paused ? 'bg-amber-500' : 'bg-primary/50'}`} />
          <span className="truncate">{stateLabel}</span>
        </div>
        {active ? <Button size="sm" variant={running ? 'secondary' : 'default'} className="h-7 shrink-0 px-2.5 text-[11px]" disabled={busy} aria-label={running ? 'Pause focus timer' : 'Resume focus timer'} onClick={() => void runAction(() => running ? window.dayplan.pauseFocusTimer() : window.dayplan.resumeFocusTimer())}>
          {running ? <Pause size={12} /> : <Play size={12} />}{running ? 'Pause' : 'Resume'}
        </Button> : <div className="flex shrink-0 items-center gap-1">
          <Button size="sm" className="h-7 px-2 text-[11px]" disabled={busy || !snapshot} aria-label="Start 30-minute focus timer" onClick={() => void runAction(() => window.dayplan.startFocusTimer(30))}>30m</Button>
          <Button size="sm" variant="outline" className="h-7 px-2 text-[11px]" disabled={busy || !snapshot} aria-label="Start 60-minute focus timer" onClick={() => void runAction(() => window.dayplan.startFocusTimer(60))}>60m</Button>
        </div>}
      </div>
      {error && <p role="alert" className="mt-2 text-[10px] leading-4 text-rose-600 dark:text-rose-300">{error}</p>}
    </CardContent>
  </Card>
}

function MetricCard({ title, value, caption, icon: Icon, tint, loading }: { title: string; value?: number | string; caption: string; icon: typeof ListTodo; tint: string; loading: boolean }) {
  const tones: Record<string, string> = { blue: 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-300', violet: 'bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-300', amber: 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-300', green: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300', teal: 'bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300' }
  return <Card className="min-w-0"><CardContent className="p-4 sm:p-5"><div className="flex items-center justify-between gap-2"><div className="truncate text-xs font-medium text-muted-foreground">{title}</div><div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${tones[tint]}`}><Icon size={16} /></div></div><div className="mt-3 text-[27px] font-semibold leading-none tracking-[-0.04em]">{loading ? <span className="inline-block h-7 w-10 animate-pulse rounded bg-muted align-middle" /> : value ?? 0}</div><div className="mt-2 truncate text-[10px] text-muted-foreground sm:text-[11px]">{caption}</div></CardContent></Card>
}

function TaskPage({ section, tasks, loading, search, showCompleted, taskDateFilter, onTaskDateChange, onShowCompleted, onSearch, onCreate, onEdit, onComplete, onReopen, onDelete }: {
  section: AppSection; tasks: TodoistTask[]; loading: boolean; search: string; showCompleted: boolean; taskDateFilter: string | null; onTaskDateChange: (value: string | null) => void; onShowCompleted: (value: boolean) => void; onSearch: (value: string) => void; onCreate: () => void
  onEdit: (task: TodoistTask) => void; onComplete: (task: TodoistTask) => Promise<void>; onReopen: (task: TodoistTask) => Promise<void>; onDelete: (task: TodoistTask) => Promise<void>
}) {
  const isToday = section === 'today'
  const listTitle = isToday ? showCompleted ? 'Today completed' : 'Today todos' : showCompleted ? 'Recently completed' : 'Todoist tasks'
  const countDescription = loading ? 'Syncing with Todoist…' : isToday ? showCompleted ? `${tasks.length} tasks completed today` : `${tasks.length} tasks due today or earlier` : showCompleted ? `${tasks.length} completed in the last 90 days` : `${tasks.length} active tasks`
  return <>
    <PageHeading eyebrow={isToday ? 'Your day' : 'Task manager'} title={isToday ? 'Today' : 'All tasks'} description={isToday ? 'A calm, focused view of what is due today and what is already behind.' : 'Keep every task, next step, and small detail in one place.'} />
    <Card>
      <CardHeader className="flex-wrap items-center"><div><CardTitle>{listTitle}</CardTitle><p className="mt-1 text-xs text-muted-foreground">{countDescription}</p></div><div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">{<div role="group" aria-label={isToday ? 'Today task status' : 'Task status'} className="flex rounded-lg border border-border bg-muted/40 p-0.5"><button type="button" aria-pressed={!showCompleted} className={`rounded-md px-2.5 py-1.5 text-[11px] font-medium ${!showCompleted ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`} onClick={() => onShowCompleted(false)}>{isToday ? 'Today todos' : 'Active'}</button><button type="button" aria-pressed={showCompleted} className={`rounded-md px-2.5 py-1.5 text-[11px] font-medium ${showCompleted ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`} onClick={() => onShowCompleted(true)}>{isToday ? 'Today completed' : 'Completed'}</button></div>}{!isToday && <><div role="group" aria-label="Filter tasks by due date" className="flex rounded-lg border border-border bg-muted/40 p-0.5"><button type="button" aria-pressed={taskDateFilter === todayKey()} className={`rounded-md px-2 py-1.5 text-[11px] font-medium ${taskDateFilter === todayKey() ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`} onClick={() => onTaskDateChange(todayKey())}>Today</button><button type="button" aria-pressed={taskDateFilter === dateKeyOffset(1)} className={`rounded-md px-2 py-1.5 text-[11px] font-medium ${taskDateFilter === dateKeyOffset(1) ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`} onClick={() => onTaskDateChange(dateKeyOffset(1))}>Tomorrow</button><button type="button" aria-pressed={taskDateFilter === null} className={`rounded-md px-2 py-1.5 text-[11px] font-medium ${taskDateFilter === null ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`} onClick={() => onTaskDateChange(null)}>All dates</button></div><DatePicker compact side="bottom" showShortcuts={false} value={taskDateFilter ?? ''} onChange={(value) => onTaskDateChange(value || null)} /></>}<div className="flex min-w-0 flex-1 gap-2 sm:w-auto"><div className="relative flex-1 sm:w-56"><Search size={15} className="absolute left-3 top-2.5 text-muted-foreground" /><Input aria-label="Search tasks" className="h-9 pl-9" placeholder="Search tasks" value={search} onChange={(event) => onSearch(event.target.value)} /></div>{!showCompleted && <Button size="sm" onClick={onCreate}><Plus size={14} />Add</Button>}</div></div></CardHeader>
      <CardContent>
        {loading ? <div className="flex justify-center py-16 text-sm text-muted-foreground"><LoaderCircle className="mr-2 animate-spin" size={16} />Loading tasks from Todoist…</div> : tasks.length ? <div className="divide-y divide-border/60">{tasks.map((task) => <TaskRow key={task.id} task={task} onComplete={onComplete} onReopen={onReopen} onEdit={onEdit} onDelete={onDelete} />)}</div> : <EmptyState icon={isToday ? showCompleted ? CheckCircle2 : CalendarDays : ListTodo} title={search ? 'No matching tasks' : isToday ? showCompleted ? 'Nothing completed today' : 'A little breathing room' : 'Your list is clear'} description={search ? 'Try a different search.' : isToday ? showCompleted ? 'Tasks you complete today will appear here.' : 'No tasks are due today. You have room to plan ahead.' : 'Create a task when something needs your attention.'} action={search || (isToday && showCompleted) ? undefined : onCreate} />}
      </CardContent>
    </Card>
  </>
}

function SettingsPage({ configured, appearance, onAppearanceChange, onSaved, onRemoved }: {
  configured: boolean
  appearance: AppearanceMode
  onAppearanceChange: (mode: AppearanceMode) => void
  onSaved: () => void
  onRemoved: () => void
}) {
  const [token, setToken] = useState('')
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [appearanceSaving, setAppearanceSaving] = useState(false)
  const [appearanceError, setAppearanceError] = useState<string | null>(null)
  const [notificationTesting, setNotificationTesting] = useState(false)
  const [notificationStatus, setNotificationStatus] = useState<string | null>(null)
  const [notificationError, setNotificationError] = useState<string | null>(null)
  const [mcpStatus, setMcpStatus] = useState<McpHttpStatus | null>(null)
  const [mcpLoading, setMcpLoading] = useState(true)
  const [mcpSaving, setMcpSaving] = useState(false)
  const [mcpError, setMcpError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    void window.dayplan.getMcpHttpStatus()
      .then((current) => { if (active) setMcpStatus(current) })
      .catch((caught: unknown) => { if (active) setMcpError(caught instanceof Error ? caught.message : 'MCP server status could not be loaded.') })
      .finally(() => { if (active) setMcpLoading(false) })
    return () => { active = false }
  }, [])

  async function changeAppearance(mode: AppearanceMode): Promise<void> {
    if (mode === appearance) return
    setAppearanceSaving(true)
    setAppearanceError(null)
    try {
      await window.dayplan.setAppearance(mode)
      onAppearanceChange(mode)
    } catch (caught) {
      setAppearanceError(caught instanceof Error ? caught.message : 'Appearance could not be saved.')
    } finally {
      setAppearanceSaving(false)
    }
  }

  async function testNotification(): Promise<void> {
    setNotificationTesting(true)
    setNotificationStatus(null)
    setNotificationError(null)
    try {
      await window.dayplan.testNotification()
      setNotificationStatus('The operating system confirmed the test notification.')
    } catch (caught) {
      setNotificationError(caught instanceof Error ? caught.message : 'The test notification could not be shown.')
    } finally {
      setNotificationTesting(false)
    }
  }

  async function changeMcpEnabled(enabled: boolean): Promise<void> {
    setMcpSaving(true)
    setMcpError(null)
    try {
      const nextStatus = await window.dayplan.setMcpHttpEnabled(enabled)
      setMcpStatus(nextStatus)
      setMcpError(nextStatus.error)
    } catch (caught) {
      setMcpError(caught instanceof Error ? caught.message : 'The MCP server setting could not be changed.')
    } finally {
      setMcpSaving(false)
    }
  }

  async function save(): Promise<void> {
    setSaving(true); setError(null); setStatus(null)
    try { await window.dayplan.saveTodoistToken(token); setToken(''); setStatus('Todoist token saved on this device.'); onSaved() }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'The token could not be saved.') }
    finally { setSaving(false) }
  }

  async function testConnection(): Promise<void> {
    setTesting(true); setError(null); setStatus(null)
    try { await window.dayplan.testTodoistConnection(); setStatus('Connected to Todoist. Your tasks are ready to sync.') }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not connect to Todoist.') }
    finally { setTesting(false) }
  }

  async function removeToken(): Promise<void> {
    if (!window.confirm('Remove the saved Todoist API token from this device?')) return
    setError(null); setStatus(null)
    try {
      await window.dayplan.removeTodoistToken()
      setStatus('Todoist token removed from this device.')
      onRemoved()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The token could not be removed.')
    }
  }

  return <>
    <PageHeading eyebrow="Preferences" title="Settings" description="Make Dayplan feel right for you and manage your connection." />
    <Card className="mb-5 max-w-[760px]">
      <CardHeader><div><CardTitle className="flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary"><Sun size={15} /></span>Appearance</CardTitle><p className="mt-2 max-w-xl text-xs leading-5 text-muted-foreground">Choose how Dayplan looks on this device.</p></div></CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-3 max-[520px]:grid-cols-1" role="group" aria-label="Appearance mode">
          {([
            { mode: 'system', label: 'System', detail: 'Follow your device', icon: Monitor },
            { mode: 'light', label: 'Light', detail: 'Bright and clear', icon: Sun },
            { mode: 'dark', label: 'Dark', detail: 'Easy on the eyes', icon: Moon },
          ] as const).map(({ mode, label, detail, icon: Icon }) => {
            const selected = appearance === mode
            return <button key={mode} type="button" aria-pressed={selected} disabled={appearanceSaving} onClick={() => void changeAppearance(mode)} className={`flex min-h-[82px] items-center gap-3 rounded-xl border p-3 text-left transition disabled:cursor-wait disabled:opacity-70 ${selected ? 'border-primary bg-accent/70 ring-1 ring-primary/20' : 'border-border/70 bg-card hover:bg-muted/40'}`}>
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${selected ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}><Icon size={17} /></span>
              <span className="min-w-0"><span className="block text-xs font-semibold">{label}</span><span className="mt-1 block text-[11px] text-muted-foreground">{detail}</span></span>
              {selected && <Check size={15} className="ml-auto shrink-0 text-primary" />}
            </button>
          })}
        </div>
        {appearanceError && <p role="alert" className="mt-3 text-xs text-rose-600 dark:text-rose-300">{appearanceError}</p>}
      </CardContent>
    </Card>
    <Card className="mb-5 max-w-[760px]">
      <CardHeader><div><CardTitle className="flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary"><Bell size={15} /></span>Notifications</CardTitle><p className="mt-2 max-w-xl text-xs leading-5 text-muted-foreground">Focus and break timers show a notification and play an alert sound when they finish.</p></div></CardHeader>
      <CardContent>
        <Button size="sm" variant="secondary" disabled={notificationTesting} onClick={() => void testNotification()}>{notificationTesting ? <LoaderCircle size={14} className="animate-spin" /> : <Bell size={14} />}{notificationTesting ? 'Sending…' : 'Test notification and sound'}</Button>
        {(notificationStatus || notificationError) && <div role={notificationError ? 'alert' : 'status'} className={`mt-3 rounded-xl px-3 py-2.5 text-xs ${notificationError ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-300' : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300'}`}>{notificationError ?? notificationStatus}</div>}
      </CardContent>
    </Card>
    <Card className="mb-5 max-w-[760px]">
      <CardHeader className="flex-wrap items-center"><div><CardTitle className="flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300"><Server size={15} /></span>Local MCP server</CardTitle><p className="mt-2 max-w-xl text-xs leading-5 text-muted-foreground">Connect Codex to Dayplan over Streamable HTTP while this app is open.</p></div><Badge className={mcpStatus?.running ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300' : ''}><span className={`mr-1.5 h-1.5 w-1.5 rounded-full ${mcpStatus?.running ? 'bg-emerald-500' : 'bg-slate-400'}`} />{mcpLoading ? 'Checking…' : mcpStatus?.running ? 'Running' : mcpStatus?.enabled ? 'Unavailable' : 'Off'}</Badge></CardHeader>
      <CardContent>
        <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-border/70 bg-card p-3.5">
          <span><span className="block text-xs font-semibold">Enable local MCP access</span><span className="mt-1 block text-[11px] leading-5 text-muted-foreground">Starts automatically with Dayplan when enabled. The preference is remembered.</span></span>
          <input aria-label="Enable local MCP server" type="checkbox" className="h-4 w-4 accent-primary" checked={mcpStatus?.enabled ?? false} disabled={mcpLoading || mcpSaving || !mcpStatus} onChange={(event) => void changeMcpEnabled(event.target.checked)} />
        </label>
        <div className="mt-3 rounded-xl border border-border/70 bg-muted/30 p-3.5">
          <p className="text-[11px] font-semibold">Endpoint URL</p>
          <code className="mt-1 block select-all break-all text-xs text-muted-foreground">{mcpStatus?.url ?? 'http://127.0.0.1:47631/mcp'}</code>
        </div>
        <p className="mt-3 text-[11px] leading-5 text-muted-foreground">The endpoint listens only on this computer and has no authentication. Other local applications can read your Todoist task data. Every change still requires approval in Dayplan.</p>
        {mcpError && <p role="alert" className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">{mcpError}</p>}
      </CardContent>
    </Card>
    <Card className="max-w-[760px]">
      <CardHeader><div><CardTitle className="flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-300"><CheckCircle2 size={15} /></span>Todoist connection</CardTitle><p className="mt-2 max-w-xl text-xs leading-5 text-muted-foreground">Connect your Todoist account to sync tasks, projects, priorities, and due dates. Your token stays on this computer.</p></div><Badge className={configured ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300' : ''}><span className={`mr-1.5 h-1.5 w-1.5 rounded-full ${configured ? 'bg-emerald-500' : 'bg-slate-400'}`} />{configured ? 'Connected' : 'Not connected'}</Badge></CardHeader>
      <CardContent>
        <label htmlFor="todoist-token" className="mb-2 block text-xs font-semibold">Todoist API token</label>
        <div className="flex flex-col gap-2 sm:flex-row"><Input id="todoist-token" type="password" autoComplete="off" placeholder={configured ? 'Paste a new token to replace the saved one' : 'Paste your API token'} value={token} onChange={(event) => setToken(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && token.trim()) void save() }} /><Button disabled={saving || !token.trim()} onClick={() => void save()}>{saving ? <LoaderCircle size={15} className="animate-spin" /> : null}{saving ? 'Saving…' : configured ? 'Replace token' : 'Save token'}</Button></div>
        <p className="mt-2 text-[11px] leading-5 text-muted-foreground">Find the token in Todoist → Settings → Integrations → Developer. It is saved in this app’s local SQLite settings.</p>
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border/70 pt-4">
          <Button size="sm" variant="secondary" disabled={!configured || testing} onClick={() => void testConnection()}>{testing ? <LoaderCircle size={14} className="animate-spin" /> : <ShieldCheck size={14} />}{testing ? 'Checking…' : 'Test connection'}</Button>
          {configured && <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={() => void removeToken()}><LogOut size={14} />Remove token</Button>}
        </div>
        {(status || error) && <div role={error ? 'alert' : 'status'} className={`mt-4 rounded-xl px-3 py-2.5 text-xs ${error ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-300' : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300'}`}>{error ?? status}</div>}
      </CardContent>
    </Card>
  </>
}

function ConnectTodoist({ onOpenSettings }: { onOpenSettings: () => void }) {
  return <div className="mx-auto flex min-h-[65vh] max-w-lg flex-col items-center justify-center text-center"><div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#e6f0ed] text-[#4b8277] dark:bg-[#263a35] dark:text-[#a9cfc2]"><FolderKanban size={25} /></div><Badge className="mb-4 border-primary/15 bg-primary/5 text-primary">First, connect Todoist</Badge><h1 className="text-3xl font-semibold tracking-[-0.04em]">Your day, in one place.</h1><p className="mt-3 max-w-sm text-sm leading-6 text-muted-foreground">Connect your Todoist account and Dayplan will bring your tasks, priorities, and due dates into a calmer workspace.</p><Button className="mt-6" onClick={onOpenSettings}><Plus size={15} />Connect Todoist</Button></div>
}

function EmptyState({ icon: Icon, title, description, action }: { icon: typeof CircleHelp; title: string; description: string; action?: () => void }) {
  return <div className="flex flex-col items-center px-4 py-12 text-center"><div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-muted-foreground"><Icon size={19} /></div><div className="text-sm font-semibold">{title}</div><p className="mt-1 max-w-xs text-xs leading-5 text-muted-foreground">{description}</p>{action && <Button className="mt-4" size="sm" variant="outline" onClick={action}><Plus size={14} />Add a task</Button>}</div>
}
