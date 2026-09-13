import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  CalendarDays, Check, CheckCircle2, CircleHelp, Clock3,
  FolderKanban, LayoutDashboard, ListTodo, LoaderCircle, LogOut, Moon, Monitor, Plus, Search, Settings2,
  ShieldCheck, Sun, Target, TriangleAlert,
} from 'lucide-react'
import type { AppearanceMode, AppSection, DashboardMetrics, TaskDraft, TaskPatch, TodoistTask } from '../../shared/domain'
import dayplanLogoDark from '../../../assets/branding/dayplan-logo-dark.svg'
import dayplanLogoLight from '../../../assets/branding/dayplan-logo-light.svg'
import dayplanMarkDark from '../../../assets/branding/dayplan-mark-dark.svg'
import dayplanMarkLight from '../../../assets/branding/dayplan-mark-light.svg'
import { TaskComposer } from './components/TaskComposer'
import DashboardCompletionChart from './components/DashboardCompletionChart'
import { TaskRow } from './components/TaskRow'
import { Badge } from './components/ui/badge'
import { Button } from './components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card'
import { Input } from './components/ui/input'

const navigation: Array<{ id: AppSection; label: string; icon: typeof LayoutDashboard }> = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'today', label: 'Today', icon: CalendarDays },
  { id: 'tasks', label: 'Tasks', icon: ListTodo },
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
  const [showCompletedTasks, setShowCompletedTasks] = useState(false)
  const [showCompletedToday, setShowCompletedToday] = useState(false)
  const [taskDateFilter, setTaskDateFilter] = useState<string | null>(todayKey)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [appearance, setAppearance] = useState<AppearanceMode>('system')
  const [composerOpen, setComposerOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<TodoistTask | undefined>()
  const [search, setSearch] = useState('')

  useEffect(() => {
    let active = true
    void window.dayplan.getAppearance()
      .then((mode) => { if (active) setAppearance(mode) })
      .catch(() => { if (active) setAppearance('system') })
    return () => { active = false }
  }, [])

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
    const handleNavigate = (event: Event): void => {
      const target = (event as CustomEvent<AppSection>).detail
      if (target === 'dashboard' || target === 'today' || target === 'tasks' || target === 'settings') navigate(target)
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
          {!configured && section !== 'settings' ? <ConnectTodoist onOpenSettings={() => navigate('settings')} /> : section === 'dashboard' ? <DashboardPage metrics={metrics} loading={loading} onCreate={openCreateTask} onEdit={openEditTask} onComplete={completeTask} onReopen={reopenTask} onDelete={deleteTask} /> : section === 'settings' ? <SettingsPage configured={configured} appearance={appearance} onAppearanceChange={setAppearance} onSaved={() => { setSection('dashboard'); void refresh('dashboard') }} onRemoved={() => { setConfigured(false); setSection('settings') }} /> : <TaskPage section={section} tasks={visibleTasks} loading={loading} search={search} showCompleted={section === 'today' ? showCompletedToday : showCompletedTasks} taskDateFilter={taskDateFilter} onTaskDateChange={setTaskDateFilter} onShowCompleted={section === 'today' ? setShowCompletedToday : setShowCompletedTasks} onSearch={setSearch} onCreate={openCreateTask} onEdit={openEditTask} onComplete={completeTask} onReopen={reopenTask} onDelete={deleteTask} />}
        </div>
      </main>

      <TaskComposer open={composerOpen} task={editingTask} onOpenChange={setComposerOpen} onSave={saveTask} />
    </div>
  )
}

function PageHeading({ title, description, eyebrow }: { title: string; description: string; eyebrow: string }) {
  return <div className="mb-7"><div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">{eyebrow}</div><h1 className="text-[28px] font-semibold tracking-[-0.04em] sm:text-[32px]">{title}</h1><p className="mt-1.5 text-sm text-muted-foreground">{description}</p></div>
}

function DashboardPage({ metrics, loading, onCreate, onEdit, onComplete, onReopen, onDelete }: {
  metrics: DashboardMetrics | null; loading: boolean; onCreate: () => void; onEdit: (task: TodoistTask) => void
  onComplete: (task: TodoistTask) => Promise<void>; onReopen: (task: TodoistTask) => Promise<void>; onDelete: (task: TodoistTask) => Promise<void>
}) {
  const [completionRange, setCompletionRange] = useState<7 | 30>(7)
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  const dateText = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date())

  return <>
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div><div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">{dateText}</div><h1 className="text-[28px] font-semibold tracking-[-0.04em] sm:text-[34px]">{greeting}, Zain <span className="inline-block origin-bottom-right animate-wave">✦</span></h1><p className="mt-1.5 text-sm text-muted-foreground">Make today feel a little more manageable.</p></div>
      <Button onClick={onCreate}><Plus size={16} />Plan a task</Button>
    </div>

    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <MetricCard title="Open tasks" value={metrics?.openTasks} caption="Across your Todoist projects" icon={ListTodo} tint="blue" loading={loading} />
      <MetricCard title="Due today" value={metrics?.dueToday} caption="A clear focus for today" icon={Target} tint="violet" loading={loading} />
      <MetricCard title="Overdue" value={metrics?.overdue} caption="Ready for a quick review" icon={Clock3} tint="amber" loading={loading} />
      <MetricCard title="Completed today" value={metrics?.completedToday} caption="Small steps add up" icon={CheckCircle2} tint="green" loading={loading} />
    </div>

    <div className="mt-5 grid items-start gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.9fr)]">
      <Card>
        <CardHeader className="flex-row items-start justify-between gap-3"><div><CardTitle>{completionRange === 7 ? 'Weekly rhythm' : 'Monthly rhythm'}</CardTitle><p className="mt-1 text-xs text-muted-foreground">Tasks completed in the last {completionRange} days</p></div><div role="group" aria-label="Completion chart date range" className="inline-flex shrink-0 rounded-lg border border-border bg-muted/45 p-0.5">{([7, 30] as const).map((days) => <button key={days} type="button" aria-pressed={completionRange === days} onClick={() => setCompletionRange(days)} className={`rounded-md px-2.5 py-1.5 text-[11px] font-medium transition-colors ${completionRange === days ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>{days} days</button>)}</div></CardHeader>
        <CardContent>
          <DashboardCompletionChart metrics={metrics} loading={loading} days={completionRange} />
          <div className="flex items-center gap-2 border-t border-border/60 pt-3 text-[11px] text-muted-foreground"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />Completion history comes directly from Todoist.</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><div><CardTitle>Coming up</CardTitle><p className="mt-1 text-xs text-muted-foreground">Your next few dated tasks</p></div><button className="text-xs font-medium text-primary hover:underline" onClick={() => window.dispatchEvent(new CustomEvent('dayplan:navigate', { detail: 'tasks' }))}>View all</button></CardHeader>
        <CardContent>
          {loading ? <div className="flex justify-center py-12"><LoaderCircle className="animate-spin text-muted-foreground" size={18} /></div> : metrics?.upcoming.length ? <div className="-mx-2">{metrics.upcoming.slice(0, 5).map((task) => <TaskRow key={task.id} task={task} onComplete={onComplete} onReopen={onReopen} onEdit={onEdit} onDelete={onDelete} />)}</div> : <EmptyState icon={CalendarDays} title="Nothing on the horizon" description="Add a due date to a task and it will show up here." action={onCreate} />}
        </CardContent>
      </Card>
    </div>
    <div className="mt-3 flex justify-end text-[10px] text-muted-foreground">{metrics?.refreshedAt ? `Updated ${new Date(metrics.refreshedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : 'Waiting for Todoist'}</div>
  </>
}

function MetricCard({ title, value, caption, icon: Icon, tint, loading }: { title: string; value?: number; caption: string; icon: typeof ListTodo; tint: string; loading: boolean }) {
  const tones: Record<string, string> = { blue: 'bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-300', violet: 'bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-300', amber: 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-300', green: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300' }
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
      <CardHeader className="flex-wrap items-center"><div><CardTitle>{listTitle}</CardTitle><p className="mt-1 text-xs text-muted-foreground">{countDescription}</p></div><div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">{<div role="group" aria-label={isToday ? 'Today task status' : 'Task status'} className="flex rounded-lg border border-border bg-muted/40 p-0.5"><button type="button" aria-pressed={!showCompleted} className={`rounded-md px-2.5 py-1.5 text-[11px] font-medium ${!showCompleted ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`} onClick={() => onShowCompleted(false)}>{isToday ? 'Today todos' : 'Active'}</button><button type="button" aria-pressed={showCompleted} className={`rounded-md px-2.5 py-1.5 text-[11px] font-medium ${showCompleted ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`} onClick={() => onShowCompleted(true)}>{isToday ? 'Today completed' : 'Completed'}</button></div>}{!isToday && <><div role="group" aria-label="Filter tasks by due date" className="flex rounded-lg border border-border bg-muted/40 p-0.5"><button type="button" aria-pressed={taskDateFilter === todayKey()} className={`rounded-md px-2 py-1.5 text-[11px] font-medium ${taskDateFilter === todayKey() ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`} onClick={() => onTaskDateChange(todayKey())}>Today</button><button type="button" aria-pressed={taskDateFilter === dateKeyOffset(1)} className={`rounded-md px-2 py-1.5 text-[11px] font-medium ${taskDateFilter === dateKeyOffset(1) ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`} onClick={() => onTaskDateChange(dateKeyOffset(1))}>Tomorrow</button><button type="button" aria-pressed={taskDateFilter === null} className={`rounded-md px-2 py-1.5 text-[11px] font-medium ${taskDateFilter === null ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`} onClick={() => onTaskDateChange(null)}>All dates</button></div><Input type="date" aria-label="Choose due date" className="h-9 w-[145px] px-2 text-xs" value={taskDateFilter ?? ''} onChange={(event) => onTaskDateChange(event.target.value || null)} /></>}<div className="flex min-w-0 flex-1 gap-2 sm:w-auto"><div className="relative flex-1 sm:w-56"><Search size={15} className="absolute left-3 top-2.5 text-muted-foreground" /><Input aria-label="Search tasks" className="h-9 pl-9" placeholder="Search tasks" value={search} onChange={(event) => onSearch(event.target.value)} /></div>{!showCompleted && <Button size="sm" onClick={onCreate}><Plus size={14} />Add</Button>}</div></div></CardHeader>
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
