import { LoaderCircle } from 'lucide-react'
import type { DashboardMetrics } from '../../../shared/domain'

interface ChartPoint {
  x: number
  y: number
  date: string
  count: number
  day: string
  fullDate: string
}

const chart = { left: 46, right: 654, top: 18, bottom: 166 }

export default function DashboardCompletionChart({ metrics, loading, days }: { metrics: DashboardMetrics | null; loading: boolean; days: 7 | 30 }) {
  if (loading) {
    return <div className="flex h-[230px] items-center justify-center text-sm text-muted-foreground"><LoaderCircle className="mr-2 animate-spin" size={16} />Updating your history…</div>
  }

  const entries = (metrics?.recentCompletions ?? []).slice(-days)
  const maxCount = Math.max(1, ...entries.map(({ count }) => count))
  const points: ChartPoint[] = entries.map((entry, index) => {
    const date = new Date(`${entry.date}T12:00:00`)
    return {
      x: entries.length > 1 ? chart.left + index * (chart.right - chart.left) / (entries.length - 1) : (chart.left + chart.right) / 2,
      y: chart.bottom - entry.count / maxCount * (chart.bottom - chart.top),
      date: entry.date,
      count: entry.count,
      day: days === 7
        ? new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(date)
        : index === 0 || index === entries.length - 1 || (index % 7 === 0 && index < entries.length - 7)
          ? new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date)
          : '',
      fullDate: new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'short', day: 'numeric' }).format(date),
    }
  })
  const linePath = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ')
  const areaPath = points.length ? `${linePath} L ${points.at(-1)?.x} ${chart.bottom} L ${points[0]?.x} ${chart.bottom} Z` : ''
  const midpoint = Math.ceil(maxCount / 2)
  const ticks = [...new Set([maxCount, midpoint, 0])]
  const total = entries.reduce((sum, entry) => sum + entry.count, 0)

  return (
    <div className="mx-auto h-[230px] w-full max-w-[900px]" role="img" aria-label={`Task completion chart: ${total} tasks completed in the last ${days} days`}>
      <svg className="h-full w-full overflow-visible" viewBox="0 0 700 220" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
        <defs>
          <linearGradient id="weekly-completion-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#5b8b82" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#5b8b82" stopOpacity="0.015" />
          </linearGradient>
        </defs>
        {ticks.map((tick) => {
          const y = chart.bottom - tick / maxCount * (chart.bottom - chart.top)
          return <g key={tick}>
            <line x1={chart.left} x2={chart.right} y1={y} y2={y} stroke="var(--chart-grid)" strokeDasharray={tick === 0 ? undefined : '3 5'} />
            <text x="30" y={y + 4} textAnchor="end" fill="var(--muted-foreground)" fontSize="10">{tick}</text>
          </g>
        })}
        {areaPath && <path d={areaPath} fill="url(#weekly-completion-fill)" />}
        {linePath && <path d={linePath} fill="none" stroke="#5b8b82" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}
        {points.map((point) => <g key={point.date}>
          <title>{`${point.fullDate}: ${point.count} ${point.count === 1 ? 'task' : 'tasks'} completed`}</title>
          {days === 7 && <circle cx={point.x} cy={point.y} r="8" fill="#5b8b82" fillOpacity="0.1" />}
          <circle cx={point.x} cy={point.y} r={days === 7 ? 3.5 : 2.25} fill="#5b8b82" stroke="var(--card)" strokeWidth={days === 7 ? 2 : 1.5} />
          {point.day && <text x={point.x} y="200" textAnchor="middle" fill="var(--muted-foreground)" fontSize="10">{point.day}</text>}
        </g>)}
      </svg>
    </div>
  )
}
