import { LoaderCircle } from 'lucide-react'
import type { FocusDashboardMetrics } from '../../../shared/domain'

const chart = { width: 960, height: 274, left: 54, right: 18, top: 18, bottom: 216 }

function formatDuration(seconds: number): string {
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const remainder = minutes % 60
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`
}

function formatHour(hour: number): string {
  if (hour === 0) return '12a'
  if (hour === 12) return '12p'
  return hour < 12 ? `${hour}a` : `${hour - 12}p`
}

function axisMaximum(seconds: number): number {
  const minutes = Math.max(15, Math.ceil(seconds / 60))
  const step = minutes <= 60 ? 15 : minutes <= 180 ? 30 : 60
  return Math.max(step, Math.ceil(minutes / step) * step)
}

export default function FocusDayChart({ metrics, loading }: { metrics: FocusDashboardMetrics | null; loading: boolean }) {
  const buckets = metrics?.hourlyFocusTime?.length === 24
    ? metrics.hourlyFocusTime
    : Array.from({ length: 24 }, (_, hour) => ({ hour, seconds: 0 }))
  const totalSeconds = buckets.reduce((sum, bucket) => sum + bucket.seconds, 0)
  const peak = buckets.reduce((highest, bucket) => bucket.seconds > highest.seconds ? bucket : highest, buckets[0] ?? { hour: 0, seconds: 0 })
  const hasFocus = totalSeconds > 0
  const maxMinutes = axisMaximum(Math.max(60, ...buckets.map((bucket) => bucket.seconds)))
  const plotWidth = chart.width - chart.left - chart.right
  const plotHeight = chart.bottom - chart.top
  const barSlot = plotWidth / 24
  const barWidth = Math.min(24, barSlot * 0.58)
  const ticks = [0, 0.25, 0.5, 0.75, 1]

  return (
    <div className="space-y-4" role="img" aria-label={`Hourly focus chart: ${formatDuration(totalSeconds)} focused today`}>
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 text-muted-foreground"><span className="h-2 w-2 rounded-full bg-primary" />Focus minutes</div>
        <div className="flex items-center gap-4 text-muted-foreground"><span><strong className="font-semibold text-foreground">{formatDuration(totalSeconds)}</strong> total</span><span>Peak <strong className="font-semibold text-foreground">{hasFocus ? formatHour(peak.hour) : '—'}</strong></span></div>
      </div>
      {loading
        ? <div className="flex h-[274px] items-center justify-center text-sm text-muted-foreground"><LoaderCircle className="mr-2 animate-spin" size={16} />Updating your focus history…</div>
        : <svg className="h-auto w-full overflow-visible [text-rendering:geometricPrecision]" viewBox={`0 0 ${chart.width} ${chart.height}`} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
          {ticks.map((fraction) => {
            const y = chart.bottom - fraction * plotHeight
            const value = Math.round(fraction * maxMinutes)
            return <g key={fraction}>
              <line x1={chart.left} x2={chart.width - chart.right} y1={y} y2={y} stroke="var(--chart-grid)" strokeDasharray={fraction === 0 ? undefined : '3 5'} />
              <text x={chart.left - 10} y={y + 4} textAnchor="end" fill="var(--muted-foreground)" fontSize="11" fontWeight="500">{value}m</text>
            </g>
          })}
          {buckets.map((bucket) => {
            const x = chart.left + bucket.hour * barSlot + (barSlot - barWidth) / 2
            const height = bucket.seconds / 60 / maxMinutes * plotHeight
            const y = chart.bottom - height
            return <g key={bucket.hour}>
              <title>{`${formatHour(bucket.hour)}: ${formatDuration(bucket.seconds)} focused`}</title>
              <rect x={x} y={chart.top} width={barWidth} height={plotHeight} rx="5" fill="var(--muted)" fillOpacity="0.45" />
              {height > 0 && <rect x={x} y={y} width={barWidth} height={height} rx="5" fill="var(--primary)" fillOpacity="0.88" />}
              {(bucket.hour % 3 === 0) && <text x={x + barWidth / 2} y="244" textAnchor="middle" fill="var(--muted-foreground)" fontSize="11" fontWeight="500">{formatHour(bucket.hour)}</text>}
            </g>
          })}
          {!hasFocus && <text x={chart.width / 2} y="126" textAnchor="middle" fill="var(--muted-foreground)" fontSize="13" fontWeight="600">No focus recorded today</text>}
        </svg>}
      <div className="grid grid-cols-3 gap-2 border-t border-border/60 pt-3 text-xs">
        <div><div className="text-muted-foreground">Focused today</div><div className="mt-1 font-semibold text-foreground">{formatDuration(totalSeconds)}</div></div>
        <div><div className="text-muted-foreground">Active hours</div><div className="mt-1 font-semibold text-foreground">{buckets.filter((bucket) => bucket.seconds > 0).length}</div></div>
        <div><div className="text-muted-foreground">Longest hour</div><div className="mt-1 font-semibold text-foreground">{hasFocus ? formatDuration(peak.seconds) : '—'}</div></div>
      </div>
    </div>
  )
}
