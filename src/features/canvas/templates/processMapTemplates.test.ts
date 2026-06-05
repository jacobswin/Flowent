import { describe, expect, it } from 'vitest'
import { PROCESS_MAP_TEMPLATES, createTemplateDocument } from './processMapTemplates'

describe('processMapTemplates', () => {
  it('offers blank, discovery, and delivery handoff templates', () => {
    expect(PROCESS_MAP_TEMPLATES.map((template) => template.id)).toEqual([
      'blank',
      'product-discovery',
      'delivery-handoff',
    ])
  })

  it('creates a blank document with a start node', () => {
    const doc = createTemplateDocument('blank', 'map-1')

    expect(doc.id).toBe('map-1')
    expect(doc.nodes.has('start')).toBe(true)
    expect(doc.edges.size).toBe(0)
  })

  it('creates a product discovery template with decisions and handoffs', () => {
    const doc = createTemplateDocument('product-discovery', 'map-2')

    const nodeTypes = Array.from(doc.nodes.values()).map((node) => node.type)
    expect(nodeTypes).toContain('stage')
    expect(nodeTypes).toContain('activity')
    expect(nodeTypes).toContain('decision')
    expect(doc.edges.size).toBeGreaterThan(1)
  })

  it('creates a delivery handoff template with semantic handoff edges', () => {
    const doc = createTemplateDocument('delivery-handoff', 'map-3')

    const handoff = Array.from(doc.edges.values()).find((edge) => edge.kind === 'handoff')
    expect(handoff).toBeTruthy()
    expect(handoff?.expectation).toBe('Ready work moves with context, owner, and acceptance expectations.')
  })
})
