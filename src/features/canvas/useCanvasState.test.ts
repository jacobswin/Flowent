import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useCanvasState, migrateDecisionPorts } from './useCanvasState'
import { createEmptyDocument } from './engine/graphDocument'
import type { GraphDocument, GraphNode } from './canvasTypes'

describe('useCanvasState', () => {
  it('adds activity node from toolbar action', () => {
    const { result } = renderHook(() => useCanvasState())

    act(() => result.current.addActivity())

    expect(result.current.nodes.some((n) => n.data.kind === 'activity')).toBe(true)
  })

  it('adds decision and end nodes from toolbar actions', () => {
    const { result } = renderHook(() => useCanvasState())

    act(() => result.current.addDecision())
    act(() => result.current.addEnd())

    expect(result.current.nodes.some((n) => n.data.kind === 'decision')).toBe(true)
    expect(result.current.nodes.some((n) => n.data.kind === 'end')).toBe(true)
  })

  it('undoes and redoes node creation', () => {
    const { result } = renderHook(() => useCanvasState())

    const initialCount = result.current.nodes.length

    act(() => result.current.addActivity())
    const createdCount = result.current.nodes.length
    expect(createdCount).toBeGreaterThan(initialCount)

    act(() => result.current.undo())
    expect(result.current.nodes.length).toBe(initialCount)

    act(() => result.current.redo())
    expect(result.current.nodes.length).toBe(createdCount)
  })

  it('updates node data by id', () => {
    const { result } = renderHook(() => useCanvasState())

    act(() => {
      result.current.addActivity({ x: 120, y: 180 })
    })

    const createdNode = result.current.nodes.find((n) => n.data.kind === 'activity')
    expect(createdNode).toBeTruthy()

    act(() => {
      result.current.updateNodeData(createdNode!.id, {
        title: 'Updated activity title',
        summary: 'Updated activity summary',
      })
    })

    const updatedNode = result.current.nodes.find((n) => n.id === createdNode!.id)
    expect(updatedNode?.data.kind).toBe('activity')
    if (updatedNode?.data.kind === 'activity') {
      expect(updatedNode.data.title).toBe('Updated activity title')
      expect(updatedNode.data.summary).toBe('Updated activity summary')
    }
  })

  it('selects multiple nodes with additive click', () => {
    const { result } = renderHook(() => useCanvasState())

    act(() => result.current.addActivity({ x: 100, y: 100 }))
    act(() => result.current.addActivity({ x: 400, y: 100 }))

    const ids = result.current.nodes.map((n) => n.id)

    act(() => result.current.onNodeClick(ids[0], false))
    expect(result.current.selectedNodeIds.size).toBe(1)

    act(() => result.current.onNodeClick(ids[1], true))
    expect(result.current.selectedNodeIds.size).toBe(2)
  })

  it('removes selected node and connected edges', () => {
    const { result } = renderHook(() => useCanvasState())

    act(() => {
      result.current.addActivity({ x: 100, y: 200 })
    })

    const selectedIds = Array.from(result.current.selectedNodeIds)
    expect(selectedIds.length).toBe(1)

    act(() => {
      result.current.removeSelected()
    })

    expect(result.current.nodes.find((n) => n.id === selectedIds[0])).toBeUndefined()
  })

  it('preserves source and target port handles when creating an edge', () => {
    const { result } = renderHook(() => useCanvasState())

    act(() => result.current.addActivity({ x: 100, y: 100 }))
    act(() => result.current.addDecision({ x: 420, y: 100 }))

    const source = result.current.nodes.find((n) => n.data.kind === 'activity')
    const target = result.current.nodes.find((n) => n.data.kind === 'decision')
    expect(source).toBeTruthy()
    expect(target).toBeTruthy()

    act(() => {
      result.current.onConnect(source!.id, target!.id, 'out', 'in')
    })

    const edge = result.current.edges.find((e) => e.source === source!.id && e.target === target!.id)
    expect(edge).toBeTruthy()
    expect(edge?.sourceHandle).toBe('out')
    expect(edge?.targetHandle).toBe('in')
  })

  it('keeps the world point under the cursor anchored when zooming', () => {
    const { result } = renderHook(() => useCanvasState())

    // Place a point at world (200, 100) and simulate cursor at canvas (300, 150).
    // worldX = (300 - 0) / 1 = 300; after zoom=2 we want the same world point
    // under the cursor: 300 = (newX) + 300 * 2 → newX = -300
    act(() => {
      result.current.zoomAt(2, 300, 150)
    })

    const v = result.current.viewport
    expect(v.zoom).toBeCloseTo(2, 5)
    // World point that was at screen (300,150) before should still be there after.
    const worldX = (300 - v.x) / v.zoom
    const worldY = (150 - v.y) / v.zoom
    expect(worldX).toBeCloseTo(300, 5)
    expect(worldY).toBeCloseTo(150, 5)
  })

  it('clamps zoomAt to the [0.2, 3] range', () => {
    const { result } = renderHook(() => useCanvasState())

    act(() => {
      result.current.zoomAt(10, 0, 0)
    })
    expect(result.current.viewport.zoom).toBeLessThanOrEqual(3)

    act(() => {
      result.current.zoomAt(0.01, 0, 0)
    })
    expect(result.current.viewport.zoom).toBeGreaterThanOrEqual(0.2)
  })

  it('migrateDecisionPorts: 3-port decision becomes 2-port', () => {
    const legacy: GraphDocument = {
      ...createEmptyDocument('mig-test'),
      nodes: new Map<string, GraphNode>([
        [
          'd1',
          {
            id: 'd1',
            type: 'decision',
            x: 300, y: 300, width: 180, height: 108,
            title: 'Legacy',
            roleTags: [],
            ports: [
              { id: 'in', side: 'left' },
              { id: 'yes', side: 'top' },
              { id: 'no', side: 'bottom' },
            ],
          },
        ],
      ]),
    }
    const migrated = migrateDecisionPorts(legacy)
    const d1 = migrated.nodes.get('d1')!
    expect(d1.ports.map((p) => p.side)).toEqual(['left', 'right'])
  })

  it('migrateDecisionPorts: returns the same doc when no migration needed', () => {
    // already-new-schema document
    const base = createEmptyDocument('ok')
    const result = migrateDecisionPorts(base)
    expect(result).toBe(base)
  })

  it('quick-creates a connected activity from the selected start node', () => {
    const { result } = renderHook(() => useCanvasState())

    act(() => {
      result.current.onNodeClick('start', false)
    })
    act(() => {
      result.current.quickCreate('activity')
    })

    expect(result.current.nodes.some((node) => node.data.kind === 'activity')).toBe(true)
    expect(result.current.edges).toHaveLength(1)
    expect(result.current.edges[0]).toMatchObject({ source: 'start', type: 'handoff' })
  })

  it('adds stage and bottleneck nodes from typed canvas actions', () => {
    const { result } = renderHook(() => useCanvasState())

    act(() => result.current.addStage({ x: 100, y: 120 }))
    act(() => result.current.addBottleneck({ x: 400, y: 120 }))

    expect(result.current.nodes.some((node) => node.data.kind === 'stage')).toBe(true)
    expect(result.current.nodes.some((node) => node.data.kind === 'bottleneck')).toBe(true)
  })
})
