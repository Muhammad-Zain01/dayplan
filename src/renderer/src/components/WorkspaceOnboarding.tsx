import { useState } from 'react'
import { ArrowLeft, ArrowRight, CheckCircle2, LoaderCircle, ShieldCheck, UserRound } from 'lucide-react'
import type { FocusTimerPreferences, WorkspaceSetupStatus } from '../../../shared/domain'
import { Button } from './ui/button'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Input } from './ui/input'

export function WorkspaceOnboarding({ setup, onComplete }: {
  setup: WorkspaceSetupStatus
  onComplete: () => Promise<void>
}) {
  const [step, setStep] = useState(() => !setup.ownerProfile.displayName ? 0 : setup.activeWorkspace.todoistConfigured ? 2 : 1)
  const [ownerName, setOwnerName] = useState(setup.ownerProfile.displayName ?? '')
  const [workspaceName, setWorkspaceName] = useState(setup.activeWorkspace.name || 'Personal')
  const [token, setToken] = useState('')
  const [focusMinutes, setFocusMinutes] = useState('30')
  const [breakMinutes, setBreakMinutes] = useState('5')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function saveIdentity(): Promise<void> {
    const normalizedOwnerName = ownerName.trim()
    const normalizedWorkspaceName = workspaceName.trim()
    if (!normalizedOwnerName || normalizedOwnerName.length > 80) throw new Error('Your name must be 1 to 80 characters.')
    if (!normalizedWorkspaceName || normalizedWorkspaceName.length > 80) throw new Error('Workspace name must be 1 to 80 characters.')
    await window.dayplan.saveInitialIdentity(normalizedOwnerName, normalizedWorkspaceName)
  }

  async function continueFromIdentity(): Promise<void> {
    setBusy(true)
    setError(null)
    try {
      await saveIdentity()
      setStep(1)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Your profile could not be saved.')
    } finally {
      setBusy(false)
    }
  }

  async function connectTodoist(): Promise<void> {
    setBusy(true)
    setError(null)
    try {
      if (!token.trim()) throw new Error('Paste your Todoist API token, or choose Connect later.')
      await window.dayplan.testTodoistConnection(token.trim())
      await window.dayplan.saveTodoistToken(token.trim())
      setStep(2)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Dayplan could not connect to Todoist.')
    } finally {
      setBusy(false)
    }
  }

  async function finish(): Promise<void> {
    setBusy(true)
    setError(null)
    try {
      const preferences: FocusTimerPreferences = {
        focusMinutes: Number(focusMinutes),
        breakMinutes: Number(breakMinutes),
      }
      if (!Number.isInteger(preferences.focusMinutes) || preferences.focusMinutes < 1 || preferences.focusMinutes > 240
        || !Number.isInteger(preferences.breakMinutes) || preferences.breakMinutes < 1 || preferences.breakMinutes > 120) {
        throw new Error('Focus time must be 1–240 minutes and break time 1–120 minutes.')
      }
      await window.dayplan.setFocusTimerPreferences(preferences)
      await window.dayplan.completeInitialSetup()
      await onComplete()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Setup could not be completed.')
    } finally {
      setBusy(false)
    }
  }

  return <main className="grid min-h-screen place-items-center bg-background px-5 py-10 text-foreground">
    <div className="w-full max-w-[600px]">
      <div className="mb-7 text-center"><div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary"><UserRound size={22} /></div><div className="text-[11px] font-semibold uppercase tracking-[0.15em] text-primary">Welcome to Dayplan</div><h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em]">Set up your workspace</h1><p className="mt-2 text-sm text-muted-foreground">A few details make this space yours. You can change them later.</p></div>
      <div className="mb-3 flex items-center justify-center gap-2" aria-label={`Setup step ${step + 1} of 3`}>{[0, 1, 2].map((item) => <span key={item} className={`h-1.5 w-12 rounded-full ${item <= step ? 'bg-primary' : 'bg-border'}`} />)}</div>
      <Card>
        <CardHeader><CardTitle>{step === 0 ? 'Your profile and first workspace' : step === 1 ? 'Connect Todoist' : 'Choose your focus rhythm'}</CardTitle></CardHeader>
        <CardContent className="grid gap-4">
          {step === 0 && <>
            <label className="grid gap-1.5 text-xs font-medium">Your name<Input autoFocus maxLength={80} value={ownerName} onChange={(event) => setOwnerName(event.target.value)} placeholder="How Dayplan should address you" /></label>
            <label className="grid gap-1.5 text-xs font-medium">First workspace<Input maxLength={80} value={workspaceName} onChange={(event) => setWorkspaceName(event.target.value)} placeholder="Personal" /></label>
            <p className="text-[11px] leading-5 text-muted-foreground">Your profile belongs to you and is shared across your workspaces. Workspaces remain private on this device.</p>
          </>}
          {step === 1 && <>
            <p className="text-sm leading-6 text-muted-foreground">Connect this workspace to Todoist to bring in its tasks, projects, and labels. Dayplan tests the token before saving it.</p>
            <label className="grid gap-1.5 text-xs font-medium">Todoist API token<Input autoFocus type="password" autoComplete="off" value={token} onChange={(event) => setToken(event.target.value)} placeholder="Paste your token" /></label>
            <p className="text-[11px] leading-5 text-muted-foreground">Find it in Todoist → Settings → Integrations → Developer. The token stays in Dayplan’s local database. If you reuse this Todoist account in another workspace, both spaces will see the same remote tasks.</p>
          </>}
          {step === 2 && <>
            <p className="text-sm leading-6 text-muted-foreground">Set defaults for focus sessions in <span className="font-medium text-foreground">{workspaceName}</span>. You can change these at any time.</p>
            <div className="grid grid-cols-2 gap-3">
              <label className="grid gap-1.5 text-xs font-medium">Focus minutes<Input autoFocus type="number" min={1} max={240} value={focusMinutes} onChange={(event) => setFocusMinutes(event.target.value)} /></label>
              <label className="grid gap-1.5 text-xs font-medium">Break minutes<Input type="number" min={1} max={120} value={breakMinutes} onChange={(event) => setBreakMinutes(event.target.value)} /></label>
            </div>
          </>}
          {error && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">{error}</p>}
          <div className="flex flex-wrap justify-between gap-2 border-t border-border/70 pt-4">
            {step === 0 ? <span /> : <Button variant="outline" disabled={busy} onClick={() => { setError(null); setStep(step - 1) }}><ArrowLeft size={14} />Back</Button>}
            {step === 0 && <Button disabled={busy} onClick={() => void continueFromIdentity()}>{busy ? <LoaderCircle size={14} className="animate-spin" /> : null}Continue<ArrowRight size={14} /></Button>}
            {step === 1 && <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={busy} onClick={() => { setError(null); setToken(''); setStep(2) }}>Connect later</Button><Button disabled={busy || !token.trim()} onClick={() => void connectTodoist()}>{busy ? <LoaderCircle size={14} className="animate-spin" /> : <ShieldCheck size={14} />}{busy ? 'Testing…' : 'Test and connect'}</Button></div>}
            {step === 2 && <Button disabled={busy} onClick={() => void finish()}>{busy ? <LoaderCircle size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}{busy ? 'Finishing…' : 'Finish setup'}</Button>}
          </div>
        </CardContent>
      </Card>
      <p className="mt-4 text-center text-[11px] text-muted-foreground">No accounts, invitations, or team members—just your private workspace.</p>
    </div>
  </main>
}
