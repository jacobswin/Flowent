import { useCallback, useMemo, useState } from 'react'
import {
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type EdgeChange,
  type NodeChange,
} from '@xyflow/react'
import type {
  ActivityNodeData,
  DecisionNodeData,
  GraphCommand,
  GraphDocument,
  GraphNode,
  ProcessEdge,
  ProcessNode,
  StartEndNodeData,
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
      } satisfies ActivityNodeData,
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
      } satisfies DecisionNodeData,
    }
  }

  return {
    id: node.id,
    type: 'startEnd',
    position: { x: node.x, y: node.y },
    data: {
      label: node.title,
      kind: node.type === 'start' ? 'start' : 'end',
    } satisfies StartEndNodeData,
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
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null)
  const [editorNodeId, setEditorNodeId] = useState<string | null>(null)

  const document = history.present

  const nodes = useMemo(() => Array.from(document.nodes.values()).map(toProcessNode), [document])
  const edges = useMemo(() => Array.from(document.edges.values()).map(toProcessEdge), [document])

  const applyCommand = useCallback((command: GraphCommand) => {
    setHistory((current) => {
      const nextDoc = runCommand(current.present, command)
      return pushHistory(current, nextDoc)
    })
  }, [])

  const onNodesChange = useCallback(
    (changes: NodeChange<ProcessNode>[]) => {
      // keep compatibility with ReactFlow drag interactions
      const nextNodes = applyNodeChanges(changes, nodes)
      setHistory((current) => {
        let next = current.present

        for (const n of nextNodes) {
          const existing = next.nodes.get(n.id)
          if (!existing) continue
          next = runCommand(next, {
            type: 'UpdateNode',
            payload: {
              id: n.id,
              patch: {
                x: n.position.x,
                y: n.position.y,
              },
            },
          })
        }

        if (next === current.present) return current
        return pushHistory(current, next)
      })
    },
    [nodes],
  )

  const onEdgesChange = useCallback(
    (changes: EdgeChange<ProcessEdge>[]) => {
      // For now only support remove changes from ReactFlow edge interactions.
      const nextEdges = applyEdgeChanges(changes, edges)
      setHistory((current) => {
        const nextMap = new Map<string, { id: string; sourceNodeId: string; sourcePortId: string; targetNodeId: string; targetPortId: string; label: string }>()
        for (const e of nextEdges) {
          nextMap.set(e.id, {
            id: e.id,
            sourceNodeId: e.source,
            sourcePortId: 'out',
            targetNodeId: e.target,
            targetPortId: 'in',
            label: e.data?.label ?? '',
          })
        }

        const nextDoc: GraphDocument = {
          ...current.present,
          edges: nextMap,
          meta: {
            dirty: true,
            version: current.present.meta.version + 1,
          },
        }

        return pushHistory(current, nextDoc)
      })
    },
    [edges],
  )

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return

      const edgeId = `edge-${Date.now()}`
      applyCommand({
        type: 'AddEdge',
        payload: {
          id: edgeId,
          sourceNodeId: connection.source,
          sourcePortId: connection.sourceHandle ?? 'out',
          targetNodeId: connection.target,
          targetPortId: connection.targetHandle ?? 'in',
          label: '',
        },
      })
      setSelectedEdgeId(edgeId)
      setSelectedNodeId(null)
    },
    [applyCommand],
  )

  const openEditor = useCallback((nodeId: string) => {
    setEditorNodeId(nodeId)
    setSelectedNodeId(nodeId)
    setSelectedEdgeId(null)
  }, [])

  const closeEditor = useCallback(() => {
    setEditorNodeId(null)
  }, [])

  const onNodeClick = useCallback((_event: React.MouseEvent, node: ProcessNode) => {
    setSelectedNodeId(node.id)
    setSelectedEdgeId(null)
  }, [])

  const onEdgeClick = useCallback((_event: React.MouseEvent, edge: ProcessEdge) => {
    setSelectedEdgeId(edge.id)
    setSelectedNodeId(null)
  }, [])

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null)
    setSelectedEdgeId(null)
    setEditorNodeId(null)
  }, [])

  const addActivity = useCallback(
    (position?: { x: number; y: number }) => {
      const id = `activity-${Date.now()}`
      applyCommand({
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
      setSelectedNodeId(id)
      setSelectedEdgeId(null)
    },
    [applyCommand],
  )

  const addDecision = useCallback(
    (position?: { x: number; y: number }) => {
      const id = `decision-${Date.now()}`
      applyCommand({
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
      setSelectedNodeId(id)
      setSelectedEdgeId(null)
    },
    [applyCommand],
  )

  const addEnd = useCallback(
    (position?: { x: number; y: number }) => {
      const id = `end-${Date.now()}`
      applyCommand({
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
      setSelectedNodeId(id)
      setSelectedEdgeId(null)
    },
    [applyCommand],
  )

  const removeSelected = useCallback(() => {
    setHistory((current) => {
      let next = current.present

      if (selectedNodeId && selectedNodeId !== 'start') {
        const nodes = new Map(next.nodes)
        nodes.delete(selectedNodeId)

        const edges = new Map(next.edges)
        for (const [id, edge] of edges.entries()) {
          if (edge.sourceNodeId === selectedNodeId || edge.targetNodeId === selectedNodeId) {
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

      if (selectedEdgeId) {
        const edges = new Map(next.edges)
        edges.delete(selectedEdgeId)
        next = {
          ...next,
          edges,
          meta: { dirty: true, version: next.meta.version + 1 },
        }
      }

      if (next === current.present) return current
      return pushHistory(current, next)
    })

    setSelectedNodeId(null)
    setSelectedEdgeId(null)
  }, [selectedNodeId, selectedEdgeId])

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

  const undoAction = useCallback(() => {
    setHistory((current) => undo(current))
    setSelectedNodeId(null)
    setSelectedEdgeId(null)
  }, [])

  const redoAction = useCallback(() => {
    setHistory((current) => redo(current))
    setSelectedNodeId(null)
    setSelectedEdgeId(null)
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

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) ?? null
  const selectedEdge = edges.find((e) => e.id === selectedEdgeId) ?? null
  const editorNode = nodes.find((n) => n.id === editorNodeId) ?? null

  return {
    nodes,
    edges,
    selectedNode,
    selectedEdge,
    selectedNodeId,
    selectedEdgeId,
    editorNode,
    editorNodeId,
    openEditor,
    closeEditor,
    onNodesChange,
    onEdgesChange,
    onConnect,
    onNodeClick,
    onEdgeClick,
    onPaneClick,
    addActivity,
    addDecision,
    addEnd,
    removeSelected,
    updateNodeData,
    undo: undoAction,
    redo: redoAction,
    autoLayout,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
  }
}
