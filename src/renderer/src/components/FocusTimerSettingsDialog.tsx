import { useEffect, useState } from 'react'
import { Settings2 } from 'lucide-react'
import type { FocusTimerPreferences } from '../../../shared/domain'
import { Button } from './ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from './ui/dialog'
import { Input } from './ui/input'

export function FocusTimerSettingsDialog({ open, onOpenChange, preferences, onSave }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  preferences: FocusTimerPreferences
  onSave: (preferences: FocusTimerPreferences) => Promise<void>
}) {
  const [focusMinutes, setFocusMinutes] = useState(String(preferences.focusMinutes))
  const [breakMinutes, setBreakMinutes] = useState(String(preferences.breakMinutes))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setFocusMinutes(String(preferences.focusMinutes))
    setBreakMinutes(String(preferences.breakMinutes))
    setError(null)
  }, [open, preferences.focusMinutes, preferences.breakMinutes])

  async function save(): Promise<void> {
    setSaving(true)
    setError(null)
    try {
      await onSave({ focusMinutes: Number(focusMinutes), breakMinutes: Number(breakMinutes) })
      onOpenChange(false)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Timer settings could not be saved.')
    } finally {
      setSaving(false)
    }
  }

  return <Dialog open={open} onOpenChange={(nextOpen) => { if (!saving) onOpenChange(nextOpen) }}>
    <DialogContent className="max-w-[420px]">
      <div className="border-b border-border/70 px-6 py-5 pr-14">
        <DialogTitle className="flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary"><Settings2 size={15} /></span>Timer settings</DialogTitle>
        <DialogDescription className="mt-1.5">Choose the default focus interval and break length.</DialogDescription>
      </div>
      <div className="grid gap-4 px-6 py-5">
        <div className="grid grid-cols-2 gap-3">
          <label htmlFor="timer-settings-focus" className="grid gap-1.5 text-xs font-medium">Focus interval
            <div className="relative"><Input id="timer-settings-focus" type="number" inputMode="numeric" min={1} max={240} step={1} className="h-10 pr-12" value={focusMinutes} onChange={(event) => setFocusMinutes(event.target.value)} /><span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">min</span></div>
            <span className="font-normal text-muted-foreground">1–240 minutes</span>
          </label>
          <label htmlFor="timer-settings-break" className="grid gap-1.5 text-xs font-medium">Break length
            <div className="relative"><Input id="timer-settings-break" type="number" inputMode="numeric" min={1} max={120} step={1} className="h-10 pr-12" value={breakMinutes} onChange={(event) => setBreakMinutes(event.target.value)} /><span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">min</span></div>
            <span className="font-normal text-muted-foreground">1–120 minutes</span>
          </label>
        </div>
        {error && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2.5 text-xs text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">{error}</p>}
      </div>
      <div className="flex justify-end gap-2 border-t border-border/70 px-6 py-4">
        <Button variant="outline" disabled={saving} onClick={() => onOpenChange(false)}>Cancel</Button>
        <Button disabled={saving} onClick={() => void save()}>{saving ? 'Saving…' : 'Save settings'}</Button>
      </div>
    </DialogContent>
  </Dialog>
}
