import { describe, expect, it } from 'vitest'
import type { GraphNode } from '../canvasTypes'
import { findNearestTargetPort } from './ports'

function makeNode(overrides: Partial<GraphNode> = {}): GraphNode {
  return {
    id: 'node-1',
    type: 'activity',
    x: 100,
    y: 200,
    width: 220,
    height: 96,
    title: 'Node',
    roleTags: [],
    ports: [
      { id: 'in', side: 'left' },
      { id: 'review', side: 'top' },
      { id: 'out', side: 'right' },
    ],
    ...overrides,
  }
}

describe('findNearestTargetPort', () => {
  it('returns the nearest port within the snapping radius', () => {
    const node = makeNode()

    const snapped = findNearestTargetPort(node, { x: 210, y: 206 })

    expect(snapped?.id).toBe('review')
  })

  it('returns the default target port when the pointer is not near any port', () => {
    const node = makeNode()

    const snapped = findNearestTargetPort(node, { x: 205, y: 248 }, 12)

    expect(snapped?.id).toBe('in')
  })

  it('returns null when the node has no ports', () => {
    const node = makeNode({ ports: [] })

    const snapped = findNearestTargetPort(node, { x: 120, y: 220 })

    expect(snapped).toBeNull()
  })
})
