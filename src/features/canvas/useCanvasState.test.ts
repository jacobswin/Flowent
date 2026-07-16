import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useCanvasState, migrateDecisionPorts } from './useCanvasState'
import { createEmptyDocument } from './engine/graphDocument'
import type { GraphDocument, GraphNode } from './canvasTypes'
import { getPortPosition } from './render/drawEdges'
import { createGraphNode, createHandoffEdge } from './processElements'

function makeCollapsedLayoutDocument(): GraphDocument {
  const doc = createEmptyDocument('collapsed-ai-map')
  const ids = ['start', 'stage-1', 'act-2', 'act-3', 'act-4', 'act-5', 'dec-6', 'act-7', 'act-8', 'end']
  doc.nodes = new Map(ids.map((id, index) => [
    id,
    {
      id,
      type: id === 'start' ? 'start' : id === 'end' ? 'end' : id.startsWith('dec') ? 'decision' : id.startsWith('stage') ? 'stage' : 'activity',
      x: id === 'start' ? 220 : 940,
      y: id === 'start' ? 445 : -320 + index * 170,
      width: id === 'start' || id === 'end' ? 120 : id.startsWith('stage') ? 280 : 220,
      height: id === 'start' || id === 'end' ? 56 : id.startsWith('stage') ? 132 : 112,
      title: id,
      roleTags: [],
      ports: id === 'start'
        ? [{ id: 'out', side: 'right' }]
        : id === 'end'
          ? [{ id: 'in', side: 'left' }]
          : [{ id: 'in', side: 'left' }, { id: 'out', side: 'right' }],
    } satisfies GraphNode,
  ]))
  const edgePairs = [
    ['start', 'stage-1'],
    ['stage-1', 'act-2'],
    ['act-2', 'act-3'],
    ['act-3', 'act-4'],
    ['act-4', 'act-5'],
    ['act-5', 'dec-6'],
    ['dec-6', 'act-7'],
    ['act-7', 'act-8'],
    ['act-8', 'end'],
    ['dec-6', 'act-4'],
  ]
  doc.edges = new Map(edgePairs.map(([source, target], index) => [
    `edge-${index}`,
    {
      id: `edge-${index}`,
      sourceNodeId: source,
      sourcePortId: 'out',
      targetNodeId: target,
      targetPortId: 'in',
      label: '',
    },
  ]))
  doc.viewport = { x: 180, y: 360, zoom: 0.3 }
  doc.meta = { dirty: false, version: 1 }
  return doc
}

function makeGeneratedFlowDocument(): GraphDocument {
  const nodes = [
    createGraphNode('start', 'start', { x: 0, y: 120 }),
    { ...createGraphNode('activity', 'trigger', { x: 220, y: 120 }), title: 'DVP试验偏差产生' },
    { ...createGraphNode('decision', 'risk', { x: 500, y: 120 }), title: '步骤0：风险评估' },
    { ...createGraphNode('activity', 'blocked', { x: 780, y: 120 }), title: '禁止偏差，必须整改' },
    { ...createGraphNode('activity', 'formal-report', { x: 1060, y: 120 }), title: '步骤1：DRE编制评审报告' },
    createGraphNode('end', 'end', { x: 1340, y: 120 }),
  ]
  const edges = [
    createHandoffEdge('start-trigger', 'start', 'out', 'trigger', 'in'),
    createHandoffEdge('trigger-risk', 'trigger', 'out', 'risk', 'in'),
    { ...createHandoffEdge('risk-blocked', 'risk', 'out', 'blocked', 'in'), label: '高风险/法规类/中风险' },
    { ...createHandoffEdge('risk-formal', 'risk', 'out', 'formal-report', 'in'), label: '低风险' },
    createHandoffEdge('formal-end', 'formal-report', 'out', 'end', 'in'),
  ]

  return {
    ...createEmptyDocument('generated-flow-map'),
    nodes: new Map(nodes.map((node) => [node.id, node])),
    edges: new Map(edges.map((edge) => [edge.id, edge])),
    meta: {
      dirty: false,
      version: 1,
      layoutProfile: 'generated-flow',
      layoutNodeOrder: ['trigger', 'risk', 'formal-report', 'blocked'],
    },
  }
}

function makeSwimlaneDocument(): GraphDocument {
  const a1 = {
    ...createGraphNode('activity', 'a1', { x: 0, y: 0 }),
    title: 'Prepare deviation report',
    responsibilities: [{ id: 'r1', roleName: 'DRE', kind: 'responsible' as const }],
    roleTags: ['DRE'],
  }
  const a2 = {
    ...createGraphNode('activity', 'a2', { x: 0, y: 0 }),
    title: 'Review and archive',
    responsibilities: [{ id: 'r2', roleName: 'SVE', kind: 'responsible' as const }],
    roleTags: ['SVE'],
  }

  return {
    ...createEmptyDocument('swimlane-state-map'),
    nodes: new Map([
      ['start', createGraphNode('start', 'start', { x: 0, y: 0 })],
      ['a1', a1],
      ['a2', a2],
      ['end', createGraphNode('end', 'end', { x: 0, y: 0 })],
    ]),
    edges: new Map([
      ['start-a1', createHandoffEdge('start-a1', 'start', 'out', 'a1', 'in')],
      ['a1-a2', createHandoffEdge('a1-a2', 'a1', 'out', 'a2', 'in')],
      ['a2-end', createHandoffEdge('a2-end', 'a2', 'out', 'end', 'in')],
    ]),
    processAssets: {
      guidanceItems: {},
      milestones: {},
      workProducts: {
        'wp-input': {
          id: 'wp-input',
          title: 'Deviation record',
          state: 'Draft',
          description: '',
          producerNodeIds: [],
          consumerNodeIds: ['a1'],
          handoffEdgeIds: [],
          guidanceIds: [],
          activityLinks: [{ id: 'link-input', nodeId: 'a1', relation: 'input', maturity: 'Draft' }],
        },
        'wp-output': {
          id: 'wp-output',
          title: 'Reviewed report',
          state: 'Approved',
          description: '',
          producerNodeIds: ['a2'],
          consumerNodeIds: [],
          handoffEdgeIds: [],
          guidanceIds: [],
          activityLinks: [{ id: 'link-output', nodeId: 'a2', relation: 'output', maturity: 'Approved' }],
        },
      },
    },
    meta: { dirty: false, version: 1, layoutNodeOrder: ['a1', 'a2'] },
  }
}

function graphNode(doc: GraphDocument, id: string): GraphNode {
  return doc.nodes.get(id)!
}

function graphCenterX(node: GraphNode): number {
  return node.x + node.width / 2
}

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

  it('clamps zoom controls to the [0.05, 5] range', () => {
    const { result } = renderHook(() => useCanvasState())

    act(() => {
      result.current.zoomAt(10, 0, 0)
    })
    expect(result.current.viewport.zoom).toBeLessThanOrEqual(5)

    act(() => {
      result.current.zoomAt(0.01, 0, 0)
    })
    expect(result.current.viewport.zoom).toBeGreaterThanOrEqual(0.05)

    act(() => {
      result.current.zoomToPercent(777)
    })
    expect(result.current.viewport.zoom).toBe(5)

    act(() => {
      result.current.zoomToPercent(2)
    })
    expect(result.current.viewport.zoom).toBe(0.05)
  })

  it('repairs a saved AI layout that collapsed into a vertical column', async () => {
    const initialDocument = makeCollapsedLayoutDocument()
    const { result } = renderHook(() => useCanvasState({ initialDocument }))

    await waitFor(() => {
      const xBuckets = new Set(result.current.nodes.map((node) => Math.round(node.position.x / 50) * 50))
      const yBuckets = new Set(result.current.nodes.map((node) => Math.round(node.position.y / 50) * 50))
      expect(xBuckets.size).toBeGreaterThanOrEqual(6)
      expect(yBuckets.size).toBeGreaterThanOrEqual(2)
      expect(result.current.viewport.zoom).toBe(1)
    })
  })

  it('applies Flow layout as an explicit left-to-right action', async () => {
    const { result } = renderHook(() => useCanvasState({ initialDocument: makeGeneratedFlowDocument() }))

    await act(async () => {
      await result.current.applyFlowLayout()
    })

    const doc = result.current.document
    expect(doc.meta.layoutProfile).toBe('left-to-right')
    expect(graphCenterX(graphNode(doc, 'trigger'))).toBeLessThan(graphCenterX(graphNode(doc, 'risk')))
    expect(graphCenterX(graphNode(doc, 'risk'))).toBeLessThan(graphCenterX(graphNode(doc, 'formal-report')))
    expect(doc.edges.get('trigger-risk')).toMatchObject({
      sourceAnchor: { side: 'right', offset: 0.5 },
      targetAnchor: { side: 'left', offset: 0.5 },
    })
    expect(graphNode(doc, 'start').x * doc.viewport.zoom + doc.viewport.x).toBeGreaterThanOrEqual(72)
  })

  it('applies Swimlane layout as an explicit top-to-bottom action', async () => {
    const { result } = renderHook(() => useCanvasState({ initialDocument: makeSwimlaneDocument() }))

    await act(async () => {
      result.current.applySwimlaneLayout()
    })

    const doc = result.current.document
    expect(doc.meta.layoutProfile).toBe('swimlane')
    expect(graphNode(doc, 'a2').y).toBeGreaterThan(graphNode(doc, 'a1').y)
    expect(graphCenterX(graphNode(doc, 'a2'))).toBeCloseTo(graphCenterX(graphNode(doc, 'a1')), 0)
    expect(doc.edges.get('a1-a2')).toMatchObject({
      sourceAnchor: { side: 'bottom', offset: 0.5 },
      targetAnchor: { side: 'top', offset: 0.5 },
    })
    expect(120 * doc.viewport.zoom + doc.viewport.x).toBeGreaterThanOrEqual(36)
    expect(100 * doc.viewport.zoom + doc.viewport.y).toBeGreaterThanOrEqual(56)
  })

  it('migrateDecisionPorts: legacy decision gets four edge ports', () => {
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
    expect(d1.ports.map((p) => p.side)).toEqual(['top', 'left', 'right', 'bottom'])
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
    expect(getPortPosition(created!, 'in')).toEqual({ ...dropPoint, side: 'left' })
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

  it('updates, links, unlinks, and deletes process assets through asset actions', () => {
    const { result } = renderHook(() => useCanvasState())

    act(() => result.current.addActivity({ x: 120, y: 160 }))
    const activity = result.current.nodes.find((node) => node.data.kind === 'activity')!
    act(() => result.current.addDecision({ x: 420, y: 160 }))
    const decision = result.current.nodes.find((node) => node.data.kind === 'decision')!
    act(() => result.current.onConnect(activity.id, decision.id, 'out', 'in'))
    const edge = result.current.edges[0]

    act(() => result.current.assetActions.createWorkProductForActivity(activity.id, 'output', 'Research brief'))
    const workProductId = Object.keys(result.current.processAssets.workProducts)[0]
    act(() => result.current.assetActions.createGuidanceForActivity(activity.id, { title: 'Interview checklist', kind: 'checklist' }))
    const guidanceId = Object.keys(result.current.processAssets.guidanceItems)[0]

    act(() => result.current.assetActions.updateAsset('workProduct', workProductId, {
      state: 'Approved',
      description: 'Ready for delivery',
    }))
    act(() => result.current.assetActions.linkAsset('workProduct', workProductId, 'handoff', edge.id))
    act(() => result.current.assetActions.linkAsset('guidance', guidanceId, 'workProduct', workProductId))

    expect(result.current.processAssets.workProducts[workProductId]).toMatchObject({
      state: 'Approved',
      description: 'Ready for delivery',
      handoffEdgeIds: [edge.id],
      guidanceIds: [guidanceId],
    })
    expect(result.current.processAssets.guidanceItems[guidanceId]?.workProductIds).toEqual([workProductId])

    act(() => result.current.assetActions.unlinkAsset('guidance', guidanceId, 'workProduct', workProductId))
    expect(result.current.processAssets.workProducts[workProductId]?.guidanceIds).toEqual([])

    act(() => result.current.assetActions.selectAsset('workProduct', workProductId))
    expect(result.current.selectedAsset).toEqual({ kind: 'workProduct', id: workProductId })
    expect(result.current.selectedNodeIds.has(activity.id)).toBe(true)

    act(() => result.current.assetActions.deleteAsset('workProduct', workProductId))
    expect(result.current.processAssets.workProducts[workProductId]).toBeUndefined()
    expect(result.current.edges[0]?.data?.workProductIds ?? []).toEqual([])
  })

  it('creates standalone process assets and selects the created asset', () => {
    const { result } = renderHook(() => useCanvasState())

    act(() => result.current.assetActions.createAsset('workProduct', { title: ' Opportunity brief ' }))
    const workProduct = Object.values(result.current.processAssets.workProducts)[0]
    expect(workProduct).toMatchObject({
      title: 'Opportunity brief',
      state: 'Draft',
      description: '',
      producerNodeIds: [],
      consumerNodeIds: [],
      handoffEdgeIds: [],
      guidanceIds: [],
    })
    expect(result.current.selectedAsset).toEqual({ kind: 'workProduct', id: workProduct.id })

    act(() => result.current.assetActions.createAsset('guidance', { title: 'Delivery template', kind: 'template' }))
    const guidance = Object.values(result.current.processAssets.guidanceItems)[0]
    expect(guidance).toMatchObject({
      title: 'Delivery template',
      kind: 'template',
      description: '',
      url: '',
      appliesToNodeIds: [],
      appliesToEdgeIds: [],
      workProductIds: [],
    })
    expect(result.current.selectedAsset).toEqual({ kind: 'guidance', id: guidance.id })

    act(() => result.current.assetActions.createAsset('milestone', { title: 'Release readiness' }))
    const milestone = Object.values(result.current.processAssets.milestones)[0]
    expect(milestone).toMatchObject({
      title: 'Release readiness',
      description: '',
      stageNodeId: null,
      workProductStates: [],
    })
    expect(result.current.selectedAsset).toEqual({ kind: 'milestone', id: milestone.id })

    act(() => result.current.assetActions.createAsset('workProduct', { title: '   ' }))
    expect(Object.keys(result.current.processAssets.workProducts)).toHaveLength(1)
  })
})
