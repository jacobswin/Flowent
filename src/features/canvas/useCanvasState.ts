import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  EdgeEndpointAnchor,
  GraphCommand,
  GraphDocument,
  GraphEdge,
  GraphNode,
  GuidanceKind,
  ActivityResponsibility,
  GuidanceAsset,
  MilestoneAsset,
  ProcessEdge,
  ProcessNode,
  ProcessStageData,
  ReviewStatus,
  WorkProductAsset,
} from './canvasTypes'
import type { SharedElementLibrary, SharedProcess } from './sharedElements'
import { insertSharedProcessInstance, syncSharedProcessInstances } from './sharedProcessProjection'
import { runCommand } from './engine/commands'
import { createEmptyDocument } from './engine/graphDocument'
import { planConnectedNodeFromPort, planQuickCreate } from './engine/quickCreate'
import { createHistoryState, pushHistory, redo, type HistoryState, setPresent, undo } from './engine/history'
import { layoutGraph } from './layout/autoLayout'
import { layoutFlowGraph } from './layout/flowLayout'
import { layoutSwimlaneGraph } from './layout/swimlaneLayout'
import { getLayoutViewport } from './layout/layoutViewport'
import { createGraphNode, createHandoffEdge, getPortsForNodeType, type ProcessElementType } from './processElements'
import { addNodeToContainingStage, detachNodeFromMapStages } from './stageContainers'
import { collectRoles, deriveProcessFocus, type ProcessFocusState } from './focus/processFocus'
import { getProcessMapDiagnostics } from './diagnostics/processMapDiagnostics'
import { getBottleneckMetrics } from './diagnostics/bottleneckMetrics'
import { analyzeProcessStages } from './diagnostics/processIntelligence'
import { buildActivationSnapshot, deriveActivationStatus, isActivationEligible, type ActivationState } from './activation/processActivation'
import { DEFAULT_EDGE_COLOR } from './edgeColors'
import {
  addGuidanceAsset,
  addMilestoneAsset,
  addResponsibility,
  addWorkProductAsset,
  collectResponsibilityRoleTags,
  DEFAULT_WORK_PRODUCT_MATURITY,
  deleteGuidanceAsset,
  deleteMilestoneAsset,
  deleteWorkProductAsset,
  getActivityResponsibilities,
  getEdgeAssetSummary,
  getNodeAssetSummary,
  linkGuidanceToHandoff,
  linkGuidanceToActivity,
  linkGuidanceToWorkProduct,
  linkWorkProductToActivity,
  linkWorkProductToHandoff,
  normalizeActivityResponsibilities,
  renameGuidanceAsset,
  renameMilestoneAsset,
  renameWorkProductAsset,
  removeMilestoneWorkProductState,
  removeResponsibility,
  unlinkGuidanceFromHandoff,
  unlinkGuidanceFromActivity,
  unlinkGuidanceFromWorkProduct,
  unlinkWorkProductFromActivity,
  unlinkWorkProductFromHandoff,
  updateGuidanceAsset,
  updateMilestoneAsset,
  updateWorkProductAsset,
  upsertMilestoneWorkProductState,
} from './processAssets'

type ProcessAssetKind = 'workProduct' | 'guidance' | 'milestone'
type ProcessAssetSelection = { kind: ProcessAssetKind; id: string }
type ProcessAssetRelation =
  | 'producer'
  | 'consumer'
  | 'handoff'
  | 'guidance'
  | 'node'
  | 'edge'
  | 'workProduct'
  | 'stage'
  | 'workProductState'
type ProcessAssetRelationOptions = { maturity?: string }
const MIN_ZOOM = 0.05
const MAX_ZOOM = 5

function clampZoom(zoom: number): number {
  return Math.min(Math.max(zoom, MIN_ZOOM), MAX_ZOOM)
}

function dirtyMeta(meta: GraphDocument['meta']): GraphDocument['meta'] {
  return { ...meta, dirty: true, version: meta.version + 1 }
}

function shouldRepairCollapsedVerticalLayout(doc: GraphDocument): boolean {
  if (doc.meta.layoutProfile === 'generated-flow' || doc.meta.layoutProfile === 'swimlane') return false

  const nodes = Array.from(doc.nodes.values())
  if (nodes.length < 8) return false

  const xBuckets = new Set(nodes.map((node) => Math.round(node.x / 50) * 50)).size
  const yBuckets = new Set(nodes.map((node) => Math.round(node.y / 50) * 50)).size
  if (xBuckets > 3 || yBuckets < 8) return false

  const order = new Map<string, number>()
  let nextOrder = 1
  for (const node of nodes) {
    if (node.id === 'start') {
      order.set(node.id, 0)
    } else if (node.id === 'end') {
      order.set(node.id, nodes.length + 1)
    } else {
      order.set(node.id, nextOrder)
      nextOrder += 1
    }
  }

  return Array.from(doc.edges.values()).some((edge) => {
    const sourceOrder = order.get(edge.sourceNodeId)
    const targetOrder = order.get(edge.targetNodeId)
    return sourceOrder != null && targetOrder != null && sourceOrder >= targetOrder
  })
}

function toProcessNode(node: GraphNode, doc: GraphDocument): ProcessNode {
  if (node.type === 'activity') {
    const responsibilities = getActivityResponsibilities(node)
    return {
      id: node.id,
      type: 'activity',
      position: { x: node.x, y: node.y },
      data: {
        title: node.title,
        summary: node.summary ?? '',
        roleIds: node.roleTags,
        responsibilities,
        expectations: node.expectations ?? '',
        processStage: node.processStage,
        assetSummary: getNodeAssetSummary(doc, node.id),
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
        ownerRoleId: node.ownerRoleId,
        memberNodeIds: node.memberNodeIds ?? [],
        stagePadding: node.stagePadding,
        assetSummary: getNodeAssetSummary(doc, node.id),
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

function toProcessEdge(edge: GraphEdge, doc: GraphDocument): ProcessEdge {
  const assetSummary = getEdgeAssetSummary(doc, edge.id)
  const workProductIds = edge.workProductIds ?? Object.values(doc.processAssets.workProducts)
    .filter((asset) => asset.handoffEdgeIds.includes(edge.id))
    .map((asset) => asset.id)
  return {
    id: edge.id,
    type: 'handoff',
    source: edge.sourceNodeId,
    target: edge.targetNodeId,
    sourceHandle: edge.sourcePortId,
    targetHandle: edge.targetPortId,
    data: {
      label: edge.label,
      color: edge.color ?? DEFAULT_EDGE_COLOR,
      sourceAnchor: edge.sourceAnchor,
      targetAnchor: edge.targetAnchor,
      fromRole: edge.fromRole ?? '',
      toRole: edge.toRole ?? '',
      artifact: edge.artifact ?? '',
      expectation: edge.expectation ?? '',
      readinessSignal: edge.readinessSignal ?? '',
      reviewStatus: edge.reviewStatus ?? 'unclear',
      workProductIds,
      assetSummary,
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
 * Migrates older node-port shapes to the current four-side schema. The
 * exported name is kept for compatibility with older callers that only knew
 * about decision-port migration.
 */
export function migrateDecisionPorts(doc: GraphDocument): GraphDocument {
  let changed = false
  const nodes = new Map(doc.nodes)
  const portRemap = new Map<string, Map<string, string>>()

  for (const [id, node] of nodes) {
    const nextPorts = getPortsForNodeType(node.type)
    const samePorts =
      node.ports.length === nextPorts.length &&
      node.ports.every((port, index) => port.id === nextPorts[index].id && port.side === nextPorts[index].side)
    if (samePorts) continue

    changed = true
    const nodeRemap = new Map<string, string>()
    for (const oldPort of node.ports) {
      const nextPort = nextPorts.find((port) => port.side === oldPort.side)
      if (nextPort) nodeRemap.set(oldPort.id, nextPort.id)
    }
    portRemap.set(id, nodeRemap)
    nodes.set(id, { ...node, ports: nextPorts })
  }

  if (!changed) return doc

  const edges = new Map(doc.edges)
  for (const [id, edge] of edges) {
    const sourcePortId = portRemap.get(edge.sourceNodeId)?.get(edge.sourcePortId) ?? edge.sourcePortId
    const targetPortId = portRemap.get(edge.targetNodeId)?.get(edge.targetPortId) ?? edge.targetPortId
    if (sourcePortId !== edge.sourcePortId || targetPortId !== edge.targetPortId) {
      edges.set(id, { ...edge, sourcePortId, targetPortId })
    }
  }

  return {
    ...doc,
    nodes,
    edges,
    meta: dirtyMeta(doc.meta),
  }
}

function createInitialDocument(): GraphDocument {
  const empty = createEmptyDocument('flowent-canvas')
  return runCommand(empty, {
    type: 'AddNode',
    payload: createGraphNode('start', 'start', { x: 360, y: 200 }),
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
  ownerRoleId?: string
  memberNodeIds?: string[]
  stagePadding?: number
  symptom?: string
  impact?: string
  suspectedCause?: string
  reviewStatus?: ReviewStatus
  responsibilities?: ActivityResponsibility[]
  processStage?: ProcessStageData
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
  const [focus, setFocus] = useState<ProcessFocusState>({ mode: 'all' })
  // Activation snapshot is held in local React state and persisted by
  // LibraryGate via saveMapActivation. The hook recomputes the status
  // from the current doc + the saved snapshot on every render.
  const [activationSnapshot, setActivationSnapshot] = useState<ActivationState | null>(null)

  const document = history.present

  const focusView = useMemo(() => deriveProcessFocus(document, focus), [document, focus])
  const roles = useMemo(() => collectRoles(document), [document])
  const diagnostics = useMemo(() => getProcessMapDiagnostics(document), [document])
  const bottleneckMetrics = useMemo(() => getBottleneckMetrics(document), [document])
  const processIntelligence = useMemo(() => {
    const activities = Array.from(document.nodes.values()).filter((node) => node.type === 'activity')
    const hasAnalysisData = Boolean(document.meta.processAnalysis) || activities.some((node) => node.processStage)
    if (!hasAnalysisData) return null
    return analyzeProcessStages(
      activities.map((node) => ({
        nodeId: node.id,
        title: node.title,
        kind: node.processStage?.kind ?? 'value-add',
        durationMinutesP50: node.processStage?.durationMinutesP50,
        durationMinutesP90: node.processStage?.durationMinutesP90,
      })),
      document.meta.processAnalysis,
    )
  }, [document])
  const activation = useMemo(
    () => deriveActivationStatus(document, activationSnapshot),
    [document, activationSnapshot],
  )
  const activationEligible = useMemo(() => isActivationEligible(document), [document])

  const nodes = useMemo(() => Array.from(document.nodes.values()).map((node) => toProcessNode(node, document)), [document])
  const edges = useMemo(() => Array.from(document.edges.values()).map((edge) => toProcessEdge(edge, document)), [document])
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
    return edge ? toProcessEdge(edge, document) : null
  }, [document, selectedEdgeIds])
  const [editorEdgeId, setEditorEdgeId] = useState<string | null>(null)
  const editorEdge = useMemo(() => {
    if (!editorEdgeId) return null
    const edge = document.edges.get(editorEdgeId)
    return edge ? toProcessEdge(edge, document) : null
  }, [document, editorEdgeId])
  const [selectedAsset, setSelectedAsset] = useState<ProcessAssetSelection | null>(null)

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
    (
      sourceNodeId: string,
      targetNodeId: string,
      sourcePortId = 'out',
      targetPortId = 'in',
      anchors: { sourceAnchor?: EdgeEndpointAnchor; targetAnchor?: EdgeEndpointAnchor } = {},
    ) => {
      const edgeId = `edge-${Date.now()}`
      applyCommand({
        type: 'AddEdge',
        payload: createHandoffEdge(edgeId, sourceNodeId, sourcePortId, targetNodeId, targetPortId, anchors),
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
      setEditorEdgeId(null)
    },
    [applyCommand],
  )

  const onEdgeClick = useCallback(
    (edgeId: string, additive: boolean) => {
      // Compute the post-command selection without going through the
      // async setHistory path so we can decide synchronously whether
      // the click just removed the edge from the selection (shift+click
      // on an already-selected edge to deselect).
      const currentSelection = history.present.selectedEdgeIds
      const isCurrentlySelected = currentSelection.has(edgeId)
      const nextSelected = new Set(currentSelection)
      if (additive) {
        if (isCurrentlySelected) {
          nextSelected.delete(edgeId)
        } else {
          nextSelected.add(edgeId)
        }
      } else {
        nextSelected.clear()
        nextSelected.add(edgeId)
      }
      applyCommand({ type: 'SelectEdge', payload: { id: edgeId, additive } })

      if (!nextSelected.has(edgeId)) {
        setEditorEdgeId(null)
        setEditorNodeId(null)
        return
      }
      setEditorEdgeId(null)
      setEditorNodeId(null)
    },
    [applyCommand, history.present.selectedEdgeIds],
  )

  const toggleConnectorMode = useCallback(() => {
    setConnectorMode((prev) => !prev)
    setConnectionStart(null)
  }, [])

  const startConnection = useCallback((nodeId: string, portId: string) => {
    setConnectionStart({ nodeId, portId })
  }, [])

  const cancelConnection = useCallback(() => {
    setConnectionStart(null)
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
      meta: dirtyMeta(current.present.meta),
    }))
    setEditorNodeId(null)
    setEditorEdgeId(null)
    setConnectionStart(null)
  }, [])

  const openEditor = useCallback((nodeId: string) => {
    setEditorNodeId(nodeId)
    setEditorEdgeId(null)
  }, [])

  const openEdgeEditor = useCallback((edgeId: string) => {
    setEditorEdgeId(edgeId)
    setEditorNodeId(null)
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

  const createConnectedNodeFromPort = useCallback((
    sourceNodeId: string,
    sourcePortId: string,
    targetType: ProcessElementType,
    dropPosition: { x: number; y: number },
    sourceAnchor?: EdgeEndpointAnchor,
  ) => {
    setHistory((current) => {
      const newNodeId = `${targetType}-${Date.now()}`
      const newEdgeId = `edge-${Date.now()}`
      const plan = planConnectedNodeFromPort(current.present, {
        sourceNodeId,
        sourcePortId,
        targetType,
        newNodeId,
        newEdgeId,
        dropPosition,
        sourceAnchor,
      })

      let next = runCommand(current.present, { type: 'AddNode', payload: plan.node })
      if (plan.edge) {
        next = runCommand(next, { type: 'AddEdge', payload: plan.edge })
      }
      next = runCommand(next, { type: 'SelectNode', payload: { id: plan.node.id, additive: false } })
      return pushHistory(current, next)
    })
    setConnectionStart(null)
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
          meta: dirtyMeta(next.meta),
        }
      }

      for (const edgeId of next.selectedEdgeIds) {
        const edges = new Map(next.edges)
        edges.delete(edgeId)
        next = {
          ...next,
          edges,
          meta: dirtyMeta(next.meta),
        }
      }

      if (next === current.present) return current
      // The currently-open editor may reference a node or edge that just
      // got deleted. Close both editors so an undo doesn't re-open a
      // stale panel for a missing entity.
      setEditorNodeId(null)
      setEditorEdgeId(null)
      return pushHistory(current, {
        ...next,
        selectedNodeIds: new Set(),
        selectedEdgeIds: new Set(),
      })
    })
  }, [])

  const updateNodeData = useCallback(
    (nodeId: string, data: NodeDataPatch) => {
      const responsibilities = Array.isArray(data.responsibilities)
        ? normalizeActivityResponsibilities(data.responsibilities, { nodeId })
        : null
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
            ...(responsibilities ? {
              responsibilities,
              roleTags: collectResponsibilityRoleTags(responsibilities),
            } : {}),
            ...(typeof data.expectations === 'string' ? { expectations: data.expectations } : {}),
            ...(typeof data.owner === 'string' ? { owner: data.owner } : {}),
            ...(typeof data.goal === 'string' ? { goal: data.goal } : {}),
            ...(typeof data.entryCondition === 'string' ? { entryCondition: data.entryCondition } : {}),
            ...(typeof data.exitCondition === 'string' ? { exitCondition: data.exitCondition } : {}),
            ...(typeof data.ownerRoleId === 'string' || data.ownerRoleId === undefined && Object.hasOwn(data, 'ownerRoleId') ? { ownerRoleId: data.ownerRoleId } : {}),
            ...(Array.isArray(data.memberNodeIds) ? { memberNodeIds: data.memberNodeIds } : {}),
            ...(typeof data.stagePadding === 'number' ? { stagePadding: data.stagePadding } : {}),
            ...(typeof data.symptom === 'string' ? { symptom: data.symptom } : {}),
            ...(typeof data.impact === 'string' ? { impact: data.impact } : {}),
            ...(typeof data.suspectedCause === 'string' ? { suspectedCause: data.suspectedCause } : {}),
            ...(isReviewStatus(data.reviewStatus) ? { reviewStatus: data.reviewStatus } : {}),
            ...(isProcessStageData(data.processStage) ? { processStage: data.processStage } : {}),
          },
        },
      })
    },
    [applyCommand],
  )

  type EdgeDataPatch = {
    sourceNodeId?: string
    sourcePortId?: string
    sourceAnchor?: EdgeEndpointAnchor
    targetNodeId?: string
    targetPortId?: string
    targetAnchor?: EdgeEndpointAnchor
    label?: string
    color?: string
    fromRole?: string
    toRole?: string
    artifact?: string
    expectation?: string
    readinessSignal?: string
    reviewStatus?: ReviewStatus
    workProductIds?: string[]
  }

  const updateEdgeData = useCallback(
    (edgeId: string, data: EdgeDataPatch) => {
      applyCommand({
        type: 'UpdateEdge',
        payload: {
          id: edgeId,
          patch: {
            ...(typeof data.sourceNodeId === 'string' ? { sourceNodeId: data.sourceNodeId } : {}),
            ...(typeof data.sourcePortId === 'string' ? { sourcePortId: data.sourcePortId } : {}),
            ...(data.sourceAnchor ? { sourceAnchor: data.sourceAnchor } : {}),
            ...(typeof data.targetNodeId === 'string' ? { targetNodeId: data.targetNodeId } : {}),
            ...(typeof data.targetPortId === 'string' ? { targetPortId: data.targetPortId } : {}),
            ...(data.targetAnchor ? { targetAnchor: data.targetAnchor } : {}),
            ...(typeof data.label === 'string' ? { label: data.label } : {}),
            ...(typeof data.color === 'string' ? { color: data.color } : {}),
            ...(typeof data.fromRole === 'string' ? { fromRole: data.fromRole } : {}),
            ...(typeof data.toRole === 'string' ? { toRole: data.toRole } : {}),
            ...(typeof data.artifact === 'string' ? { artifact: data.artifact } : {}),
            ...(typeof data.expectation === 'string' ? { expectation: data.expectation } : {}),
            ...(typeof data.readinessSignal === 'string' ? { readinessSignal: data.readinessSignal } : {}),
            ...(isReviewStatus(data.reviewStatus) ? { reviewStatus: data.reviewStatus } : {}),
            ...(Array.isArray(data.workProductIds) ? { workProductIds: data.workProductIds } : {}),
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

  const applyFlowLayout = useCallback(async () => {
    if (document.nodes.size === 0) return
    const laidOut = await layoutFlowGraph(document)

    setHistory((current) => {
      if (current.present.id !== document.id) return current
      return pushHistory(current, {
        ...laidOut,
        viewport: getLayoutViewport(
          Array.from(laidOut.nodes.values()),
          'left-to-right',
          current.present.viewport,
        ),
        meta: dirtyMeta(laidOut.meta),
      })
    })
  }, [document])

  const applySwimlaneLayout = useCallback(() => {
    setHistory((current) => {
      if (current.present.nodes.size === 0) return current
      const laidOut = layoutSwimlaneGraph(current.present)
      return pushHistory(current, {
        ...laidOut,
        viewport: getLayoutViewport(
          Array.from(laidOut.nodes.values()),
          'swimlane',
          current.present.viewport,
        ),
        meta: dirtyMeta(laidOut.meta),
      })
    })
  }, [])

  const autoLayout = applyFlowLayout

  const repairedCollapsedLayoutIds = useRef<Set<string>>(new Set())
  useEffect(() => {
    if (repairedCollapsedLayoutIds.current.has(document.id)) return
    if (!shouldRepairCollapsedVerticalLayout(document)) return
    repairedCollapsedLayoutIds.current.add(document.id)

    let cancelled = false
    void layoutGraph({
      nodes: Array.from(document.nodes.values()),
      edges: Array.from(document.edges.values()),
    }).then((layout) => {
      if (cancelled) return
      setHistory((current) => {
        if (current.present.id !== document.id) return current
        if (!shouldRepairCollapsedVerticalLayout(current.present)) return current

        const nodes = new Map(current.present.nodes)
        for (const pos of layout.nodes) {
          const node = nodes.get(pos.id)
          if (node) nodes.set(pos.id, { ...node, x: pos.x, y: pos.y })
        }

        return pushHistory(current, {
          ...current.present,
          nodes,
          selectedNodeIds: new Set(),
          selectedEdgeIds: new Set(),
          viewport: { x: 0, y: 0, zoom: 1 },
          meta: dirtyMeta(current.present.meta),
        })
      })
    })

    return () => {
      cancelled = true
    }
  }, [document])

  const zoomIn = useCallback(() => {
    setHistory((current) => {
      const newZoom = clampZoom(current.present.viewport.zoom * 1.2)
      return setPresent(current, {
        ...current.present,
        meta: dirtyMeta(current.present.meta),
        viewport: { ...current.present.viewport, zoom: newZoom },
      })
    })
  }, [])

  const zoomOut = useCallback(() => {
    setHistory((current) => {
      const newZoom = clampZoom(current.present.viewport.zoom / 1.2)
      return setPresent(current, {
        ...current.present,
        meta: dirtyMeta(current.present.meta),
        viewport: { ...current.present.viewport, zoom: newZoom },
      })
    })
  }, [])

  const zoomReset = useCallback(() => {
    setHistory((current) =>
      setPresent(current, {
        ...current.present,
        meta: dirtyMeta(current.present.meta),
        viewport: { x: 0, y: 0, zoom: 1 },
      }),
    )
  }, [])

  const zoomToPercent = useCallback((percent: number) => {
    if (!Number.isFinite(percent)) return
    setHistory((current) => {
      const newZoom = clampZoom(Math.round(percent) / 100)
      if (newZoom === current.present.viewport.zoom) return current
      return setPresent(current, {
        ...current.present,
        meta: dirtyMeta(current.present.meta),
        viewport: { ...current.present.viewport, zoom: newZoom },
      })
    })
  }, [])

  /**
   * Zoom by a multiplicative factor while keeping the screen point under the
   * cursor anchored. Used by mouse wheel and trackpad pinch.
   */
  const zoomAt = useCallback((factor: number, screenX: number, screenY: number) => {
    setHistory((current) => {
      const viewport = current.present.viewport
      const newZoom = clampZoom(viewport.zoom * factor)
      if (newZoom === viewport.zoom) return current

      // World point under cursor before zoom stays under cursor after zoom.
      const worldX = (screenX - viewport.x) / viewport.zoom
      const worldY = (screenY - viewport.y) / viewport.zoom
      const nextX = screenX - worldX * newZoom
      const nextY = screenY - worldY * newZoom

      return setPresent(current, {
        ...current.present,
        meta: dirtyMeta(current.present.meta),
        viewport: { x: nextX, y: nextY, zoom: newZoom },
      })
    })
  }, [])

  const panBy = useCallback((dx: number, dy: number) => {
    setHistory((current) =>
      setPresent(current, {
        ...current.present,
        meta: dirtyMeta(current.present.meta),
        viewport: {
          x: current.present.viewport.x + dx,
          y: current.present.viewport.y + dy,
          zoom: current.present.viewport.zoom,
        },
      }),
    )
  }, [])

  const replaceDocument = useCallback((nextDocument: GraphDocument) => {
    const migrated = migrateDecisionPorts({
      ...nextDocument,
      selectedNodeIds: new Set(),
      selectedEdgeIds: new Set(),
      meta: {
        ...nextDocument.meta,
        dirty: true,
        version: nextDocument.meta.version + 1,
      },
    })
    setHistory(createHistoryState(migrated))
    liveSelectedNodeIds.current = new Set()
    setEditorNodeId(null)
    setEditorEdgeId(null)
    setSelectedAsset(null)
    setConnectionStart(null)
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
          meta: dirtyMeta(current.present.meta),
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

  const mutateDocument = useCallback((mutator: (doc: GraphDocument) => GraphDocument) => {
    setHistory((current) => {
      const next = mutator(current.present)
      return next === current.present ? current : pushHistory(current, next)
    })
  }, [])

  const beginNodeDrag = useCallback((nodeId: string) => {
    mutateDocument((doc) => detachNodeFromMapStages(doc, nodeId))
  }, [mutateDocument])

  const completeNodeDrag = useCallback((nodeId: string) => {
    mutateDocument((doc) => addNodeToContainingStage(doc, nodeId))
  }, [mutateDocument])

  const createId = useCallback((prefix: string) => (
    `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  ), [])

  const insertSharedProcess = useCallback((
    process: SharedProcess,
    library: SharedElementLibrary,
    position: { x: number; y: number } = { x: 320, y: 240 },
  ) => {
    const instanceId = createId('process-instance')
    mutateDocument((doc) => insertSharedProcessInstance(doc, process, instanceId, position, library))
  }, [createId, mutateDocument])

  const syncSharedProcesses = useCallback((library: SharedElementLibrary) => {
    mutateDocument((doc) => syncSharedProcessInstances(doc, library))
  }, [mutateDocument])

  const removeSharedProcessInstance = useCallback((instanceId: string) => {
    mutateDocument((doc) => {
      const instance = doc.processInstances[instanceId]
      if (!instance) return doc
      const removedNodeIds = new Set([
        ...Object.values(instance.nodeIdsByPlacement),
        ...Object.values(instance.nodeIdsByDecision ?? {}),
        ...Object.values(instance.stageNodeIdsByStage ?? {}),
      ])
      const nodes = new Map(doc.nodes)
      for (const nodeId of removedNodeIds) nodes.delete(nodeId)
      const edges = new Map(Array.from(doc.edges.entries()).filter(([, edge]) =>
        edge.processInstanceId !== instanceId &&
        !removedNodeIds.has(edge.sourceNodeId) &&
        !removedNodeIds.has(edge.targetNodeId),
      ))
      const processInstances = { ...doc.processInstances }
      delete processInstances[instanceId]
      return {
        ...doc,
        nodes,
        edges,
        processInstances,
        selectedNodeIds: new Set(Array.from(doc.selectedNodeIds).filter((id) => nodes.has(id))),
        selectedEdgeIds: new Set(Array.from(doc.selectedEdgeIds).filter((id) => edges.has(id))),
        meta: dirtyMeta(doc.meta),
      }
    })
  }, [mutateDocument])

  const addActivityResponsibility = useCallback((
    nodeId: string,
    responsibility: { roleName: string; kind: ActivityResponsibility['kind'] },
  ) => {
    mutateDocument((doc) => addResponsibility(doc, nodeId, responsibility))
  }, [mutateDocument])

  const removeActivityResponsibility = useCallback((nodeId: string, responsibilityId: string) => {
    mutateDocument((doc) => removeResponsibility(doc, nodeId, responsibilityId))
  }, [mutateDocument])

  const createWorkProductForActivity = useCallback((
    nodeId: string,
    relation: 'input' | 'output',
    title: string,
    maturity?: string,
  ) => {
    const trimmed = title.trim()
    if (!trimmed) return
    const nextMaturity = maturity?.trim() || (relation === 'input' ? 'Needed' : DEFAULT_WORK_PRODUCT_MATURITY)
    mutateDocument((doc) => {
      const id = createId('wp')
      return linkWorkProductToActivity(
        addWorkProductAsset(doc, { id, title: trimmed, state: nextMaturity, description: '' }),
        id,
        nodeId,
        relation,
        nextMaturity,
      )
    })
  }, [createId, mutateDocument])

  const linkExistingWorkProductToActivity = useCallback((
    nodeId: string,
    relation: 'input' | 'output',
    workProductId: string,
    maturity?: string,
  ) => {
    mutateDocument((doc) => linkWorkProductToActivity(doc, workProductId, nodeId, relation, maturity))
  }, [mutateDocument])

  const unlinkExistingWorkProductFromActivity = useCallback((
    nodeId: string,
    relation: 'input' | 'output',
    workProductId: string,
    maturity?: string,
  ) => {
    mutateDocument((doc) => unlinkWorkProductFromActivity(doc, workProductId, nodeId, relation, maturity))
  }, [mutateDocument])

  const createGuidanceForActivity = useCallback((
    nodeId: string,
    data: { title: string; kind: GuidanceKind },
  ) => {
    const title = data.title.trim()
    if (!title) return
    mutateDocument((doc) => {
      const id = createId('guide')
      return linkGuidanceToActivity(
        addGuidanceAsset(doc, { id, title, kind: data.kind, description: '', url: '' }),
        id,
        nodeId,
      )
    })
  }, [createId, mutateDocument])

  const linkExistingGuidanceToActivity = useCallback((nodeId: string, guidanceId: string) => {
    mutateDocument((doc) => linkGuidanceToActivity(doc, guidanceId, nodeId))
  }, [mutateDocument])

  const unlinkExistingGuidanceFromActivity = useCallback((nodeId: string, guidanceId: string) => {
    mutateDocument((doc) => unlinkGuidanceFromActivity(doc, guidanceId, nodeId))
  }, [mutateDocument])

  const createMilestoneForStage = useCallback((stageNodeId: string, title: string) => {
    const trimmed = title.trim()
    if (!trimmed) return
    mutateDocument((doc) => addMilestoneAsset(doc, {
      id: createId('milestone'),
      title: trimmed,
      description: '',
      stageNodeId,
      workProductStates: [],
    }))
  }, [createId, mutateDocument])

  const addMilestoneWorkProductState = useCallback((milestoneId: string, workProductId: string, state: string) => {
    const trimmed = state.trim()
    if (!trimmed) return
    mutateDocument((doc) => upsertMilestoneWorkProductState(doc, milestoneId, workProductId, trimmed))
  }, [mutateDocument])

  const createWorkProductForHandoff = useCallback((edgeId: string, title: string) => {
    const trimmed = title.trim()
    if (!trimmed) return
    mutateDocument((doc) => {
      const id = createId('wp')
      return linkWorkProductToHandoff(
        addWorkProductAsset(doc, { id, title: trimmed, state: 'Moved', description: '' }),
        id,
        edgeId,
      )
    })
  }, [createId, mutateDocument])

  const linkExistingWorkProductToHandoff = useCallback((edgeId: string, workProductId: string) => {
    mutateDocument((doc) => linkWorkProductToHandoff(doc, workProductId, edgeId))
  }, [mutateDocument])

  const unlinkExistingWorkProductFromHandoff = useCallback((workProductId: string, edgeId: string) => {
    mutateDocument((doc) => unlinkWorkProductFromHandoff(doc, workProductId, edgeId))
  }, [mutateDocument])

  const linkExistingGuidanceToWorkProduct = useCallback((guidanceId: string, workProductId: string) => {
    mutateDocument((doc) => linkGuidanceToWorkProduct(doc, guidanceId, workProductId))
  }, [mutateDocument])

  const removeExistingMilestoneWorkProductState = useCallback((milestoneId: string, workProductId: string) => {
    mutateDocument((doc) => removeMilestoneWorkProductState(doc, milestoneId, workProductId))
  }, [mutateDocument])

  const createProcessAsset = useCallback((
    kind: ProcessAssetKind,
    data: { title: string; kind?: GuidanceKind },
  ) => {
    const title = data.title.trim()
    if (!title) return
    const id = createId(kind === 'workProduct' ? 'wp' : kind === 'guidance' ? 'guide' : 'milestone')
    mutateDocument((doc) => {
      if (kind === 'workProduct') {
        return addWorkProductAsset(doc, { id, title, state: 'Draft', description: '' })
      }
      if (kind === 'guidance') {
        return addGuidanceAsset(doc, { id, title, kind: data.kind ?? 'checklist', description: '', url: '' })
      }
      return addMilestoneAsset(doc, {
        id,
        title,
        description: '',
        stageNodeId: null,
        workProductStates: [],
      })
    })
    setSelectedAsset({ kind, id })
  }, [createId, mutateDocument])

  const updateProcessAsset = useCallback((
    kind: ProcessAssetKind,
    id: string,
    patch: Partial<WorkProductAsset> | Partial<GuidanceAsset> | Partial<MilestoneAsset>,
  ) => {
    mutateDocument((doc) => {
      if (kind === 'workProduct') return updateWorkProductAsset(doc, id, patch as Partial<WorkProductAsset>)
      if (kind === 'guidance') return updateGuidanceAsset(doc, id, patch as Partial<GuidanceAsset>)
      return updateMilestoneAsset(doc, id, patch as Partial<MilestoneAsset>)
    })
  }, [mutateDocument])

  const linkProcessAsset = useCallback((kind: ProcessAssetKind, id: string, relation: ProcessAssetRelation, targetId: string, options?: ProcessAssetRelationOptions) => {
    mutateDocument((doc) => {
      if (kind === 'workProduct') {
        if (relation === 'producer') return linkWorkProductToActivity(doc, id, targetId, 'output', options?.maturity)
        if (relation === 'consumer') return linkWorkProductToActivity(doc, id, targetId, 'input', options?.maturity)
        if (relation === 'handoff') return linkWorkProductToHandoff(doc, id, targetId)
        if (relation === 'guidance') return linkGuidanceToWorkProduct(doc, targetId, id)
        return doc
      }
      if (kind === 'guidance') {
        if (relation === 'node') return linkGuidanceToActivity(doc, id, targetId)
        if (relation === 'edge' || relation === 'handoff') return linkGuidanceToHandoff(doc, id, targetId)
        if (relation === 'workProduct') return linkGuidanceToWorkProduct(doc, id, targetId)
        return doc
      }
      if (relation === 'stage') return updateMilestoneAsset(doc, id, { stageNodeId: targetId || null })
      return doc
    })
  }, [mutateDocument])

  const unlinkProcessAsset = useCallback((kind: ProcessAssetKind, id: string, relation: ProcessAssetRelation, targetId: string, options?: ProcessAssetRelationOptions) => {
    mutateDocument((doc) => {
      if (kind === 'workProduct') {
        if (relation === 'producer') return unlinkWorkProductFromActivity(doc, id, targetId, 'output', options?.maturity)
        if (relation === 'consumer') return unlinkWorkProductFromActivity(doc, id, targetId, 'input', options?.maturity)
        if (relation === 'handoff') return unlinkWorkProductFromHandoff(doc, id, targetId)
        if (relation === 'guidance') return unlinkGuidanceFromWorkProduct(doc, targetId, id)
        return doc
      }
      if (kind === 'guidance') {
        if (relation === 'node') return unlinkGuidanceFromActivity(doc, id, targetId)
        if (relation === 'edge' || relation === 'handoff') return unlinkGuidanceFromHandoff(doc, id, targetId)
        if (relation === 'workProduct') return unlinkGuidanceFromWorkProduct(doc, id, targetId)
        return doc
      }
      if (relation === 'stage') return updateMilestoneAsset(doc, id, { stageNodeId: null })
      if (relation === 'workProductState') return removeMilestoneWorkProductState(doc, id, targetId)
      return doc
    })
  }, [mutateDocument])

  const renameProcessAsset = useCallback((kind: 'workProduct' | 'guidance' | 'milestone', id: string, title: string) => {
    const trimmed = title.trim()
    if (!trimmed) return
    mutateDocument((doc) => {
      if (kind === 'workProduct') return renameWorkProductAsset(doc, id, trimmed)
      if (kind === 'guidance') return renameGuidanceAsset(doc, id, trimmed)
      return renameMilestoneAsset(doc, id, trimmed)
    })
  }, [mutateDocument])

  const deleteProcessAsset = useCallback((kind: 'workProduct' | 'guidance' | 'milestone', id: string) => {
    mutateDocument((doc) => {
      if (kind === 'workProduct') return deleteWorkProductAsset(doc, id)
      if (kind === 'guidance') return deleteGuidanceAsset(doc, id)
      return deleteMilestoneAsset(doc, id)
    })
    setSelectedAsset((current) => current?.kind === kind && current.id === id ? null : current)
  }, [mutateDocument])

  const selectProcessAsset = useCallback((kind: 'workProduct' | 'guidance' | 'milestone', id: string) => {
    setSelectedAsset({ kind, id })
    const assetDoc = history.present
    let target: { type: 'node' | 'edge'; id: string } | null
    if (kind === 'workProduct') {
      const asset = assetDoc.processAssets.workProducts[id]
      const nodeId = asset?.producerNodeIds[0] ?? asset?.consumerNodeIds[0]
      const edgeId = asset?.handoffEdgeIds[0]
      target = nodeId ? { type: 'node', id: nodeId } : edgeId ? { type: 'edge', id: edgeId } : null
    } else if (kind === 'guidance') {
      const asset = assetDoc.processAssets.guidanceItems[id]
      const nodeId = asset?.appliesToNodeIds[0]
      const edgeId = asset?.appliesToEdgeIds[0]
      target = nodeId ? { type: 'node', id: nodeId } : edgeId ? { type: 'edge', id: edgeId } : null
    } else {
      const asset = assetDoc.processAssets.milestones[id]
      target = asset?.stageNodeId ? { type: 'node', id: asset.stageNodeId } : null
    }

    if (!target) return
    if (target.type === 'node') {
      applyCommand({ type: 'SelectNode', payload: { id: target.id, additive: false } })
      setEditorNodeId(null)
      setEditorEdgeId(null)
    } else {
      applyCommand({ type: 'SelectEdge', payload: { id: target.id, additive: false } })
      setEditorEdgeId(null)
      setEditorNodeId(null)
    }
  }, [applyCommand, history.present])

  const selectProcessObjectTarget = useCallback((targetType: 'node' | 'edge', targetId: string) => {
    if (targetType === 'node') {
      applyCommand({ type: 'SelectNode', payload: { id: targetId, additive: false } })
      setEditorNodeId(null)
      setEditorEdgeId(null)
    } else {
      applyCommand({ type: 'SelectEdge', payload: { id: targetId, additive: false } })
      setEditorEdgeId(null)
      setEditorNodeId(null)
    }
  }, [applyCommand])

  const selectDiagnosticTarget = useCallback((targetType: 'node' | 'edge' | 'asset', targetId: string) => {
    if (targetType === 'node') {
      applyCommand({ type: 'SelectNode', payload: { id: targetId, additive: false } })
      setEditorNodeId(targetId)
      setEditorEdgeId(null)
    } else if (targetType === 'edge') {
      applyCommand({ type: 'SelectEdge', payload: { id: targetId, additive: false } })
      setEditorEdgeId(targetId)
      setEditorNodeId(null)
    } else if (document.processAssets.workProducts[targetId]) {
      selectProcessAsset('workProduct', targetId)
    } else if (document.processAssets.guidanceItems[targetId]) {
      selectProcessAsset('guidance', targetId)
    } else if (document.processAssets.milestones[targetId]) {
      selectProcessAsset('milestone', targetId)
    }
  }, [applyCommand, document.processAssets, selectProcessAsset])

  // Activate the current map as the agreed process. We don't push this
  // through applyCommand because activation is a cross-cutting concern
  // (not a graph edit). The snapshot is persisted by the LibraryGate
  // via the saveMapActivation callback.
  const activateMap = useCallback(() => {
    const previous = activationSnapshot
    const next = buildActivationSnapshot(document, previous ?? {
      status: 'unactivated',
      activatedAt: null,
      lastEditedAt: null,
      baselineDiagnosticCount: null,
    })
    setActivationSnapshot(next)
  }, [document, activationSnapshot])

  return {
    nodes,
    edges,
    document,
    processAssets: document.processAssets,
    selectedNode,
    selectedAsset,
    selectedNodeIds,
    selectedEdgeIds,
    selectedEdge,
    editorNode,
    editorEdge,
    diagnostics,
    selectDiagnosticTarget,
    activation,
    activationEligible,
    activateMap,
    bottleneckMetrics,
    processIntelligence,
    marquee,
    connectorMode,
    connectionStart,
    startMarquee: useCallback((x: number, y: number) => setMarquee({ x1: x, y1: y, x2: x, y2: y }), []),
    updateMarquee: useCallback((x: number, y: number) => setMarquee((c) => c ? { ...c, x2: x, y2: y } : null), []),
    endMarquee: useCallback(() => setMarquee(null), []),
    selectNodesInRect,
    toggleConnectorMode,
    startConnection,
    cancelConnection,
    endConnection,
    onNodesChange,
    onEdgesChange,
    onConnect,
    onNodeClick,
    onEdgeClick,
    onPaneClick,
    openEditor,
    openEdgeEditor,
    closeEditor,
    addActivity,
    addDecision,
    addEnd,
    addNodeByType,
    insertSharedProcess,
    syncSharedProcesses,
    removeSharedProcessInstance,
    addStage,
    addBottleneck,
    quickCreate,
    createConnectedNodeFromPort,
    focus,
    setFocus,
    focusView,
    roles,
    removeSelected,
    updateNodeData,
    updateEdgeData,
    assetActions: {
      addResponsibility: addActivityResponsibility,
      removeResponsibility: removeActivityResponsibility,
      createWorkProductForActivity,
      linkWorkProductToActivity: linkExistingWorkProductToActivity,
      unlinkWorkProductFromActivity: unlinkExistingWorkProductFromActivity,
      createGuidanceForActivity,
      linkGuidanceToActivity: linkExistingGuidanceToActivity,
      unlinkGuidanceFromActivity: unlinkExistingGuidanceFromActivity,
      createMilestoneForStage,
      addMilestoneWorkProductState,
      createWorkProductForHandoff,
      linkWorkProductToHandoff: linkExistingWorkProductToHandoff,
      unlinkWorkProductFromHandoff: unlinkExistingWorkProductFromHandoff,
      linkGuidanceToWorkProduct: linkExistingGuidanceToWorkProduct,
      removeMilestoneWorkProductState: removeExistingMilestoneWorkProductState,
      createAsset: createProcessAsset,
      updateAsset: updateProcessAsset,
      linkAsset: linkProcessAsset,
      unlinkAsset: unlinkProcessAsset,
      renameAsset: renameProcessAsset,
      deleteAsset: deleteProcessAsset,
      selectAsset: selectProcessAsset,
      selectObjectTarget: selectProcessObjectTarget,
    },
    moveSelectedNodes,
    beginNodeDrag,
    completeNodeDrag,
    undo: undoAction,
    redo: redoAction,
    autoLayout,
    applyFlowLayout,
    applySwimlaneLayout,
    zoomIn,
    zoomOut,
    zoomReset,
    zoomToPercent,
    zoomAt,
    panBy,
    replaceDocument,
    viewport: document.viewport,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
  }
}

function isProcessStageData(value: unknown): value is ProcessStageData {
  if (!value || typeof value !== 'object') return false
  const stage = value as ProcessStageData
  if (!['value-add', 'wait', 'rework'].includes(stage.kind)) return false
  if (!['explicit', 'inferred'].includes(stage.classificationSource)) return false
  return [stage.durationMinutesP50, stage.durationMinutesP90]
    .every((duration) => duration == null || (Number.isFinite(duration) && duration > 0))
}
