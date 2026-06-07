import { describe, expect, it } from 'vitest'
import { createEmptyDocument, addNode } from '../engine/graphDocument'
import { createGraphNode } from '../processElements'
import { getBottleneckMetrics } from './bottleneckMetrics'

describe('getBottleneckMetrics', () => {
  it('returns zeros for an empty doc', () => {
    const doc = createEmptyDocument('doc')
    expect(getBottleneckMetrics(doc)).toEqual({ total: 0, approved: 0, open: 0, openRatio: 0 })
  })

  it('counts only bottleneck nodes', () => {
    let doc = createEmptyDocument('doc')
    doc = addNode(doc, createGraphNode('activity', 'a', { x: 0, y: 0 }))
    doc = addNode(doc, createGraphNode('decision', 'b', { x: 200, y: 0 }))
    doc = addNode(doc, createGraphNode('bottleneck', 'c', { x: 400, y: 0 }))
    expect(getBottleneckMetrics(doc).total).toBe(1)
  })

  it('separates approved from open bottlenecks and reports ratio', () => {
    let doc = createEmptyDocument('doc')
    doc = addNode(doc, { ...createGraphNode('bottleneck', 'a', { x: 0, y: 0 }), reviewStatus: 'approved' })
    doc = addNode(doc, { ...createGraphNode('bottleneck', 'b', { x: 200, y: 0 }), reviewStatus: 'unclear' })
    doc = addNode(doc, { ...createGraphNode('bottleneck', 'c', { x: 400, y: 0 }), reviewStatus: 'needs-owner' })
    doc = addNode(doc, createGraphNode('bottleneck', 'd', { x: 600, y: 0 })) // no reviewStatus

    const metrics = getBottleneckMetrics(doc)
    expect(metrics.total).toBe(4)
    expect(metrics.approved).toBe(1)
    expect(metrics.open).toBe(3)
    expect(metrics.openRatio).toBeCloseTo(0.75)
  })
})
