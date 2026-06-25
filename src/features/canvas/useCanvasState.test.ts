import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useCanvasState, migrateDecisionPorts } from './useCanvasState'
import { createEmptyDocument } from './engine/graphDocument'
import type { GraphDocument, GraphNode } from './canvasTypes'
import { getPortPosition } from './render/drawEdges'

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

  it('selects an edge without opening the editor until explicitly requested', () => {
    const { result } = renderHook(() => useCanvasState())

    act(() => result.current.addActivity({ x: 100, y: 100 }))
    act(() => result.current.addDecision({ x: 420, y: 100 }))

    const source = result.current.nodes.find((n) => n.data.kind === 'activity')!
    const target = result.current.nodes.find((n) => n.data.kind === 'decision')!

    act(() => {
      result.current.onConnect(source.id, target.id, 'out', 'in')
    })

    const edge = result.current.edges[0]
    expect(edge).toBeTruthy()

    act(() => {
      result.current.onEdgeClick(edge.id, false)
    })

    expect(result.current.selectedNodeIds.size).toBe(0)
    expect(result.current.selectedEdgeIds.size).toBe(1)
    expect(result.current.selectedEdge?.id).toBe(edge.id)
    expect(result.current.editorEdge).toBeNull()

    act(() => {
      result.current.openEdgeEditor(edge.id)
    })

    expect(result.current.editorEdge?.id).toBe(edge.id)
  })

  it('closes the edge editor when shift-clicking an already-selected edge to deselect', () => {
    const { result } = renderHook(() => useCanvasState())

    act(() => result.current.addActivity({ x: 100, y: 100 }))
    act(() => result.current.addDecision({ x: 420, y: 100 }))

    const source = result.current.nodes.find((n) => n.data.kind === 'activity')!
    const target = result.current.nodes.find((n) => n.data.kind === 'decision')!
    act(() => result.current.onConnect(source.id, target.id, 'out', 'in'))
    const edge = result.current.edges[0]!

    act(() => {
      result.current.onEdgeClick(edge.id, false)
    })
    act(() => {
      result.current.openEdgeEditor(edge.id)
    })
    expect(result.current.editorEdge?.id).toBe(edge.id)

    // Shift-click on the already-selected edge to deselect.
    act(() => {
      result.current.onEdgeClick(edge.id, true)
    })

    expect(result.current.selectedEdgeIds.size).toBe(0)
    expect(result.current.editorEdge).toBeNull()
  })

  it('clears the selected edge and edge editor when selecting a node', () => {
    const { result } = renderHook(() => useCanvasState())

    act(() => result.current.addActivity({ x: 100, y: 100 }))
    act(() => result.current.addDecision({ x: 420, y: 100 }))

    const source = result.current.nodes.find((n) => n.data.kind === 'activity')!
    const target = result.current.nodes.find((n) => n.data.kind === 'decision')!
    act(() => result.current.onConnect(source.id, target.id, 'out', 'in'))
    const edge = result.current.edges[0]!

    act(() => {
      result.current.onEdgeClick(edge.id, false)
    })
    act(() => {
      result.current.openEdgeEditor(edge.id)
    })
    expect(result.current.selectedEdgeIds.has(edge.id)).toBe(true)
    expect(result.current.editorEdge?.id).toBe(edge.id)

    act(() => {
      result.current.onNodeClick(source.id, false)
    })

    expect(result.current.selectedNodeIds.has(source.id)).toBe(true)
    expect(result.current.selectedEdgeIds.size).toBe(0)
    expect(result.current.editorEdge).toBeNull()
  })

  it('closes the editor when the selected edge is deleted', () => {
    const { result } = renderHook(() => useCanvasState())

    act(() => result.current.addActivity({ x: 100, y: 100 }))
    act(() => result.current.addDecision({ x: 420, y: 100 }))

    const source = result.current.nodes.find((n) => n.data.kind === 'activity')!
    const target = result.current.nodes.find((n) => n.data.kind === 'decision')!
    act(() => result.current.onConnect(source.id, target.id, 'out', 'in'))
    const edge = result.current.edges[0]!
    act(() => result.current.onEdgeClick(edge.id, false))
    act(() => result.current.openEdgeEditor(edge.id))
    expect(result.current.editorEdge?.id).toBe(edge.id)

    act(() => {
      result.current.removeSelected()
    })

    expect(result.current.editorEdge).toBeNull()
  })

  it('updates edge label data by id', () => {
    const { result } = renderHook(() => useCanvasState())

    act(() => result.current.addActivity({ x: 100, y: 100 }))
    act(() => result.current.addDecision({ x: 420, y: 100 }))

    const source = result.current.nodes.find((n) => n.data.kind === 'activity')!
    const target = result.current.nodes.find((n) => n.data.kind === 'decision')!

    act(() => {
      result.current.onConnect(source.id, target.id, 'out', 'in')
    })

    const edge = result.current.edges[0]

    act(() => {
      result.current.updateEdgeData(edge.id, { label: 'PM handoff' })
    })

    expect(result.current.edges[0]?.data?.label).toBe('PM handoff')
  })

  it('reroutes a selected edge to a different target node', () => {
    const { result } = renderHook(() => useCanvasState())

    act(() => result.current.addActivity({ x: 100, y: 100 }))
    act(() => result.current.addDecision({ x: 420, y: 100 }))

    const activity = result.current.nodes.find((n) => n.data.kind === 'activity')!
    const decision = result.current.nodes.find((n) => n.data.kind === 'decision')!

    act(() => {
      result.current.onConnect('start', activity.id, 'out', 'in')
    })

    const edge = result.current.edges[0]
    act(() => {
      result.current.onEdgeClick(edge.id, false)
    })
    act(() => {
      result.current.updateEdgeData(edge.id, {
        targetNodeId: decision.id,
        targetPortId: 'in',
      })
    })

    expect(result.current.edges[0]).toMatchObject({
      id: edge.id,
      source: 'start',
      target: decision.id,
      sourceHandle: 'out',
      targetHandle: 'in',
    })
    expect(result.current.selectedEdge?.target).toBe(decision.id)
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

  it('creates a selected node connected from a specific source port at a drop point', () => {
    const { result } = renderHook(() => useCanvasState())
    const dropPoint = { x: 640, y: 260 }

    act(() => {
      result.current.createConnectedNodeFromPort('start', 'out', 'decision', dropPoint)
    })

    const created = Array.from(result.current.document.nodes.values()).find((node) => node.type === 'decision')
    expect(created).toBeTruthy()
    expect(getPortPosition(created!, 'in')).toEqual(dropPoint)
    expect(result.current.edges).toHaveLength(1)
    expect(result.current.edges[0]).toMatchObject({
      source: 'start',
      sourceHandle: 'out',
      target: created!.id,
      targetHandle: 'in',
    })
    expect(result.current.selectedNodeIds.has(created!.id)).toBe(true)
  })

  it('adds stage and bottleneck nodes from typed canvas actions', () => {
    const { result } = renderHook(() => useCanvasState())

    act(() => result.current.addStage({ x: 100, y: 120 }))
    act(() => result.current.addBottleneck({ x: 400, y: 120 }))

    expect(result.current.nodes.some((node) => node.data.kind === 'stage')).toBe(true)
    expect(result.current.nodes.some((node) => node.data.kind === 'bottleneck')).toBe(true)
  })

  it('selects and updates a handoff edge by id', () => {
    const { result } = renderHook(() => useCanvasState())

    act(() => result.current.addActivity({ x: 120, y: 160 }))
    act(() => result.current.onConnect('start', result.current.nodes.find((node) => node.data.kind === 'activity')!.id, 'out', 'in'))

    const edge = result.current.edges[0]
    act(() => result.current.onEdgeClick(edge.id, false))
    act(() => result.current.updateEdgeData(edge.id, { expectation: 'Context moves with the work.' }))

    expect(result.current.selectedEdgeIds.has(edge.id)).toBe(true)
    expect(result.current.selectedEdge?.data?.expectation).toBe('Context moves with the work.')
  })
})
