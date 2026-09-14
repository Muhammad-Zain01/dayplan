import { useEffect, useState } from 'react'
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Sun } from 'lucide-react'
import { Button } from './ui/button'
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover'

interface DatePickerProps {
  value: string
  onChange: (value: string) => void
  compact?: boolean
  side?: 'top' | 'bottom'
  showShortcuts?: boolean
}

function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function parseDateKey(value: string): Date | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return undefined
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(year, month - 1, day)
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : undefined
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days)
}

const weekdays = Array.from({ length: 7 }, (_, day) =>
  new Intl.DateTimeFormat(undefined, { weekday: 'narrow' }).format(new Date(2024, 0, 7 + day)),
)

export function DatePicker({ value, onChange, compact = false, side = 'top', showShortcuts = true }: DatePickerProps) {
  const selectedDate = parseDateKey(value)
  const [open, setOpen] = useState(false)
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const initial = selectedDate ?? new Date()
    return new Date(initial.getFullYear(), initial.getMonth(), 1)
  })
  const today = new Date()
  const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const tomorrow = addDays(todayDate, 1)
  const weekend = addDays(todayDate, (6 - todayDate.getDay() + 7) % 7)
  const daysUntilMonday = (8 - todayDate.getDay()) % 7 || 7
  const nextWeek = addDays(todayDate, daysUntilMonday)

  useEffect(() => {
    const date = parseDateKey(value) ?? new Date()
    setVisibleMonth(new Date(date.getFullYear(), date.getMonth(), 1))
  }, [value])

  const monthStart = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1)
  const gridStart = addDays(monthStart, -monthStart.getDay())
  const daysInMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 0).getDate()
  const weekCount = Math.ceil((monthStart.getDay() + daysInMonth) / 7)
  const days = Array.from({ length: weekCount * 7 }, (_, index) => addDays(gridStart, index))
  const monthLabel = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(visibleMonth)
  const selectedLabel = selectedDate
    ? new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).format(selectedDate)
    : 'No due date selected'

  function choose(date: Date): void {
    onChange(dateKey(date))
    setOpen(false)
  }

  function shortcut(label: string, date: Date, icon?: typeof Sun) {
    const Icon = icon
    const isSelected = value === dateKey(date)
    return <button key={label} type="button" aria-pressed={isSelected} onClick={() => choose(date)} className={`flex h-9 items-center justify-center gap-1.5 rounded-lg border px-2 text-xs font-medium transition ${isSelected ? 'border-primary/30 bg-primary/10 text-primary' : 'border-border/70 bg-background text-muted-foreground hover:border-primary/25 hover:bg-accent hover:text-foreground'}`}>
      {Icon && <Icon size={13} />}{label}
    </button>
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" aria-label="Choose due date" aria-haspopup="dialog" aria-expanded={open} className={`flex ${compact ? 'h-9 w-[185px] gap-2 px-2.5 text-xs' : 'h-11 w-full gap-3 px-3 text-sm'} items-center rounded-xl border border-input bg-background text-left shadow-sm outline-none transition-colors hover:bg-accent/35 focus-visible:border-primary/45 focus-visible:ring-2 focus-visible:ring-primary/20`}>
          <CalendarDays size={compact ? 14 : 16} className="shrink-0 text-muted-foreground" />
          <span className={`flex-1 whitespace-nowrap ${selectedDate ? '' : 'text-muted-foreground'}`}>{selectedDate ? new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(selectedDate) : 'Choose a date'}</span>
          <ChevronDown size={compact ? 14 : 15} className="shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" side={side} collisionPadding={10} className="calendar-popover-scroll max-h-[min(78vh,440px)] w-[316px] overflow-y-auto bg-card p-3">
        {showShortcuts && <>
          <div className="grid grid-cols-2 gap-2">
            {shortcut('Today', todayDate, Sun)}
            {shortcut('Tomorrow', tomorrow)}
            {shortcut('Weekend', weekend)}
            {shortcut('Next week', nextWeek)}
          </div>
          <div className="my-3 h-px bg-border" />
        </>}
        <div className="mb-2 flex h-9 items-center justify-between">
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" aria-label="Previous month" onClick={() => setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1))}><ChevronLeft size={16} /></Button>
          <div className="text-sm font-semibold">{monthLabel}</div>
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" aria-label="Next month" onClick={() => setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1))}><ChevronRight size={16} /></Button>
        </div>
        <div className="grid grid-cols-7 text-center">
          {weekdays.map((weekday, index) => <div key={`${weekday}-${index}`} className="flex h-8 items-center justify-center text-[11px] font-medium text-muted-foreground">{weekday}</div>)}
          {days.map((day) => {
            const key = dateKey(day)
            const selected = key === value
            const isToday = key === dateKey(todayDate)
            const inMonth = day.getMonth() === visibleMonth.getMonth()
            return <button key={key} type="button" aria-label={new Intl.DateTimeFormat(undefined, { dateStyle: 'full' }).format(day)} aria-pressed={selected} onClick={() => choose(day)} className={`relative mx-auto flex h-9 w-9 items-center justify-center rounded-lg text-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${selected ? 'bg-primary text-primary-foreground shadow-sm' : 'text-foreground hover:bg-accent'} ${!inMonth ? 'text-muted-foreground/45' : ''} ${isToday && !selected ? 'font-semibold text-primary after:absolute after:bottom-1 after:h-1 after:w-1 after:rounded-full after:bg-primary' : ''}`}>
              {day.getDate()}
            </button>
          })}
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
          <span className="truncate text-[11px] text-muted-foreground">{selectedLabel}</span>
          {value && <button type="button" className="ml-3 shrink-0 text-xs font-medium text-muted-foreground hover:text-foreground" onClick={() => { onChange(''); setOpen(false) }}>Clear</button>}
        </div>
      </PopoverContent>
    </Popover>
  )
}
