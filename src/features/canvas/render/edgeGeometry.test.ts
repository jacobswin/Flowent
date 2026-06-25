import { describe, expect, it } from 'vitest'
import type { GraphEdge, GraphNode } from '../canvasTypes'
import { getEdgeControlPoints, getEdgeLabelCenter } from './edgeGeometry'

function makeNode(id: string, x: number, y: number): GraphNode {
  return {
    id,
    type: 'activity',
    x,
    y,
    width: 100,
    height: 60,
    title: id,
    roleTags: [],
    ports: [
      { id: 'out', side: 'right' },
      { id: 'in', side: 'left' },
    ],
  }
}

describe('edgeGeometry helpers', () => {
  it('returns bezier control points for a simple left-to-right edge', () => {
    const nodes = new Map<string, GraphNode>([
      ['a', makeNode('a', 0, 0)],
      ['b', makeNode('b', 200, 0)],
    ])
    const edge: GraphEdge = {
      id: 'e1',
      label: '',
      sourceNodeId: 'a',
      sourcePortId: 'out',
      targetNodeId: 'b',
      targetPortId: 'in',
    }

    const points = getEdgeControlPoints(edge, nodes)

    expect(points).toEqual({
      from: { x: 100, y: 30 },
      to: { x: 200, y: 30 },
      cp1: { x: 125, y: 30 },
      cp2: { x: 175, y: 30 },
    })
  })

  it('returns the on-canvas label center at t=0.5', () => {
    const nodes = new Map<string, GraphNode>([
      ['a', makeNode('a', 0, 0)],
      ['b', makeNode('b', 200, 0)],
    ])
    const edge: GraphEdge = {
      id: 'e1',
      label: '',
      sourceNodeId: 'a',
      sourcePortId: 'out',
      targetNodeId: 'b',
      targetPortId: 'in',
    }

    const center = getEdgeLabelCenter(edge, nodes)

    expect(center).toEqual({ x: 150, y: 30 })
  })
})
