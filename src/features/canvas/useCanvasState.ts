import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  GraphCommand,
  GraphDocument,
  GraphEdge,
  GraphNode,
  ProcessEdge,
  ProcessNode,
  ReviewStatus,
} from './canvasTypes'
import { runCommand } from './engine/commands'
import { createEmptyDocument } from './engine/graphDocument'
import { planQuickCreate } from './engine/quickCreate'
import { createHistoryState, pushHistory, redo, type HistoryState, setPresent, undo } from './engine/history'
import { layoutGraph } from './layout/autoLayout'
import { createGraphNode, createHandoffEdge, type ProcessElementType } from './processElements'

function toProcessNode(node: GraphNode): ProcessNode {
  if (node.type === 'activity') {
    return {
      id: node.id,
      type: 'activity',
      position: { x: node.x, y: node.y },
      data: {
        title: node.title,
        summary: node.summary ?? '',
        roleIds: node.roleTags,
        expectations: node.expectations ?? '',
        kind: 'activity',
      },
    }
  }

  if (node.type === 'decision') {
    return {
      id: node.id,
      type: 'decision',
      position: { x: node.x, y: node.y },
      data: {
        title: node.title,
        criteria: node.criteria ?? '',
        decisionOutcomes: node.decisionOutcomes ?? [],
        owner: node.owner ?? '',
        kind: 'decision',
      },
    }
  }

  if (node.type === 'stage') {
    return {
      id: node.id,
      type: 'stage',
      position: { x: node.x, y: node.y },
      data: {
        title: node.title,
        goal: node.goal ?? '',
        entryCondition: node.entryCondition ?? '',
        exitCondition: node.exitCondition ?? '',
        owner: node.owner ?? '',
        kind: 'stage',
      },
    }
  }

  if (node.type === 'bottleneck') {
    return {
      id: node.id,
      type: 'bottleneck',
      position: { x: node.x, y: node.y },
      data: {
        title: node.title,
        symptom: node.symptom ?? '',
        impact: node.impact ?? '',
        suspectedCause: node.suspectedCause ?? '',
        reviewStatus: node.reviewStatus ?? 'unclear',
        kind: 'bottleneck',
      },
    }
  }

  return {
    id: node.id,
    type: 'startEnd',
    position: { x: node.x, y: node.y },
    data: {
      label: node.title,
      kind: node.type === 'start' ? 'start' : 'end',
    },
  }
}

function toProcessEdge(edge: GraphEdge): ProcessEdge {
  return {
    id: edge.id,
    type: 'handoff',
    source: edge.sourceNodeId,
    target: edge.targetNodeId,
    sourceHandle: edge.sourcePortId,
    targetHandle: edge.targetPortId,
    data: {
      label: edge.label,
      fromRole: edge.fromRole ?? '',
      toRole: edge.toRole ?? '',
      artifact: edge.artifact ?? '',
      expectation: edge.expectation ?? '',
      readinessSignal: edge.readinessSignal ?? '',
      reviewStatus: edge.reviewStatus ?? 'unclear',
    },
  }
}

function isReviewStatus(value: unknown): value is ReviewStatus {
  return value === 'unclear' ||
    value === 'disputed' ||
    value === 'needs-owner' ||
    value === 'approved' ||
    value === 'changed-since-approval'
}

/**
 * Migrate older decision nodes (which had a 3-port schema with `yes`/
 * `no` outputs on top/bottom) to the new 2-port schema with only
 * `in` (left) and `out` (right). Without this, decision nodes saved by
 * an earlier version of Flowent keep showing three ports on the canvas
 * even after the port schema is updated. Exported for unit tests.
 */
export function migrateDecisionPorts(doc: GraphDocument): GraphDocument {
  let needsMigration = false
  for (const node of doc.nodes.values()) {
    if (node.type === 'decision' && node.ports.length !== 2) {
      needsMigration = true
      break
    }
  }
  if (!needsMigration) return doc

  const nodes = new Map(doc.nodes)
  for (const [id, node] of nodes) {
    if (node.type === 'decision') {
      nodes.set(id, {
        ...node,
        ports: [
          { id: 'in', side: 'left' },
          { id: 'out', side: 'right' },
        ],
      })
    }
  }
  // Mark the doc dirty so the autosave loop persists the migrated shape
  // back to the server. Without this, the in-memory doc is migrated but
  // the disk file keeps the legacy 3-port schema, so the next reload
  // re-runs the migration (still works, but a wasted PATCH round-trip).
  return {
    ...doc,
    nodes,
    meta: { dirty: true, version: doc.meta.version + 1 },
  }
}

function createInitialDocument(): GraphDocument {
  const empty = createEmptyDocument('flowent-canvas')
  return runCommand(empty, {
    type: 'AddNode',
    payload: {
      id: 'start',
      type: 'start',
      // Place the start node in the upper-left of the visible canvas,
      // away from the floating toolbar at top: 16px. The header (title
      // and subtitle) takes up the left side, so a horizontal offset
      // keeps the node clear of both.
      x: 360,
      y: 200,
      width: 120,
      height: 56,
      title: 'Start',
      roleTags: [],
      ports: [{ id: 'out', side: 'right' }],
    },
  })
}

type NodeDataPatch = {
  title?: string
  summary?: string
  criteria?: string
  decisionOutcomes?: string[]
  roleIds?: string[]
  expectations?: string
  owner?: string
  goal?: string
  entryCondition?: string
  exitCondition?: string
  symptom?: string
  impact?: string
  suspectedCause?: string
  reviewStatus?: ReviewStatus
}

interface UseCanvasStateOptions {
  /** Document to start from. If omitted, uses the canonical Start-node doc. */
  initialDocument?: GraphDocument
  /** Called with the latest document 500ms after the last edit. */
  onAutosave?: (doc: GraphDocument) => void
}

export function useCanvasState(options: UseCanvasStateOptions = {}) {
  const { initialDocument, onAutosave } = options
  const [history, setHistory] = useState<HistoryState<GraphDocument>>(() => {
    const base = initialDocument ?? createInitialDocument()
    return createHistoryState(migrateDecisionPorts(base))
  })
  // Synchronous shadow of the current selection, updated by applyCommand
  // outside of React's batching. Native pointermove listeners that fire
  // in the same tick as a pointerdown-driven SelectNode can read this
  // without waiting for React to commit.
  const liveSelectedNodeIds = useRef<Set<string>>(new Set())
  const [editorNodeId, setEditorNodeId] = useState<string | null>(null)
  const [marquee, setMarquee] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null)
  const [connectorMode, setConnectorMode] = useState(false)
  const [connectionStart, setConnectionStart] = useState<{ nodeId: string; portId: string } | null>(null)

  const document = history.present

  const nodes = useMemo(() => Array.from(document.nodes.values()).map(toProcessNode), [document])
  const edges = useMemo(() => Array.from(document.edges.values()).map(toProcessEdge), [document])
  const selectedNodeIds = useMemo(() => document.selectedNodeIds, [document])
  const selectedNode = useMemo(() => {
    const ids = Array.from(selectedNodeIds)
    if (ids.length === 1) return nodes.find((n) => n.id === ids[0]) ?? null
    return null
  }, [nodes, selectedNodeIds])
  const selectedEdgeIds = useMemo(() => document.selectedEdgeIds, [document])
  const selectedEdge = useMemo(() => {
    const ids = Array.from(selectedEdgeIds)
    if (ids.length !== 1) return null
    const edge = document.edges.get(ids[0])
    return edge ? toProcessEdge(edge) : null
  }, [document.edges, selectedEdgeIds])
  const [editorEdgeId, setEditorEdgeId] = useState<string | null>(null)
  const editorEdge = useMemo(() => {
    if (!editorEdgeId) return null
    const edge = document.edges.get(editorEdgeId)
    return edge ? toProcessEdge(edge) : null
  }, [document.edges, editorEdgeId])

  const applyCommand = useCallback((command: GraphCommand) => {
    let nextSelected: Set<string> | null = null

    setHistory((current) => {
      const nextDoc = runCommand(current.present, command)
      nextSelected = nextDoc.selectedNodeIds
      return pushHistory(current, nextDoc)
    })
    // Keep the synchronous selection shadow in step with React state so
    // that native event listeners firing on the same tick as a pointerdown
    // can observe the selection that pointerdown just established.
    if (command.type === 'SelectNode') {
      const next = command.payload.additive ? new Set(liveSelectedNodeIds.current) : new Set<string>()
      if (command.payload.additive) {
        if (next.has(command.payload.id)) {
          next.delete(command.payload.id)
        } else {
          next.add(command.payload.id)
        }
      } else {
        next.add(command.payload.id)
      }
      liveSelectedNodeIds.current = next
    } else if (command.type === 'MoveNodes') {
      // No-op for selection; MoveNodes mutates nodes only.
    } else if (nextSelected) {
      // Capture the post-command selection synchronously from the same
      // setHistory pass that produced the new doc. This avoids reading
      // a stale history.present while React state is still batching.
      liveSelectedNodeIds.current = new Set(nextSelected)
    }
  }, [])

  const onNodesChange = useCallback(
    () => {
      // No-op for now - we handle node movement via Pixi events
    },
    [],
  )

  const onEdgesChange = useCallback(
    () => {
      // No-op for now
    },
    [],
  )

  const onConnect = useCallback(
    (sourceNodeId: string, targetNodeId: string, sourcePortId = 'out', targetPortId = 'in') => {
      const edgeId = `edge-${Date.now()}`
      applyCommand({
        type: 'AddEdge',
        payload: createHandoffEdge(edgeId, sourceNodeId, sourcePortId, targetNodeId, targetPortId),
      })
    },
    [applyCommand],
  )

  const onNodeClick = useCallback(
    (nodeId: string, additive: boolean) => {
      applyCommand({
        type: 'SelectNode',
        payload: { id: nodeId, additive },
      })
    },
    [applyCommand],
  )

  const onEdgeClick = useCallback(
    (edgeId: string, additive: boolean) => {
      applyCommand({ type: 'SelectEdge', payload: { id: edgeId, additive } })
      setEditorEdgeId(edgeId)
      setEditorNodeId(null)
    },
    [applyCommand],
  )

  const toggleConnectorMode = useCallback(() => {
    setConnectorMode((prev) => !prev)
    setConnectionStart(null)
  }, [])

  const startConnection = useCallback((nodeId: string, portId: string) => {
    setConnectionStart({ nodeId, portId })
  }, [])

  const endConnection = useCallback((targetNodeId: string, targetPortId = 'in') => {
    if (connectionStart && connectionStart.nodeId !== targetNodeId) {
      onConnect(connectionStart.nodeId, targetNodeId, connectionStart.portId, targetPortId)
    }
    setConnectionStart(null)
  }, [connectionStart, onConnect])

  const onPaneClick = useCallback(() => {
    setHistory((current) => setPresent(current, {
      ...current.present,
      selectedNodeIds: new Set(),
      selectedEdgeIds: new Set(),
      meta: { dirty: true, version: current.present.meta.version + 1 },
    }))
    setEditorNodeId(null)
    setEditorEdgeId(null)
    setConnectionStart(null)
  }, [])

  const openEditor = useCallback((nodeId: string) => {
    setEditorNodeId(nodeId)
    setEditorEdgeId(null)
  }, [])

  const closeEditor = useCallback(() => {
    setEditorNodeId(null)
    setEditorEdgeId(null)
  }, [])

  const addNodeByType = useCallback((type: ProcessElementType, position?: { x: number; y: number }) => {
    const id = `${type}-${Date.now()}`
    setHistory((current) => {
      let next = runCommand(current.present, {
        type: 'AddNode',
        payload: createGraphNode(type, id, position ?? { x: 320, y: 240 }),
      })
      next = runCommand(next, {
        type: 'SelectNode',
        payload: { id, additive: false },
      })
      return pushHistory(current, next)
    })
  }, [])

  const addActivity = useCallback((position?: { x: number; y: number }) => {
    addNodeByType('activity', position)
  }, [addNodeByType])

  const addDecision = useCallback((position?: { x: number; y: number }) => {
    addNodeByType('decision', position)
  }, [addNodeByType])

  const addEnd = useCallback((position?: { x: number; y: number }) => {
    addNodeByType('end', position)
  }, [addNodeByType])

  const addStage = useCallback((position?: { x: number; y: number }) => {
    addNodeByType('stage', position)
  }, [addNodeByType])

  const addBottleneck = useCallback((position?: { x: number; y: number }) => {
    addNodeByType('bottleneck', position)
  }, [addNodeByType])

  const quickCreate = useCallback((targetType: ProcessElementType) => {
    setHistory((current) => {
      const sourceNodeId = Array.from(current.present.selectedNodeIds)[0] ?? null
      const newNodeId = `${targetType}-${Date.now()}`
      const newEdgeId = `edge-${Date.now()}`
      const plan = planQuickCreate(current.present, {
        sourceNodeId,
        targetType,
        newNodeId,
        newEdgeId,
        fallbackPosition: { x: 320, y: 240 },
      })

      let next = runCommand(current.present, { type: 'AddNode', payload: plan.node })
      if (plan.edge) {
        next = runCommand(next, { type: 'AddEdge', payload: plan.edge })
      }
      next = runCommand(next, { type: 'SelectNode', payload: { id: plan.node.id, additive: false } })
      return pushHistory(current, next)
    })
  }, [])

  const removeSelected = useCallback(() => {
    setHistory((current) => {
      let next = current.present

      for (const nodeId of next.selectedNodeIds) {
        if (nodeId === 'start') continue
        const nodes = new Map(next.nodes)
        nodes.delete(nodeId)

        const edges = new Map(next.edges)
        for (const [id, edge] of edges.entries()) {
          if (edge.sourceNodeId === nodeId || edge.targetNodeId === nodeId) {
            edges.delete(id)
          }
        }

        next = {
          ...next,
          nodes,
          edges,
          meta: { dirty: true, version: next.meta.version + 1 },
        }
      }

      for (const edgeId of next.selectedEdgeIds) {
        const edges = new Map(next.edges)
        edges.delete(edgeId)
        next = {
          ...next,
          edges,
          meta: { dirty: true, version: next.meta.version + 1 },
        }
      }

      if (next === current.present) return current
      return pushHistory(current, {
        ...next,
        selectedNodeIds: new Set(),
        selectedEdgeIds: new Set(),
      })
    })
  }, [])

  const updateNodeData = useCallback(
    (nodeId: string, data: NodeDataPatch) => {
      applyCommand({
        type: 'UpdateNode',
        payload: {
          id: nodeId,
          patch: {
            ...(typeof data.title === 'string' ? { title: data.title } : {}),
            ...(typeof data.summary === 'string' ? { summary: data.summary } : {}),
            ...(typeof data.criteria === 'string' ? { criteria: data.criteria } : {}),
            ...(Array.isArray(data.decisionOutcomes) ? { decisionOutcomes: data.decisionOutcomes } : {}),
            ...(Array.isArray(data.roleIds) ? { roleTags: data.roleIds } : {}),
            ...(typeof data.expectations === 'string' ? { expectations: data.expectations } : {}),
            ...(typeof data.owner === 'string' ? { owner: data.owner } : {}),
            ...(typeof data.goal === 'string' ? { goal: data.goal } : {}),
            ...(typeof data.entryCondition === 'string' ? { entryCondition: data.entryCondition } : {}),
            ...(typeof data.exitCondition === 'string' ? { exitCondition: data.exitCondition } : {}),
            ...(typeof data.symptom === 'string' ? { symptom: data.symptom } : {}),
            ...(typeof data.impact === 'string' ? { impact: data.impact } : {}),
            ...(typeof data.suspectedCause === 'string' ? { suspectedCause: data.suspectedCause } : {}),
            ...(isReviewStatus(data.reviewStatus) ? { reviewStatus: data.reviewStatus } : {}),
          },
        },
      })
    },
    [applyCommand],
  )

  type EdgeDataPatch = {
    label?: string
    fromRole?: string
    toRole?: string
    artifact?: string
    expectation?: string
    readinessSignal?: string
    reviewStatus?: ReviewStatus
  }

  const updateEdgeData = useCallback(
    (edgeId: string, data: EdgeDataPatch) => {
      applyCommand({
        type: 'UpdateEdge',
        payload: {
          id: edgeId,
          patch: {
            ...(typeof data.label === 'string' ? { label: data.label } : {}),
            ...(typeof data.fromRole === 'string' ? { fromRole: data.fromRole } : {}),
            ...(typeof data.toRole === 'string' ? { toRole: data.toRole } : {}),
            ...(typeof data.artifact === 'string' ? { artifact: data.artifact } : {}),
            ...(typeof data.expectation === 'string' ? { expectation: data.expectation } : {}),
            ...(typeof data.readinessSignal === 'string' ? { readinessSignal: data.readinessSignal } : {}),
            ...(isReviewStatus(data.reviewStatus) ? { reviewStatus: data.reviewStatus } : {}),
          },
        },
      })
    },
    [applyCommand],
  )

  const moveSelectedNodes = useCallback(
    (dx: number, dy: number) => {
      // Read from the synchronous shadow ref so that moves triggered by
      // a native pointermove in the same tick as a pointerdown see the
      // selection that the pointerdown just established.
      const ids = Array.from(liveSelectedNodeIds.current)
      if (ids.length === 0) return

      applyCommand({
        type: 'MoveNodes',
        payload: { ids, dx, dy },
      })
    },
    [applyCommand],
  )

  const undoAction = useCallback(() => {
    setHistory((current) => undo(current))
    setEditorNodeId(null)
    setEditorEdgeId(null)
  }, [])

  const redoAction = useCallback(() => {
    setHistory((current) => redo(current))
    setEditorNodeId(null)
    setEditorEdgeId(null)
  }, [])

  const autoLayout = useCallback(async () => {
    const graphNodes = Array.from(document.nodes.values())
    const graphEdges = Array.from(document.edges.values())

    if (graphNodes.length === 0) return

    const result = await layoutGraph({ nodes: graphNodes, edges: graphEdges })

    setHistory((current) => {
      let next = current.present
      for (const pos of result.nodes) {
        const node = next.nodes.get(pos.id)
        if (node) {
          next = runCommand(next, {
            type: 'UpdateNode',
            payload: { id: pos.id, patch: { x: pos.x, y: pos.y } },
          })
        }
      }

      if (next === current.present) return current
      return pushHistory(current, next)
    })
  }, [document])

  const zoomIn = useCallback(() => {
    setHistory((current) => {
      const newZoom = Math.min(current.present.viewport.zoom * 1.2, 3)
      return setPresent(current, {
        ...current.present,
        meta: { dirty: true, version: current.present.meta.version + 1 },
        viewport: { ...current.present.viewport, zoom: newZoom },
      })
    })
  }, [])

  const zoomOut = useCallback(() => {
    setHistory((current) => {
      const newZoom = Math.max(current.present.viewport.zoom / 1.2, 0.2)
      return setPresent(current, {
        ...current.present,
        meta: { dirty: true, version: current.present.meta.version + 1 },
        viewport: { ...current.present.viewport, zoom: newZoom },
      })
    })
  }, [])

  const zoomReset = useCallback(() => {
    setHistory((current) =>
      setPresent(current, {
        ...current.present,
        meta: { dirty: true, version: current.present.meta.version + 1 },
        viewport: { x: 0, y: 0, zoom: 1 },
      }),
    )
  }, [])

  /**
   * Zoom by a multiplicative factor while keeping the screen point under the
   * cursor anchored. Used by mouse wheel and trackpad pinch.
   */
  const zoomAt = useCallback((factor: number, screenX: number, screenY: number) => {
    setHistory((current) => {
      const viewport = current.present.viewport
      const newZoom = Math.max(0.2, Math.min(3, viewport.zoom * factor))
      if (newZoom === viewport.zoom) return current

      // World point under cursor before zoom stays under cursor after zoom.
      const worldX = (screenX - viewport.x) / viewport.zoom
      const worldY = (screenY - viewport.y) / viewport.zoom
      const nextX = screenX - worldX * newZoom
      const nextY = screenY - worldY * newZoom

      return setPresent(current, {
        ...current.present,
        meta: { dirty: true, version: current.present.meta.version + 1 },
        viewport: { x: nextX, y: nextY, zoom: newZoom },
      })
    })
  }, [])

  const panBy = useCallback((dx: number, dy: number) => {
    setHistory((current) =>
      setPresent(current, {
        ...current.present,
        meta: { dirty: true, version: current.present.meta.version + 1 },
        viewport: {
          x: current.present.viewport.x + dx,
          y: current.present.viewport.y + dy,
          zoom: current.present.viewport.zoom,
        },
      }),
    )
  }, [])

  const selectNodesInRect = useCallback(
    (x1: number, y1: number, x2: number, y2: number) => {
      setHistory((current) => {
        const selectedNodeIds = new Set<string>()
        for (const node of current.present.nodes.values()) {
          if (
            node.x + node.width >= x1 &&
            node.x <= x2 &&
            node.y + node.height >= y1 &&
            node.y <= y2
          ) {
            selectedNodeIds.add(node.id)
          }
        }

        if (selectedNodeIds.size === 0) return current

        return pushHistory(current, {
          ...current.present,
          selectedNodeIds,
          meta: { dirty: true, version: current.present.meta.version + 1 },
        })
      })
    },
    [],
  )

  const editorNode = nodes.find((n) => n.id === editorNodeId) ?? null

  // Debounced autosave: 500ms after the last history change, fire the
  // callback with the latest present. The `onAutosave` prop is held in a
  // ref so that the timer only restarts when the document changes — not
  // when the parent re-renders with a new closure (which is every render
  // unless the parent memos it; listing it as a dep here would create a
  // livelock where the timer keeps getting reset and never fires).
  const onAutosaveRef = useRef(onAutosave)
  useEffect(() => {
    onAutosaveRef.current = onAutosave
  }, [onAutosave])

  useEffect(() => {
    if (!onAutosaveRef.current) return
    if (!document.meta.dirty) return
    const timer = setTimeout(() => {
      onAutosaveRef.current?.(document)
    }, 500)
    return () => clearTimeout(timer)
  }, [document])

  return {
    nodes,
    edges,
    selectedNode,
    selectedNodeIds,
    selectedEdgeIds,
    selectedEdge,
    editorNode,
    editorEdge,
    marquee,
    connectorMode,
    connectionStart,
    startMarquee: useCallback((x: number, y: number) => setMarquee({ x1: x, y1: y, x2: x, y2: y }), []),
    updateMarquee: useCallback((x: number, y: number) => setMarquee((c) => c ? { ...c, x2: x, y2: y } : null), []),
    endMarquee: useCallback(() => setMarquee(null), []),
    selectNodesInRect,
    toggleConnectorMode,
    startConnection,
    endConnection,
    onNodesChange,
    onEdgesChange,
    onConnect,
    onNodeClick,
    onEdgeClick,
    onPaneClick,
    openEditor,
    closeEditor,
    addActivity,
    addDecision,
    addEnd,
    addNodeByType,
    addStage,
    addBottleneck,
    quickCreate,
    removeSelected,
    updateNodeData,
    updateEdgeData,
    moveSelectedNodes,
    undo: undoAction,
    redo: redoAction,
    autoLayout,
    zoomIn,
    zoomOut,
    zoomReset,
    zoomAt,
    panBy,
    viewport: document.viewport,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
  }
}
