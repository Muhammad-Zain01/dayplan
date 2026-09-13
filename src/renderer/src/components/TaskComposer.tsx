import { useEffect, useState, type FormEvent } from 'react'
import { CalendarDays, Check, Flag, LoaderCircle, Plus, Tag } from 'lucide-react'
import type { TaskDraft, TaskPatch, TodoistLabel, TodoistTask } from '../../../shared/domain'
import { DatePicker } from './DatePicker'
import { Button } from './ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from './ui/dialog'
import { Input, Textarea } from './ui/input'
import { Select, SelectContent, SelectGroup, SelectItem, SelectItemText, SelectLabel, SelectTrigger, SelectValue } from './ui/select'

interface TaskComposerProps {
  open: boolean
  task?: TodoistTask
  onOpenChange: (open: boolean) => void
  onSave: (draft: TaskDraft | TaskPatch, taskId?: string) => Promise<void>
}

const priorityOptions = [
  { value: 4, label: 'P1 · Urgent', detail: 'Highest priority', color: 'text-rose-600 dark:text-rose-400', surface: 'bg-rose-50 dark:bg-rose-950/40', hex: '#e5484d' },
  { value: 3, label: 'P2 · High', detail: 'High priority', color: 'text-orange-600 dark:text-orange-400', surface: 'bg-orange-50 dark:bg-orange-950/40', hex: '#f97316' },
  { value: 2, label: 'P3 · Medium', detail: 'Normal priority', color: 'text-blue-600 dark:text-blue-400', surface: 'bg-blue-50 dark:bg-blue-950/40', hex: '#3b82f6' },
  { value: 1, label: 'P4 · Normal', detail: 'Lowest priority', color: 'text-slate-500 dark:text-slate-400', surface: 'bg-slate-100 dark:bg-slate-800', hex: '#94a3b8' },
]

function localTodayKey(): string {
  const today = new Date()
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
}

export function TaskComposer({ open, task, onOpenChange, onSave }: TaskComposerProps) {
  const [labels, setLabels] = useState<TodoistLabel[]>([])
  const [content, setContent] = useState('')
  const [description, setDescription] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [priority, setPriority] = useState(1)
  const [selectedLabels, setSelectedLabels] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const selectedPriority = priorityOptions.find((option) => option.value === priority) ?? priorityOptions[3]
  useEffect(() => {
    if (!open) return
    setContent(task?.content ?? '')
    setDescription(task?.description ?? '')
    setDueDate(task?.due?.date ?? (task ? '' : localTodayKey()))
    setPriority(task?.priority ?? 1)
    setSelectedLabels(task?.labels ?? [])
    setError(null)
    void window.dayplan.listLabels()
      .then(setLabels)
      .catch(() => setError('Labels could not load. You can still create the task.'))
  }, [open, task])

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const common = {
        content: content.trim(),
        description: description.trim(),
        due_date: dueDate || null,
        priority,
        labels: selectedLabels,
      }
      if (task) {
        await onSave(common satisfies TaskPatch, task.id)
      } else {
        await onSave(common satisfies TaskDraft)
      }
      onOpenChange(false)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The task could not be saved.')
    } finally {
      setBusy(false)
    }
  }

  function toggleLabel(name: string): void {
    setSelectedLabels((current) => current.includes(name) ? current.filter((label) => label !== name) : [...current, name])
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <div className="border-b border-border px-6 py-5 pr-14">
          <DialogTitle>{task ? 'Edit task' : 'Create a task'}</DialogTitle>
          <DialogDescription className="mt-1">{task ? 'Update the details for this task.' : 'Capture it now, then keep your day moving.'}</DialogDescription>
        </div>
        <form onSubmit={submit}>
          <div className="grid gap-5 px-6 py-5">
            <label className="grid gap-2 text-sm font-medium">
              Task name
              <Input autoFocus required maxLength={500} placeholder="What needs to get done?" value={content} onChange={(event) => setContent(event.target.value)} />
            </label>
            <label className="grid gap-2 text-sm font-medium">
              Description <span className="font-normal text-muted-foreground">Optional</span>
            <Textarea maxLength={5000} placeholder="Add a little more detail…" value={description} onChange={(event) => setDescription(event.target.value)} />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 text-sm font-medium">
                <span className="flex items-center gap-2"><CalendarDays size={15} className="text-muted-foreground" />Due date</span>
                <DatePicker value={dueDate} onChange={setDueDate} />
              </label>
              <label htmlFor="task-priority" className="grid gap-2 text-sm font-medium">
                <span className="flex items-center gap-2"><Flag size={15} className="text-muted-foreground" />Priority</span>
                <Select value={String(priority)} onValueChange={(value) => setPriority(Number(value))}>
                  <SelectTrigger id="task-priority" aria-label="Priority">
                    <span className="flex min-w-0 items-center gap-2.5">
                      <Flag size={16} className={selectedPriority.color} fill={selectedPriority.hex} fillOpacity={0.12} />
                      <SelectValue />
                    </span>
                  </SelectTrigger>
                  <SelectContent align="start">
                    <SelectGroup>
                      <SelectLabel>Set priority</SelectLabel>
                      {priorityOptions.map((option) => (
                        <SelectItem key={option.value} value={String(option.value)}>
                          <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${option.surface}`}>
                            <Flag size={14} className={option.color} fill={option.hex} fillOpacity={0.14} />
                          </span>
                          <span className="flex min-w-0 flex-col gap-0.5">
                            <SelectItemText>{option.label}</SelectItemText>
                            <span className="text-[10px] leading-none text-muted-foreground">{option.detail}</span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </label>
            </div>
            {labels.length > 0 && <div className="grid gap-2 text-sm font-medium">
              <span className="flex items-center gap-2"><Tag size={15} className="text-muted-foreground" />Labels</span>
              <div className="flex flex-wrap gap-2">
                {labels.map((label) => {
                  const active = selectedLabels.includes(label.name)
                  return <button type="button" key={label.name} onClick={() => toggleLabel(label.name)} className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition ${active ? 'border-primary/25 bg-primary/10 text-primary' : 'border-border bg-background text-muted-foreground hover:bg-accent'}`}>
                    {active && <Check size={12} />}{label.name}
                  </button>
                })}
              </div>
            </div>}
            {error && <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">{error}</p>}
          </div>
          <div className="flex justify-end gap-2 border-t border-border px-6 py-4">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={busy || !content.trim()}>{busy ? <LoaderCircle size={15} className="animate-spin" /> : <Plus size={15} />}{busy ? 'Saving…' : task ? 'Save changes' : 'Create task'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
