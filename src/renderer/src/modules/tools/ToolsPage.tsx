import { useState } from 'react'
import { ArrowLeft, ArrowRight, Command, Inbox, Wrench } from 'lucide-react'
import { ProductivityToolRegistry, type ProductivityToolCategory } from './ProductivityToolRegistry'
import { Button } from '../../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card'
import { Badge } from '../../components/ui/badge'

const categoryNames: Record<ProductivityToolCategory, string> = {
  capture: 'Capture',
  planning: 'Planning',
  review: 'Review',
  utilities: 'Utilities',
}

export function ToolsPage({ registry }: { registry: ProductivityToolRegistry }) {
  const [activeToolId, setActiveToolId] = useState<string | null>(null)
  const activeTool = activeToolId ? registry.get(activeToolId) : undefined

  if (activeTool) {
    const ToolView = activeTool.View
    return <div className="space-y-5">
      <Button variant="ghost" size="sm" onClick={() => setActiveToolId(null)}><ArrowLeft size={14} />All tools</Button>
      <div><div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">{categoryNames[activeTool.category]}</div><h1 className="text-[28px] font-semibold tracking-[-0.04em] sm:text-[32px]">{activeTool.name}</h1><p className="mt-1.5 text-sm text-muted-foreground">{activeTool.description}</p></div>
      <ToolView onBack={() => setActiveToolId(null)} />
    </div>
  }

  const tools = registry.list()
  return <div>
    <div className="mb-7"><div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">Workspace</div><h1 className="text-[28px] font-semibold tracking-[-0.04em] sm:text-[32px]">Tools</h1><p className="mt-1.5 text-sm text-muted-foreground">Small, focused utilities for making your day easier.</p></div>

    <div className="grid gap-5 xl:grid-cols-2">
      <Card>
        <CardHeader className="items-center"><div><CardTitle>Your tools</CardTitle><p className="mt-1 text-xs text-muted-foreground">Each tool is a small, independent part of Dayplan.</p></div><Badge>{tools.length} {tools.length === 1 ? 'tool' : 'tools'}</Badge></CardHeader>
        <CardContent>
          {tools.length ? <div className="grid gap-3 sm:grid-cols-2">{tools.map((tool) => {
            const Icon = tool.icon
            return <button key={tool.id} type="button" onClick={() => setActiveToolId(tool.id)} className="group rounded-xl border border-border/70 bg-card p-4 text-left transition hover:border-primary/35 hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
              <div className="flex items-start justify-between gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon size={17} /></span><ArrowRight size={15} className="mt-1 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-foreground" /></div>
              <div className="mt-3 text-sm font-semibold">{tool.name}</div>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">{tool.description}</p>
              <span className="mt-3 block text-[10px] font-medium uppercase tracking-[0.1em] text-primary">{categoryNames[tool.category]}</span>
            </button>
          })}</div> : <div className="flex min-h-44 flex-col items-center justify-center rounded-xl border border-dashed border-border px-6 py-7 text-center">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-muted-foreground"><Wrench size={18} /></span>
            <h2 className="mt-3 text-sm font-semibold">Your tool shelf is ready</h2>
            <p className="mt-1 max-w-sm text-xs leading-5 text-muted-foreground">There are no tools yet. Each new tool will live here as its own focused module.</p>
          </div>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><div><CardTitle className="flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary"><Inbox size={15} /></span>Recommended first tool</CardTitle><p className="mt-1 text-xs text-muted-foreground">A small feature with immediate everyday value.</p></div></CardHeader>
        <CardContent>
          <div className="rounded-xl border border-primary/15 bg-primary/[0.035] p-4">
            <div className="flex items-center gap-2"><Command size={15} className="text-primary" /><h2 className="text-sm font-semibold">Quick Capture</h2><Badge className="ml-auto">Suggested</Badge></div>
            <p className="mt-3 text-xs leading-5 text-muted-foreground">Open a tiny capture window with a keyboard shortcut, type a thought, press Enter, and send it straight to the Todoist Inbox. Then get back to what you were doing.</p>
            <div className="mt-4 border-t border-border/60 pt-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Why start here</p>
              <p className="mt-1 text-xs leading-5 text-foreground/80">It reuses Dayplan’s existing task service, needs no new database tables, and makes capturing interruptions much faster.</p>
            </div>
          </div>
          <p className="mt-3 text-[11px] leading-5 text-muted-foreground">AI/MCP actions can be added later as adapters to the same application service; the tool catalog remains a separate UI module.</p>
        </CardContent>
      </Card>
    </div>
  </div>
}
