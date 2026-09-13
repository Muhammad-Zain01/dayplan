import { useState } from 'react'
import { Check, Circle, Pencil, RotateCcw, Trash2 } from 'lucide-react'
import type { TodoistTask } from '../../../shared/domain'
import { Badge } from './ui/badge'
import { Button } from './ui/button'

interface TaskRowProps {
  task: TodoistTask
  onComplete: (task: TodoistTask) => Promise<void>
  onReopen: (task: TodoistTask) => Promise<void>
  onEdit: (task: TodoistTask) => void
  onDelete: (task: TodoistTask) => Promise<void>
}

const priorityTone: Record<number, string> = {
  4: 'text-rose-600',
  3: 'text-orange-500',
  2: 'text-blue-500',
  1: 'text-muted-foreground',
}

export function TaskRow({ task, onComplete, onReopen, onEdit, onDelete }: TaskRowProps) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run(action: () => Promise<void>): Promise<void> {
    setBusy(true)
    setError(null)
    try {
      await action()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The task could not be updated.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="group flex items-start gap-3 rounded-xl px-2 py-3 transition hover:bg-muted/55">
      <button
        type="button"
        disabled={busy}
        aria-label={task.is_completed ? `Reopen ${task.content}` : `Complete ${task.content}`}
        onClick={() => void run(() => (task.is_completed ? onReopen(task) : onComplete(task)))}
        className={`mt-0.5 flex h-[19px] w-[19px] shrink-0 items-center justify-center rounded-full border transition ${task.is_completed ? 'border-primary bg-primary text-white' : 'border-slate-300 text-transparent hover:border-primary hover:text-primary dark:border-slate-600'}`}
      >
        {task.is_completed ? <Check size={12} strokeWidth={3} /> : <Circle size={6} fill="currentColor" />}
      </button>
      <div className="min-w-0 flex-1">
        <button className={`block max-w-full truncate text-left text-sm font-medium ${task.is_completed ? 'text-muted-foreground line-through' : 'text-foreground'}`} onClick={() => onEdit(task)}>{task.content}</button>
        {task.description && <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{task.description}</p>}
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {task.due?.date && <Badge className={task.due.date < localDateKey() && !task.is_completed ? 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300' : ''}>{task.due.date}</Badge>}
          {task.priority > 1 && <span className={`text-[11px] font-semibold ${priorityTone[task.priority] ?? ''}`}>P{5 - task.priority}</span>}
          {task.labels.slice(0, 3).map((label) => <Badge key={label} className="bg-transparent text-muted-foreground">{label}</Badge>)}
        </div>
        {error && <p role="alert" className="mt-2 text-xs text-destructive">{error}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
        {task.is_completed ? <Button size="icon" variant="ghost" aria-label="Reopen task" disabled={busy} onClick={() => void run(() => onReopen(task))}><RotateCcw size={15} /></Button> : <Button size="icon" variant="ghost" aria-label="Edit task" onClick={() => onEdit(task)}><Pencil size={15} /></Button>}
        <Button size="icon" variant="ghost" className="hover:text-destructive" aria-label="Delete task" disabled={busy} onClick={() => void run(() => onDelete(task))}><Trash2 size={15} /></Button>
      </div>
    </div>
  )
}

function localDateKey(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}
