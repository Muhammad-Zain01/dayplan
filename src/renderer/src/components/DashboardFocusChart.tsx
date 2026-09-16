import { useEffect, useRef, useState } from 'react'
import { LoaderCircle } from 'lucide-react'
import type { FocusDashboardMetrics } from '../../../shared/domain'

interface FocusChartPoint {
  x: number
  y: number
  date: string
  seconds: number
  label: string
  fullDate: string
}

const chartHeight = 230
const chart = { left: 40, rightInset: 12, top: 16, bottom: 176 }

function formatMinutes(seconds: number): string {
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const remainder = minutes % 60
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`
}

function formatAxisTime(seconds: number): string {
  const roundedSeconds = Math.round(seconds)
  if (roundedSeconds > 0 && roundedSeconds < 60) return `${roundedSeconds}s`
  return formatMinutes(roundedSeconds)
}

function getAxisMaximum(seconds: number): number {
  const minutes = Math.max(1, seconds / 60)
  const magnitude = 10 ** Math.floor(Math.log10(minutes))
  const normalized = minutes / magnitude
  const step = [1, 2, 5, 10].find((value) => normalized <= value) ?? 10
  return step * magnitude * 60
}

export default function DashboardFocusChart({ metrics, loading, days }: { metrics: FocusDashboardMetrics | null; loading: boolean; days: 7 | 30 }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(Math.round(entry.contentRect.width))
    })
    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  const chartWidth = Math.max(320, width)
  const chartRight = chartWidth - chart.rightInset
  const entries = (metrics?.recentFocusTime ?? []).slice(-days)
  const maxSeconds = getAxisMaximum(Math.max(60, ...entries.map(({ seconds }) => seconds)))
  const points: FocusChartPoint[] = entries.map((entry, index) => {
    const date = new Date(`${entry.date}T12:00:00`)
    return {
      x: entries.length > 1 ? chart.left + index * (chartRight - chart.left) / (entries.length - 1) : (chart.left + chartRight) / 2,
      y: chart.bottom - entry.seconds / maxSeconds * (chart.bottom - chart.top),
      date: entry.date,
      seconds: entry.seconds,
      label: days === 7
        ? new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(date)
        : index === 0 || index === entries.length - 1 || (index % 7 === 0 && index < entries.length - 7)
          ? new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date)
          : '',
      fullDate: new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'short', day: 'numeric' }).format(date),
    }
  })
  const linePath = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ')
  const areaPath = points.length ? `${linePath} L ${points.at(-1)?.x} ${chart.bottom} L ${points[0]?.x} ${chart.bottom} Z` : ''
  const midpoint = maxSeconds / 2
  const ticks = [...new Set([maxSeconds, midpoint, 0])]
  const totalSeconds = entries.reduce((sum, entry) => sum + entry.seconds, 0)

  return (
    <div ref={containerRef} className="h-[230px] w-full" role="img" aria-label={`Focus time chart: ${formatMinutes(totalSeconds)} in the last ${days} days`}>
      {loading
        ? <div className="flex h-full items-center justify-center text-sm text-muted-foreground"><LoaderCircle className="mr-2 animate-spin" size={16} />Updating your focus history…</div>
        : <svg className="h-full w-full" viewBox={`0 0 ${chartWidth} ${chartHeight}`} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
        <defs>
          <linearGradient id="daily-focus-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#527f76" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#527f76" stopOpacity="0.015" />
          </linearGradient>
        </defs>
        {ticks.map((tick) => {
          const y = chart.bottom - tick / maxSeconds * (chart.bottom - chart.top)
          return <g key={tick}>
            <line x1={chart.left} x2={chartRight} y1={y} y2={y} stroke="var(--chart-grid)" strokeDasharray={tick === 0 ? undefined : '3 5'} />
            <text x="31" y={y + 4} textAnchor="end" fill="var(--muted-foreground)" fontSize="11" fontWeight="500" fontFamily="Inter, ui-sans-serif, system-ui, sans-serif">{formatAxisTime(tick)}</text>
          </g>
        })}
        {areaPath && <path d={areaPath} fill="url(#daily-focus-fill)" />}
        {linePath && <path d={linePath} fill="none" stroke="#527f76" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}
        {points.map((point) => <g key={point.date}>
          <title>{`${point.fullDate}: ${formatMinutes(point.seconds)} focused`}</title>
          {days === 7 && <circle cx={point.x} cy={point.y} r="8" fill="#527f76" fillOpacity="0.1" />}
          <circle cx={point.x} cy={point.y} r={days === 7 ? 3.5 : 2.25} fill="#527f76" stroke="var(--card)" strokeWidth={days === 7 ? 2 : 1.5} />
          {point.label && <text x={point.x} y="207" textAnchor="middle" fill="var(--muted-foreground)" fontSize="11" fontWeight="500" fontFamily="Inter, ui-sans-serif, system-ui, sans-serif">{point.label}</text>}
        </g>)}
      </svg>
      }
    </div>
  )
}
