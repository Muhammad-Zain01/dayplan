import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { DashboardMetrics } from '../../../shared/domain'
import { LoaderCircle } from 'lucide-react'

export default function DashboardCompletionChart({ metrics, loading }: { metrics: DashboardMetrics | null; loading: boolean }) {
  if (loading) return <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground"><LoaderCircle className="mr-2 animate-spin" size={16} />Updating your week…</div>

  return <div className="h-[220px] w-full">
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={metrics?.recentCompletions ?? []} margin={{ top: 12, right: 8, bottom: 0, left: -20 }}>
        <defs><linearGradient id="completionGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#5f8f87" stopOpacity={0.2} /><stop offset="95%" stopColor="#5f8f87" stopOpacity={0.01} /></linearGradient></defs>
        <CartesianGrid strokeDasharray="3 4" vertical={false} stroke="var(--chart-grid)" />
        <XAxis dataKey="date" axisLine={false} tickLine={false} tickMargin={12} tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} tickFormatter={(date: string) => new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(new Date(`${date}T12:00:00`))} />
        <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }} />
        <Tooltip cursor={{ stroke: '#a7c1bb', strokeDasharray: '4 4' }} contentStyle={{ borderRadius: 12, borderColor: 'var(--border)', background: 'var(--card)', color: 'var(--foreground)', fontSize: 12 }} labelFormatter={(date) => new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'short', day: 'numeric' }).format(new Date(`${date}T12:00:00`))} />
        <Area type="monotone" dataKey="count" stroke="#5b8b82" strokeWidth={2.5} fill="url(#completionGradient)" activeDot={{ r: 4, fill: '#5b8b82', stroke: 'var(--card)', strokeWidth: 2 }} />
      </AreaChart>
    </ResponsiveContainer>
  </div>
}
