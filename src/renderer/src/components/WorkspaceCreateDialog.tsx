import { useState } from 'react'
import { LoaderCircle, ShieldCheck } from 'lucide-react'
import type { FocusTimerPreferences, WorkspaceSummary } from '../../../shared/domain'
import { Button } from './ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from './ui/dialog'
import { Input } from './ui/input'

export function WorkspaceCreateDialog({ open, onOpenChange, onCreated }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (workspace: WorkspaceSummary) => void
}) {
  const [name, setName] = useState('')
  const [token, setToken] = useState('')
  const [focusMinutes, setFocusMinutes] = useState('30')
  const [breakMinutes, setBreakMinutes] = useState('5')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function reset(): void {
    setName('')
    setToken('')
    setFocusMinutes('30')
    setBreakMinutes('5')
    setError(null)
  }

  async function create(connect: boolean): Promise<void> {
    setBusy(true)
    setError(null)
    let createdWorkspace: WorkspaceSummary | null = null
    try {
      const normalizedName = name.trim()
      if (!normalizedName || normalizedName.length > 80) throw new Error('Workspace name must be 1 to 80 characters.')
      const focus = Number(focusMinutes)
      const rest = Number(breakMinutes)
      if (!Number.isInteger(focus) || focus < 1 || focus > 240 || !Number.isInteger(rest) || rest < 1 || rest > 120) {
        throw new Error('Focus time must be 1–240 minutes and break time 1–120 minutes.')
      }
      if (connect && token.trim()) await window.dayplan.testTodoistConnection(token.trim())

      const workspace = await window.dayplan.createWorkspace(normalizedName)
      createdWorkspace = workspace
      if (connect && token.trim()) await window.dayplan.saveTodoistToken(token.trim())
      const preferences: FocusTimerPreferences = { focusMinutes: focus, breakMinutes: rest }
      await window.dayplan.setFocusTimerPreferences(preferences)
      await window.dayplan.completeWorkspaceSetup(workspace.id)
      onCreated({ ...workspace, todoistConfigured: connect && Boolean(token.trim()) })
      onOpenChange(false)
      reset()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The workspace could not be created.')
      if (createdWorkspace) {
        try {
          await onCreated(createdWorkspace)
        } catch (reloadError) {
          setError(`${caught instanceof Error ? caught.message : 'Workspace setup was incomplete.'} ${reloadError instanceof Error ? reloadError.message : 'The new workspace could not be reloaded.'}`)
        }
      }
    } finally {
      setBusy(false)
    }
  }

  return <Dialog open={open} onOpenChange={(nextOpen) => { if (!busy) onOpenChange(nextOpen); if (!nextOpen) reset() }}>
    <DialogContent className="max-w-[520px]">
      <div className="border-b border-border/70 px-6 py-5 pr-14">
        <DialogTitle>Create a workspace</DialogTitle>
        <DialogDescription className="mt-1.5">Give this space its own Todoist connection and focus history.</DialogDescription>
      </div>
      <div className="grid gap-4 px-6 py-5">
        <label className="grid gap-1.5 text-xs font-medium">Workspace name
          <Input autoFocus maxLength={80} value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Studio or Personal" />
        </label>
        <label className="grid gap-1.5 text-xs font-medium">Todoist API token <span className="font-normal text-muted-foreground">Optional; connect now or later from Settings.</span>
          <Input type="password" autoComplete="off" value={token} onChange={(event) => setToken(event.target.value)} placeholder="Paste this workspace's token" />
        </label>
        <p className="-mt-2 text-[11px] leading-5 text-muted-foreground">A workspace stores its own token. Reusing the same Todoist account in two workspaces will show the same remote tasks in both.</p>
        <div className="grid grid-cols-2 gap-3">
          <label className="grid gap-1.5 text-xs font-medium">Focus minutes
            <Input type="number" min={1} max={240} value={focusMinutes} onChange={(event) => setFocusMinutes(event.target.value)} />
          </label>
          <label className="grid gap-1.5 text-xs font-medium">Break minutes
            <Input type="number" min={1} max={120} value={breakMinutes} onChange={(event) => setBreakMinutes(event.target.value)} />
          </label>
        </div>
        {error && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">{error}</p>}
      </div>
      <div className="flex flex-wrap justify-end gap-2 border-t border-border/70 px-6 py-4">
        <Button variant="outline" disabled={busy} onClick={() => void create(false)}>{busy ? <LoaderCircle size={14} className="animate-spin" /> : null}Create and connect later</Button>
        <Button disabled={busy || !name.trim() || !token.trim()} onClick={() => void create(true)}>{busy ? <LoaderCircle size={14} className="animate-spin" /> : <ShieldCheck size={14} />}{busy ? 'Checking…' : 'Test and create'}</Button>
      </div>
    </DialogContent>
  </Dialog>
}
