import { useEffect, useState, type FormEvent } from 'react'
import { CalendarDays, Check, ChevronDown, Flag, Folder, LoaderCircle, Plus, Tag } from 'lucide-react'
import type { TaskDraft, TaskPatch, TodoistLabel, TodoistProject, TodoistTask } from '../../../shared/domain'
import { Button } from './ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from './ui/dialog'
import { Input, Textarea } from './ui/input'

interface TaskComposerProps {
  open: boolean
  task?: TodoistTask
  onOpenChange: (open: boolean) => void
  onSave: (draft: TaskDraft | TaskPatch, taskId?: string) => Promise<void>
}

const priorityOptions = [
  { value: 4, label: 'P1 · Urgent', color: 'text-rose-600' },
  { value: 3, label: 'P2 · High', color: 'text-orange-500' },
  { value: 2, label: 'P3 · Medium', color: 'text-blue-500' },
  { value: 1, label: 'P4 · Normal', color: 'text-muted-foreground' },
]

export function TaskComposer({ open, task, onOpenChange, onSave }: TaskComposerProps) {
  const [projects, setProjects] = useState<TodoistProject[]>([])
  const [labels, setLabels] = useState<TodoistLabel[]>([])
  const [content, setContent] = useState('')
  const [description, setDescription] = useState('')
  const [projectId, setProjectId] = useState('inbox')
  const [dueDate, setDueDate] = useState('')
  const [priority, setPriority] = useState(1)
  const [selectedLabels, setSelectedLabels] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    setContent(task?.content ?? '')
    setDescription(task?.description ?? '')
    setProjectId(task?.project_id ?? 'inbox')
    setDueDate(task?.due?.date ?? '')
    setPriority(task?.priority ?? 1)
    setSelectedLabels(task?.labels ?? [])
    setError(null)
    void Promise.all([window.dayplan.listProjects(), window.dayplan.listLabels()])
      .then(([projectItems, labelItems]) => {
        setProjects(projectItems)
        setLabels(labelItems)
      })
      .catch(() => setError('Projects or labels could not load. You can still create a task in Inbox.'))
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
        await onSave({ ...common, ...(projectId === 'inbox' ? {} : { project_id: projectId }) } satisfies TaskDraft)
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
              {!task && <label className="grid gap-2 text-sm font-medium">
                <span className="flex items-center gap-2"><Folder size={15} className="text-muted-foreground" />Project</span>
                <div className="relative">
                  <select className="h-10 w-full appearance-none rounded-xl border border-input bg-background px-3 pr-9 text-sm outline-none focus:ring-2 focus:ring-primary/35" value={projectId} onChange={(event) => setProjectId(event.target.value)}>
                    <option value="inbox">Inbox</option>
                    {projects.filter((project) => !project.is_inbox_project).map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
                  </select>
                  <ChevronDown size={15} className="pointer-events-none absolute right-3 top-3 text-muted-foreground" />
                </div>
              </label>}
              <label className="grid gap-2 text-sm font-medium">
                <span className="flex items-center gap-2"><CalendarDays size={15} className="text-muted-foreground" />Due date</span>
                <Input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
              </label>
              <label className="grid gap-2 text-sm font-medium">
                <span className="flex items-center gap-2"><Flag size={15} className="text-muted-foreground" />Priority</span>
                <div className="relative">
                  <select className="h-10 w-full appearance-none rounded-xl border border-input bg-background px-3 pr-9 text-sm outline-none focus:ring-2 focus:ring-primary/35" value={priority} onChange={(event) => setPriority(Number(event.target.value))}>
                    {priorityOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                  <ChevronDown size={15} className="pointer-events-none absolute right-3 top-3 text-muted-foreground" />
                </div>
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
