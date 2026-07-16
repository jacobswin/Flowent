import { describe, expect, it } from 'vitest'
import type { GraphDocument, GraphNode } from '../canvasTypes'
import { createEmptyDocument } from '../engine/graphDocument'
import { createGraphNode, createHandoffEdge } from '../processElements'
import { layoutFlowGraph } from './flowLayout'

function centerY(node: GraphNode): number {
  return node.y + node.height / 2
}

function makeLinearDocument(): GraphDocument {
  let doc = createEmptyDocument('flow-layout')
  const start = createGraphNode('start', 'start', { x: 0, y: 0 })
  const first = createGraphNode('activity', 'first', { x: 0, y: 0 })
  const second = createGraphNode('activity', 'second', { x: 0, y: 0 })
  const end = createGraphNode('end', 'end', { x: 0, y: 0 })
  doc = {
    ...doc,
    nodes: new Map([start, first, second, end].map((node) => [node.id, node])),
    edges: new Map([
      createHandoffEdge('start-first', 'start', 'out', 'first', 'in'),
      createHandoffEdge('first-second', 'first', 'out', 'second', 'in'),
      createHandoffEdge('second-end', 'second', 'out', 'end', 'in'),
    ].map((edge) => [edge.id, edge])),
  }
  return doc
}

describe('layoutFlowGraph', () => {
  it('keeps a linear flow compact while vertically centering unlike-sized nodes', async () => {
    const result = await layoutFlowGraph(makeLinearDocument())
    const start = result.nodes.get('start')!
    const first = result.nodes.get('first')!
    const second = result.nodes.get('second')!
    const end = result.nodes.get('end')!

    expect(centerY(start)).toBeCloseTo(centerY(first), 0)
    expect(centerY(first)).toBeCloseTo(centerY(second), 0)
    expect(centerY(second)).toBeCloseTo(centerY(end), 0)
    expect(first.x - (start.x + start.width)).toBeLessThanOrEqual(260)
    expect(second.x - (first.x + first.width)).toBeLessThanOrEqual(140)
  })

  it('keeps Stage containers around their members without treating the Stage as a flow endpoint', async () => {
    const doc = makeLinearDocument()
    const stage = {
      ...createGraphNode('stage', 'stage-1', { x: 0, y: 0 }),
      memberNodeIds: ['first', 'second'],
    }
    const result = await layoutFlowGraph({ ...doc, nodes: new Map([...doc.nodes, [stage.id, stage]]) })
    const first = result.nodes.get('first')!
    const second = result.nodes.get('second')!
    const container = result.nodes.get('stage-1')!

    expect(container.x).toBeLessThanOrEqual(first.x - 24)
    expect(container.x + container.width).toBeGreaterThanOrEqual(second.x + second.width + 24)
    expect(container.ports).toEqual([])
  })
})
