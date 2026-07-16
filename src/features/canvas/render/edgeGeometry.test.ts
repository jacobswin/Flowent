import { describe, expect, it } from 'vitest'
import type { GraphEdge, GraphNode } from '../canvasTypes'
import { getEdgeLabelCenter, getEdgeRoutePoints } from './edgeGeometry'

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
  it('returns a straight route for aligned left-to-right edge anchors', () => {
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

    const points = getEdgeRoutePoints(edge, nodes)

    expect(points).toEqual([{ x: 100, y: 30 }, { x: 200, y: 30 }])
  })

  it('returns only axis-aligned segments for offset edge anchors', () => {
    const nodes = new Map<string, GraphNode>([
      ['a', makeNode('a', 0, 0)],
      ['b', makeNode('b', 220, 160)],
    ])
    const edge: GraphEdge = {
      id: 'e1',
      label: '',
      sourceNodeId: 'a',
      sourcePortId: 'bottom',
      sourceAnchor: { side: 'bottom', offset: 0.75 },
      targetNodeId: 'b',
      targetPortId: 'top',
      targetAnchor: { side: 'top', offset: 0.25 },
    }

    const points = getEdgeRoutePoints(edge, nodes)

    expect(points?.[0]).toEqual({ x: 75, y: 60 })
    expect(points?.at(-1)).toEqual({ x: 245, y: 160 })
    for (let i = 1; i < (points?.length ?? 0); i += 1) {
      expect(points![i - 1].x === points![i].x || points![i - 1].y === points![i].y).toBe(true)
    }
  })

  it('routes around intermediate nodes instead of crossing through them', () => {
    const nodes = new Map<string, GraphNode>([
      ['a', makeNode('a', 0, 0)],
      ['middle', makeNode('middle', 175, 0)],
      ['b', makeNode('b', 350, 0)],
    ])
    const edge: GraphEdge = {
      id: 'e1',
      label: '',
      sourceNodeId: 'a',
      sourcePortId: 'out',
      targetNodeId: 'b',
      targetPortId: 'in',
    }

    const points = getEdgeRoutePoints(edge, nodes)

    expect(points).toBeTruthy()
    for (let index = 1; index < points!.length; index += 1) {
      expect(segmentIntersectsRect(points![index - 1], points![index], nodes.get('middle')!, 10)).toBe(false)
    }
  })

  it('returns the on-canvas label center on the longest orthogonal segment', () => {
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

function segmentIntersectsRect(
  a: { x: number; y: number },
  b: { x: number; y: number },
  rect: GraphNode,
  padding = 0,
): boolean {
  const left = rect.x - padding
  const right = rect.x + rect.width + padding
  const top = rect.y - padding
  const bottom = rect.y + rect.height + padding

  if (a.x === b.x) {
    if (a.x < left || a.x > right) return false
    const minY = Math.min(a.y, b.y)
    const maxY = Math.max(a.y, b.y)
    return maxY >= top && minY <= bottom
  }

  if (a.y === b.y) {
    if (a.y < top || a.y > bottom) return false
    const minX = Math.min(a.x, b.x)
    const maxX = Math.max(a.x, b.x)
    return maxX >= left && minX <= right
  }

  throw new Error('expected an orthogonal segment')
}
