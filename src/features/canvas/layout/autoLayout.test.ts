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

  it('wraps long linear chains into readable rows instead of one endless line', async () => {
    const ids = Array.from({ length: 10 }, (_, index) => `node-${index}`)
    const nodes = ids.map((id) => makeNode(id))
    const edges = ids.slice(0, -1).map((id, index) => makeEdge(id, ids[index + 1]))
    const result = await layoutGraph({ nodes, edges })
    const byId = new Map(result.nodes.map((node) => [node.id, node]))

    expect(new Set(result.nodes.map((node) => node.y)).size).toBeGreaterThan(1)
    expect(byId.get('node-5')!.y).toBe(byId.get('node-0')!.y)
    expect(byId.get('node-6')!.y).toBeGreaterThan(byId.get('node-0')!.y)
    expect(byId.get('node-6')!.x).toBeLessThan(byId.get('node-5')!.x)
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

  it('does not collapse a generated process into one vertical column when feedback loops are present', async () => {
    const ids = [
      'start',
      'stage-1',
      'act-2',
      'act-3',
      'act-4',
      'act-5',
      'dec-6',
      'act-7',
      'act-8',
      'stage-9',
      'end',
    ]
    const nodes = ids.map((id) => makeNode(id))
    const edges = [
      makeEdge('start', 'stage-1'),
      makeEdge('stage-1', 'act-2'),
      makeEdge('act-2', 'act-3'),
      makeEdge('act-3', 'act-4'),
      makeEdge('act-4', 'act-5'),
      makeEdge('act-5', 'dec-6'),
      makeEdge('dec-6', 'act-7'),
      makeEdge('act-7', 'act-8'),
      makeEdge('act-8', 'stage-9'),
      makeEdge('stage-9', 'end'),
      makeEdge('dec-6', 'act-4'),
      makeEdge('act-8', 'act-2'),
    ]

    const result = await layoutGraph({ nodes, edges })
    const byId = new Map(result.nodes.map((node) => [node.id, node]))
    const mainline = ['start', 'stage-1', 'act-2', 'act-3', 'act-4', 'act-5', 'dec-6', 'act-7', 'act-8', 'stage-9', 'end']

    for (let index = 1; index < mainline.length; index++) {
      const previous = byId.get(mainline[index - 1])!
      const current = byId.get(mainline[index])!
      expect(current.x > previous.x || current.y > previous.y).toBe(true)
    }
    expect(new Set(result.nodes.map((node) => node.x)).size).toBeGreaterThanOrEqual(6)
    expect(new Set(result.nodes.map((node) => node.y)).size).toBeGreaterThanOrEqual(2)
  })

  it('leaves readable horizontal space between wide generated nodes', async () => {
    const nodes = [
      { ...makeNode('stage', 0, 0, 280, 132), type: 'stage' as const },
      makeNode('activity', 0, 0, 220, 112),
    ]
    const result = await layoutGraph({ nodes, edges: [makeEdge('stage', 'activity')] })
    const byId = new Map(result.nodes.map((node) => [node.id, node]))
    const stage = byId.get('stage')!
    const activity = byId.get('activity')!

    expect(activity.x - (stage.x + 280)).toBeGreaterThanOrEqual(280)
  })

  it('leaves readable vertical lanes between parallel nodes in the same column', async () => {
    const nodes = [
      makeNode('start', 0, 0, 120, 56),
      makeNode('activity-a', 0, 0, 220, 112),
      makeNode('activity-b', 0, 0, 220, 112),
    ]
    const result = await layoutGraph({
      nodes,
      edges: [
        makeEdge('start', 'activity-a'),
        makeEdge('start', 'activity-b'),
      ],
    })
    const byId = new Map(result.nodes.map((node) => [node.id, node]))
    const a = byId.get('activity-a')!
    const b = byId.get('activity-b')!

    expect(Math.abs(a.y - b.y) - 112).toBeGreaterThanOrEqual(120)
  })
})
