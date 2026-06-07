import { describe, it, expect } from 'vitest'
import { layoutGraph } from './autoLayout'
import type { GraphEdge, GraphNode } from '../canvasTypes'

function makeNode(id: string, x = 0, y = 0, w = 200, h = 80): GraphNode {
  return {
    id,
    type: 'activity',
    x,
    y,
    width: w,
    height: h,
    title: id,
    roleTags: [],
    ports: [],
  }
}

function makeEdge(source: string, target: string): GraphEdge {
  return {
    id: `${source}->${target}`,
    sourceNodeId: source,
    sourcePortId: 'out',
    targetNodeId: target,
    targetPortId: 'in',
    label: '',
  }
}

describe('layoutGraph — left-to-right flow', () => {
  it('places root in column 0 and downstream nodes in later columns (X grows with depth)', async () => {
    const nodes = [makeNode('a'), makeNode('b'), makeNode('c')]
    const edges = [makeEdge('a', 'b'), makeEdge('b', 'c')]
    const result = await layoutGraph({ nodes, edges })

    const byId = new Map(result.nodes.map((p) => [p.id, p]))
    const a = byId.get('a')!
    const b = byId.get('b')!
    const c = byId.get('c')!

    // Each downstream step moves right, not down.
    expect(b.x).toBeGreaterThan(a.x)
    expect(c.x).toBeGreaterThan(b.x)

    // Successor sits to the right of predecessor (no Y growth for linear chain).
    // We allow the same Y (strictly horizontal) or higher X with no Y requirement
    // except that Y must NOT keep increasing along the chain (which would be top-down).
    expect(b.y).toBe(a.y)
    expect(c.y).toBe(a.y)
  })

  it('keeps siblings of the same level on the same X (column) but different Y (row)', async () => {
    // a -> b, a -> c  → a is level 0, b and c are level 1
    const nodes = [makeNode('a'), makeNode('b'), makeNode('c')]
    const edges = [makeEdge('a', 'b'), makeEdge('a', 'c')]
    const result = await layoutGraph({ nodes, edges })

    const byId = new Map(result.nodes.map((p) => [p.id, p]))
    const a = byId.get('a')!
    const b = byId.get('b')!
    const c = byId.get('c')!

    // Siblings share the column (X), not the row (Y).
    expect(b.x).toBe(c.x)
    expect(b.y).not.toBe(c.y)
    // Root is in the first column.
    expect(a.x).toBeLessThan(b.x)
  })

  it('places a linear chain at the same Y (purely horizontal flow)', async () => {
    const nodes = [makeNode('a'), makeNode('b'), makeNode('c'), makeNode('d')]
    const edges = [makeEdge('a', 'b'), makeEdge('b', 'c'), makeEdge('c', 'd')]
    const result = await layoutGraph({ nodes, edges })

    const ys = new Set(result.nodes.map((n) => n.y))
    expect(ys.size).toBe(1)

    // X strictly increases along the chain order.
    const xs = ['a', 'b', 'c', 'd'].map((id) => result.nodes.find((n) => n.id === id)!.x)
    for (let i = 1; i < xs.length; i++) {
      expect(xs[i]).toBeGreaterThan(xs[i - 1])
    }
  })

  it('lays out disconnected nodes in distinct columns (still left-to-right)', async () => {
    // No edges: every node is a root. Auto-layout should still spread them
    // horizontally across columns rather than stacking them all in column 0,
    // because a vertical column is the wrong reading direction for this product.
    const nodes = [makeNode('a'), makeNode('b'), makeNode('c'), makeNode('d')]
    const edges: GraphEdge[] = []
    const result = await layoutGraph({ nodes, edges })

    const xs = new Set(result.nodes.map((n) => n.x))
    // At least 3 of 4 nodes should land in different X buckets — meaning
    // the layout is "horizontal-leaning" rather than a single vertical stack.
    expect(xs.size).toBeGreaterThanOrEqual(3)
  })
})
