import type { ComponentType } from 'react'
import type { LucideIcon } from 'lucide-react'

export type ProductivityToolCategory = 'capture' | 'planning' | 'review' | 'utilities'

export interface ProductivityToolViewProps {
  onBack: () => void
}

export interface ProductivityToolDefinition {
  id: string
  name: string
  description: string
  category: ProductivityToolCategory
  icon: LucideIcon
  View: ComponentType<ProductivityToolViewProps>
}

export class ProductivityToolRegistry {
  private readonly tools = new Map<string, ProductivityToolDefinition>()

  constructor(definitions: readonly ProductivityToolDefinition[] = []) {
    for (const definition of definitions) this.register(definition)
  }

  register(definition: ProductivityToolDefinition): void {
    const id = definition.id.trim()
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) {
      throw new Error(`Invalid productivity tool id: ${definition.id}`)
    }
    if (this.tools.has(id)) throw new Error(`Productivity tool is already registered: ${id}`)
    this.tools.set(id, { ...definition, id })
  }

  get(id: string): ProductivityToolDefinition | undefined {
    return this.tools.get(id)
  }

  list(): readonly ProductivityToolDefinition[] {
    return [...this.tools.values()]
  }
}
