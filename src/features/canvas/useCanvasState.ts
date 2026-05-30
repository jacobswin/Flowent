import { useCallback, useMemo, useState } from 'react'
import type {
  GraphCommand,
  GraphDocument,
  GraphNode,
  ProcessEdge,
  ProcessNode,
} from './canvasTypes'
import { runCommand } from './engine/commands'
import { createEmptyDocument } from './engine/graphDocument'
import { createHistoryState, pushHistory, redo, type HistoryState, undo } from './engine/history'
import { layoutGraph } from './layout/autoLayout'

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
        kind: 'decision',
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

function toProcessEdge(edge: { id: string; sourceNodeId: string; targetNodeId: string; label: string }): ProcessEdge {
  return {
    id: edge.id,
    type: 'handoff',
    source: edge.sourceNodeId,
    target: edge.targetNodeId,
    data: edge.label ? { label: edge.label } : undefined,
  }
}

function createInitialDocument(): GraphDocument {
  const empty = createEmptyDocument('flowent-canvas')
  return runCommand(empty, {
    type: 'AddNode',
    payload: {
      id: 'start',
      type: 'start',
      x: 400,
      y: 50,
      width: 120,
      height: 56,
      title: 'Start',
      roleTags: [],
      ports: [{ id: 'out', side: 'bottom' }],
    },
  })
}

type NodeDataPatch = {
  title?: string
  summary?: string
  criteria?: string
  roleIds?: string[]
}

export function useCanvasState() {
  const [history, setHistory] = useState<HistoryState<GraphDocument>>(() =>
    createHistoryState(createInitialDocument()),
  )
  const [editorNodeId, setEditorNodeId] = useState<string | null>(null)
  const [marquee, setMarquee] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null)

  const document = history.present

  const nodes = useMemo(() => Array.from(document.nodes.values()).map(toProcessNode), [document])
  const edges = useMemo(() => Array.from(document.edges.values()).map(toProcessEdge), [document])
  const selectedNodeIds = useMemo(() => document.selectedNodeIds, [document])
  const selectedNode = useMemo(() => {
    const ids = Array.from(selectedNodeIds)
    if (ids.length === 1) return nodes.find((n) => n.id === ids[0]) ?? null
    return null
  }, [nodes, selectedNodeIds])

  const applyCommand = useCallback((command: GraphCommand) => {
    setHistory((current) => {
      const nextDoc = runCommand(current.present, command)
      return pushHistory(current, nextDoc)
    })
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
    (source: string, target: string) => {
      const edgeId = `edge-${Date.now()}`
      applyCommand({
        type: 'AddEdge',
        payload: {
          id: edgeId,
          sourceNodeId: source,
          sourcePortId: 'out',
          targetNodeId: target,
          targetPortId: 'in',
          label: '',
        },
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

  const onEdgeClick = useCallback(() => {
    // No-op for now
  }, [])

  const onPaneClick = useCallback(() => {
    setHistory((current) => ({
      ...current,
      present: {
        ...current.present,
        selectedNodeIds: new Set(),
        selectedEdgeIds: new Set(),
        meta: { dirty: true, version: current.present.meta.version + 1 },
      },
    }))
    setEditorNodeId(null)
  }, [])

  const openEditor = useCallback((nodeId: string) => {
    setEditorNodeId(nodeId)
  }, [])

  const closeEditor = useCallback(() => {
    setEditorNodeId(null)
  }, [])

  const addActivity = useCallback(
    (position?: { x: number; y: number }) => {
      const id = `activity-${Date.now()}`
      setHistory((current) => {
        let next = runCommand(current.present, {
          type: 'AddNode',
          payload: {
            id,
            type: 'activity',
            x: position?.x ?? 300,
            y: position?.y ?? 220,
            width: 220,
            height: 96,
            title: 'New activity',
            summary: '',
            roleTags: [],
            ports: [
              { id: 'in', side: 'top' },
              { id: 'out', side: 'bottom' },
            ],
          },
        })
        next = runCommand(next, {
          type: 'SelectNode',
          payload: { id, additive: false },
        })
        return pushHistory(current, next)
      })
    },
    [],
  )

  const addDecision = useCallback(
    (position?: { x: number; y: number }) => {
      const id = `decision-${Date.now()}`
      setHistory((current) => {
        let next = runCommand(current.present, {
          type: 'AddNode',
          payload: {
            id,
            type: 'decision',
            x: position?.x ?? 460,
            y: position?.y ?? 320,
            width: 180,
            height: 108,
            title: 'New decision',
            criteria: '',
            roleTags: [],
            ports: [
              { id: 'in', side: 'top' },
              { id: 'yes', side: 'bottom' },
              { id: 'no', side: 'right' },
            ],
          },
        })
        next = runCommand(next, {
          type: 'SelectNode',
          payload: { id, additive: false },
        })
        return pushHistory(current, next)
      })
    },
    [],
  )

  const addEnd = useCallback(
    (position?: { x: number; y: number }) => {
      const id = `end-${Date.now()}`
      setHistory((current) => {
        let next = runCommand(current.present, {
          type: 'AddNode',
          payload: {
            id,
            type: 'end',
            x: position?.x ?? 400,
            y: position?.y ?? 620,
            width: 120,
            height: 56,
            title: 'End',
            roleTags: [],
            ports: [{ id: 'in', side: 'top' }],
          },
        })
        next = runCommand(next, {
          type: 'SelectNode',
          payload: { id, additive: false },
        })
        return pushHistory(current, next)
      })
    },
    [],
  )

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
            ...(Array.isArray(data.roleIds) ? { roleTags: data.roleIds } : {}),
          },
        },
      })
    },
    [applyCommand],
  )

  const moveSelectedNodes = useCallback(
    (dx: number, dy: number) => {
      const ids = Array.from(document.selectedNodeIds)
      if (ids.length === 0) return

      applyCommand({
        type: 'MoveNodes',
        payload: { ids, dx, dy },
      })
    },
    [document.selectedNodeIds, applyCommand],
  )

  const undoAction = useCallback(() => {
    setHistory((current) => undo(current))
    setEditorNodeId(null)
  }, [])

  const redoAction = useCallback(() => {
    setHistory((current) => redo(current))
    setEditorNodeId(null)
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

  return {
    nodes,
    edges,
    selectedNode,
    selectedNodeIds,
    editorNode,
    marquee,
    startMarquee: useCallback((x: number, y: number) => setMarquee({ x1: x, y1: y, x2: x, y2: y }), []),
    updateMarquee: useCallback((x: number, y: number) => setMarquee((c) => c ? { ...c, x2: x, y2: y } : null), []),
    endMarquee: useCallback(() => setMarquee(null), []),
    selectNodesInRect,
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
    removeSelected,
    updateNodeData,
    moveSelectedNodes,
    undo: undoAction,
    redo: redoAction,
    autoLayout,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
  }
}
