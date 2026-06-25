import { describe, expect, it, vi } from 'vitest'

// Stub Pixi's Text before drawEdges imports it. jsdom has no canvas font
// metrics, so the real Text constructor throws when measuring strings.
// We don't care about Text visuals here — only about whether the
// label hit pad is routed to the correct parent. The stub extends
// Container so it satisfies Pixi's addChild child-type checks.
vi.mock('pixi.js', async () => {
  const actual = await vi.importActual<typeof import('pixi.js')>('pixi.js')
  // StubText extends Container but redefines a few fields that
  // Container now declares as accessors in Pixi v8. We use
  // accessor methods to avoid TS2610 access-overridden errors.
  class StubText extends actual.Container {
    override label: string = 'text'
    override get width(): number {
      return 16
    }
    override set width(_value: number) {
      // no-op
    }
    override get height(): number {
      return 16
    }
    override set height(_value: number) {
      // no-op
    }
  }
  return { ...actual, Text: StubText as unknown as typeof actual.Text }
})

import { Container } from 'pixi.js'
import type { FederatedPointerEvent } from 'pixi.js'
import { drawEdges, getDisplayEdgeLabel, getEdgeStrokeColor, getSelectedEdgeMetadataText } from './drawEdges'
import type { GraphEdge, GraphNode } from '../canvasTypes'

function makeNode(id: string, x: number, y: number): GraphNode {
  return {
    id,
    type: 'activity',
    title: id,
    x,
    y,
    width: 100,
    height: 60,
    roleTags: [],
    ports: [
      { id: 'out', side: 'right' },
      { id: 'in', side: 'left' },
    ],
  }
}

function makeEdge(id: string, label: string, sourceId: string, targetId: string): GraphEdge {
  return {
    id,
    label,
    sourceNodeId: sourceId,
    sourcePortId: 'out',
    targetNodeId: targetId,
    targetPortId: 'in',
  }
}

describe('drawEdges labelHitLayer', () => {
  it('adds the label hit pad to the main layer when no labelHitLayer is supplied', () => {
    const edgeLayer = new Container()
    const nodesById = new Map<string, GraphNode>([
      ['a', makeNode('a', 0, 0)],
      ['b', makeNode('b', 200, 0)],
    ])
    const edges: GraphEdge[] = [makeEdge('e1', 'handoff', 'a', 'b')]

    drawEdges(edgeLayer, edges, nodesById, {})

    const labelHits = edgeLayer.children.filter((c) => c.label?.startsWith('edge-label-hit:'))
    expect(labelHits).toHaveLength(1)
  })

  it('routes the label hit pad to the supplied labelHitLayer instead of the main layer', () => {
    const edgeLayer = new Container()
    const labelHitLayer = new Container()
    const nodesById = new Map<string, GraphNode>([
      ['a', makeNode('a', 0, 0)],
      ['b', makeNode('b', 200, 0)],
    ])
    const edges: GraphEdge[] = [makeEdge('e1', 'handoff', 'a', 'b')]

    drawEdges(edgeLayer, edges, nodesById, { labelHitLayer })

    const mainLabelHits = edgeLayer.children.filter((c) =>
      c.label?.startsWith('edge-label-hit:'),
    )
    const overlayLabelHits = labelHitLayer.children.filter((c) =>
      c.label?.startsWith('edge-label-hit:'),
    )

    expect(mainLabelHits).toHaveLength(0)
    expect(overlayLabelHits).toHaveLength(1)
  })

  it('routes the edge hit area to the supplied edgeHitLayer instead of the main layer', () => {
    const edgeLayer = new Container()
    const edgeHitLayer = new Container()
    const nodesById = new Map<string, GraphNode>([
      ['a', makeNode('a', 0, 0)],
      ['b', makeNode('b', 200, 0)],
    ])
    const edges: GraphEdge[] = [makeEdge('e1', '', 'a', 'b')]

    drawEdges(edgeLayer, edges, nodesById, { edgeHitLayer })

    expect(edgeLayer.children.some((c) => c.label === 'edge-hit:e1')).toBe(false)
    expect(edgeHitLayer.children.some((c) => c.label === 'edge-hit:e1')).toBe(true)
  })
})

describe('drawEdges visual helpers', () => {
  it('hides the label when the edge has no label', () => {
    expect(getDisplayEdgeLabel('')).toBeNull()
    expect(getDisplayEdgeLabel(undefined)).toBeNull()
    expect(getDisplayEdgeLabel('PM handoff')).toBe('PM handoff')
  })

  it('uses a dark default stroke and supports custom edge colors', () => {
    expect(getEdgeStrokeColor(makeEdge('e1', '', 'a', 'b'))).toBe(0x111827)
    expect(getEdgeStrokeColor({ ...makeEdge('e1', '', 'a', 'b'), color: '#dc2626' })).toBe(0xdc2626)
  })

  it('formats selected-edge metadata compactly from roles and artifact', () => {
    expect(
      getSelectedEdgeMetadataText({
        fromRole: 'PM',
        toRole: 'Engineer',
        artifact: 'Ready brief',
      }),
    ).toBe('PM → Engineer · Ready brief')

    expect(getSelectedEdgeMetadataText({ artifact: 'Ready brief' })).toBe('Ready brief')
    expect(getSelectedEdgeMetadataText({})).toBe('')
  })
})

describe('drawEdges pointer interactions', () => {
  it('does not open the label editor on edge double-click', () => {
    const edgeLayer = new Container()
    const nodesById = new Map<string, GraphNode>([
      ['a', makeNode('a', 0, 0)],
      ['b', makeNode('b', 200, 0)],
    ])
    const edges: GraphEdge[] = [makeEdge('e1', '', 'a', 'b')]
    const onOpenLabelEditor = vi.fn()

    drawEdges(edgeLayer, edges, nodesById, {
      onEdgeClick: vi.fn(),
      onOpenLabelEditor,
    })

    const hit = edgeLayer.children.find((child) => child.label === 'edge-hit:e1')
    const event = {
      shiftKey: false,
      ctrlKey: false,
      metaKey: false,
      stopPropagation: vi.fn(),
      getLocalPosition: () => ({ x: 148, y: 32 }),
    } as unknown as FederatedPointerEvent

    hit?.emit('pointertap', event)
    hit?.emit('pointertap', event)

    expect(onOpenLabelEditor).not.toHaveBeenCalled()
  })

  it('keeps edge double-click as selection-only across a redraw after the first click', () => {
    const edgeLayer = new Container()
    const nodesById = new Map<string, GraphNode>([
      ['a', makeNode('a', 0, 0)],
      ['b', makeNode('b', 200, 0)],
    ])
    const edges: GraphEdge[] = [makeEdge('e1', '', 'a', 'b')]
    const onEdgeClick = vi.fn()
    const onOpenLabelEditor = vi.fn()
    const event = {
      shiftKey: false,
      ctrlKey: false,
      metaKey: false,
      stopPropagation: vi.fn(),
      getLocalPosition: () => ({ x: 148, y: 32 }),
    } as unknown as FederatedPointerEvent

    drawEdges(edgeLayer, edges, nodesById, {
      onEdgeClick,
      onOpenLabelEditor,
    })
    edgeLayer.children.find((child) => child.label === 'edge-hit:e1')?.emit('pointertap', event)

    drawEdges(edgeLayer, edges, nodesById, {
      selectedEdgeIds: new Set(['e1']),
      onEdgeClick,
      onOpenLabelEditor,
    })
    edgeLayer.children.find((child) => child.label === 'edge-hit:e1')?.emit('pointertap', event)

    expect(onOpenLabelEditor).not.toHaveBeenCalled()
    expect(onEdgeClick).toHaveBeenCalledTimes(2)
  })
})
