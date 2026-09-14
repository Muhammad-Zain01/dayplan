import { describe, expect, it } from 'vitest'
import { Timer } from 'lucide-react'
import { ProductivityToolRegistry, type ProductivityToolDefinition } from './ProductivityToolRegistry'

const ToolView = (_props: { onBack: () => void }) => null

function createTool(id: string, name = id): ProductivityToolDefinition {
  return { id, name, description: `${name} description`, category: 'utilities', icon: Timer, View: ToolView }
}

describe('ProductivityToolRegistry', () => {
  it('registers and lists built-in tools in registration order', () => {
    const registry = new ProductivityToolRegistry([createTool('first'), createTool('second')])

    expect(registry.list().map(({ id }) => id)).toEqual(['first', 'second'])
    expect(registry.get('second')?.name).toBe('second')
  })

  it('rejects duplicate tool identifiers', () => {
    const registry = new ProductivityToolRegistry([createTool('quick-capture')])

    expect(() => registry.register(createTool('quick-capture'))).toThrow('already registered')
  })

  it('rejects unstable tool identifiers', () => {
    const registry = new ProductivityToolRegistry()

    expect(() => registry.register(createTool('Quick Capture'))).toThrow('Invalid productivity tool id')
  })
})
