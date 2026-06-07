import { describe, expect, it } from 'vitest'
import type { GraphNode } from '../canvasTypes'
import { getFallbackPortId, getPortAnchor, getPortSide } from './ports'

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
      { id: 'out', side: 'right' },
      { id: 'top', side: 'top' },
      { id: 'bottom', side: 'bottom' },
    ],
    ...overrides,
  }
}

describe('port routing helpers', () => {
  it('resolves anchors for every port side', () => {
    const node = makeNode()

    expect(getPortAnchor(node, 'in')).toEqual({ x: 100, y: 248, side: 'left' })
    expect(getPortAnchor(node, 'out')).toEqual({ x: 320, y: 248, side: 'right' })
    expect(getPortAnchor(node, 'top')).toEqual({ x: 210, y: 200, side: 'top' })
    expect(getPortAnchor(node, 'bottom')).toEqual({ x: 210, y: 296, side: 'bottom' })
  })

  it('falls back to source and target ports when a requested port is missing', () => {
    const node = makeNode({ ports: [{ id: 'out', side: 'right' }] })

    expect(getFallbackPortId(node, 'source')).toBe('out')
    expect(getFallbackPortId(node, 'target')).toBe('out')
    expect(getPortSide(node, 'missing')).toBe('right')
  })

  it('resolves decision output to the right side', () => {
    const decision = makeNode({
      type: 'decision',
      ports: [
        { id: 'in', side: 'left' },
        { id: 'out', side: 'right' },
      ],
    })

    expect(getPortAnchor(decision, 'out')).toEqual({ x: 320, y: 248, side: 'right' })
  })
})
