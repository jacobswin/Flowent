import { useCallback, useEffect, useRef, useState } from 'react'
import type { DragEvent } from 'react'
import { CanvasChrome } from './CanvasChrome'
import type { ConnectionCreateRequest, EdgeEndpointAnchor } from './canvasTypes'
import { useCanvasState } from './useCanvasState'
import { useCanvasGraphModel } from './useCanvasGraphModel'
import { useEdgeLabelEditor } from './useEdgeLabelEditor'
import { useCanvasStageLifecycle } from './useCanvasStageLifecycle'
import { mapKeyToAction } from './engine/keyboard'
import { hasDraggedProcessElement, readDraggedProcessElement } from './processElementDrag'
import { downloadBlob, type ProcessMapExportFormat } from './export/processMapExporter'
import { createBrowserExport } from './export/browserProcessMapExporter'
import type { ProcessElementType } from './processElements'
import { buildQuickConnectorCreateRequest } from './routing/quickConnector'
import { AIGenerateModal } from '../ai/AIGenerateModal'
import type { AiGeneratedMapDraft } from '../ai/aiTypes'
import { deserializeGraphDocument } from './engine/graphSerialization'
import type { GraphDocument } from './canvasTypes'
import type { SharedActivity, SharedElementLibrary, SharedProcess, SharedRole, SharedWorkProduct } from './sharedElements'
import { createEmptyDocument } from './engine/graphDocument'
import { insertSharedProcessInstance } from './sharedProcessProjection'
import { getWorkProductActivityLinks } from './processAssets'

type EdgeContextMenuRequest = {
  edgeId: string
  screenPosition: { x: number; y: number }
}

function isEditingText(event: KeyboardEvent): boolean {
  const target = event.target
  if (!(target instanceof Element)) return false

  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) {
    return true
  }

  if (target.closest('[contenteditable="true"], [role="textbox"]')) {
    return true
  }

  return false
}

export function ProcessCanvas(props: {
  mapId?: string
  mapName?: string
  initialDocument?: GraphDocument
  onAutosave?: (doc: GraphDocument) => void
  onCreateMapFromDocument?: (name: string, doc: GraphDocument) => Promise<void>
  sharedRoles?: SharedRole[]
  onEnsureSharedRoles?: (roleNames: string[]) => Promise<Record<string, string>>
  elementLibrary?: SharedElementLibrary
  pendingSharedProcessId?: string | null
  onSharedProcessInserted?: () => void
  pendingRemoveSharedProcessInstanceId?: string | null
  onSharedProcessRemoved?: () => void
  onProcessInstancesChange?: (instances: GraphDocument['processInstances']) => void
  onUpdateSharedActivity?: (activityId: string, patch: Record<string, unknown>) => Promise<void>
  onCreateSharedWorkProduct?: (draft: { title: string; state?: string; description?: string }) => Promise<void>
  onUpdateSharedWorkProduct?: (workProductId: string, patch: Record<string, unknown>) => Promise<void>
  onCreateSharedElement?: (kind: 'process' | 'activity' | 'workProduct', draft: Record<string, unknown>) => Promise<Record<string, unknown>>
} = {}) {
  if (props.mapId || props.initialDocument || props.onAutosave) {
    // ProcessCanvas itself doesn't use the props yet — they're accepted here
    // so LibraryGate can pass them through without a type error. The plan
    // flags full LibraryGate integration as out of scope for the foundation.
  }
  // Use the prop-derived onAutosave (if any) so the canvas state
  // can flush its debounced save back up to the LibraryGate. The
  // canvas state hook fires the callback 500ms after the last edit;
  // LibraryGate uses it to PATCH the document to the server. If
  // this prop is omitted (e.g. for ad-hoc canvases that don't
  // round-trip through the library), the canvas simply runs
  // without autosave — there's no warning because not every
  // canvas consumer wants persistence.
  const canvas = useCanvasState({ initialDocument: props.initialDocument, onAutosave: props.onAutosave })
  const hostRef = useRef<HTMLDivElement | null>(null)
  // Keep a ref pointing to the latest canvas state so async-init closures
  // (Pixi stage, test hooks) can read fresh data, not the snapshot
  // captured when the async stage init first resolved. The .current
  // is updated in a useEffect (not during render) to satisfy React 19
  // strict refs rules; the listener ref reads on the next tick are
  // always one render behind, which is fine because the listeners
  // themselves don't depend on same-tick canvas writes.
  const canvasRef = useRef(canvas)
  useEffect(() => {
    canvasRef.current = canvas
  }, [canvas])

  // Shared Process instances are runtime projections. Refresh the active map
  // whenever the library changes so an Activity/Role/Process edit is visible
  // immediately without manually re-inserting the Process.
  useEffect(() => {
    if (!props.elementLibrary) return
    canvas.syncSharedProcesses(props.elementLibrary)
    // Library changes are intentionally the trigger. Canvas state changing
    // after the sync must not recursively schedule another projection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.elementLibrary])

  useEffect(() => {
    if (!props.pendingSharedProcessId || !props.elementLibrary) return
    const process = props.elementLibrary.processes[props.pendingSharedProcessId]
    if (!process) {
      props.onSharedProcessInserted?.()
      return
    }
    canvas.insertSharedProcess(process, props.elementLibrary)
    props.onSharedProcessInserted?.()
    // Consuming a pending insert is one-shot. The callback clears the id in
    // the parent, and `canvas` itself changes after insertion.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.pendingSharedProcessId, props.elementLibrary])

  useEffect(() => {
    if (!props.pendingRemoveSharedProcessInstanceId) return
    canvas.removeSharedProcessInstance(props.pendingRemoveSharedProcessInstanceId)
    props.onSharedProcessRemoved?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.pendingRemoveSharedProcessInstanceId])

  useEffect(() => {
    props.onProcessInstancesChange?.(canvas.document.processInstances)
  }, [canvas.document.processInstances, props])


  // On-canvas inline label editor. The editor opens when the user
  // double-taps a label and closes on commit/cancel. The input is keyed
  // by `openEdgeId` so it remounts each time, picking up the current
  // label as its initial value without an effect-driven setState.
  const labelEditor = useEdgeLabelEditor(
    useCallback((edgeId: string, value: string) => {
      canvas.updateEdgeData(edgeId, { label: value })
    }, [canvas]),
  )
  // Keep a stable ref to the latest label editor so the Pixi stage
  // (which mounts once) can call `openAt` on the current instance
  // without re-running its mount effect. Synced via useEffect to
  // satisfy React 19's strict refs-during-render rules.
  const labelEditorRef = useRef(labelEditor)
  useEffect(() => {
    labelEditorRef.current = labelEditor
  }, [labelEditor])
  // The label editor positions itself relative to the .pixi-host's
  // bounding rect. We read that rect in an effect (not during render)
  // and cache the values so the inline IIFE below can read them safely.
  // We also keep the cache fresh on resize / scroll so a window
  // resize or layout shift doesn't strand the editor in the wrong
  // spot while it's open.
  const [hostOrigin, setHostOrigin] = useState<{ left: number; top: number }>({ left: 0, top: 0 })
  const [connectionCreateMenu, setConnectionCreateMenu] = useState<ConnectionCreateRequest | null>(null)
  const [edgeContextMenu, setEdgeContextMenu] = useState<EdgeContextMenuRequest | null>(null)
  const [aiGenerateOpen, setAiGenerateOpen] = useState(false)
  const openConnectionCreateMenu = useCallback((request: ConnectionCreateRequest) => {
    setEdgeContextMenu(null)
    setConnectionCreateMenu(request)
  }, [])
  const openConnectionCreateMenuRef = useRef(openConnectionCreateMenu)
  useEffect(() => {
    openConnectionCreateMenuRef.current = openConnectionCreateMenu
  }, [openConnectionCreateMenu])

  const openEdgeContextMenu = useCallback((edgeId: string, point: { screenX: number; screenY: number }) => {
    canvas.onEdgeClick(edgeId, false)
    setConnectionCreateMenu(null)
    setEdgeContextMenu({
      edgeId,
      screenPosition: { x: point.screenX, y: point.screenY },
    })
  }, [canvas])
  const openEdgeContextMenuRef = useRef(openEdgeContextMenu)
  useEffect(() => {
    openEdgeContextMenuRef.current = openEdgeContextMenu
  }, [openEdgeContextMenu])

  const handleOpenEdgeContextMenu = useCallback((edgeId: string, screenPosition: { x: number; y: number }) => {
    openEdgeContextMenu(edgeId, { screenX: screenPosition.x, screenY: screenPosition.y })
  }, [openEdgeContextMenu])

  const handleCloseEdgeContextMenu = useCallback(() => {
    setEdgeContextMenu(null)
  }, [])

  const handleUpdateEdgeColor = useCallback((edgeId: string, color: string) => {
    canvas.updateEdgeData(edgeId, { color })
  }, [canvas])

  const closeTransientMenus = useCallback(() => {
    if (!connectionCreateMenu && !edgeContextMenu) return
    setConnectionCreateMenu(null)
    setEdgeContextMenu(null)
  }, [connectionCreateMenu, edgeContextMenu])
  const closeTransientMenusRef = useRef(closeTransientMenus)
  useEffect(() => {
    closeTransientMenusRef.current = closeTransientMenus
  }, [closeTransientMenus])

  const handleOpenEditor = useCallback((nodeId: string) => {
    closeTransientMenus()
    canvas.openEditor(nodeId)
  }, [canvas, closeTransientMenus])

  const handleOpenEdgeEditor = useCallback((edgeId: string) => {
    closeTransientMenus()
    canvas.openEdgeEditor(edgeId)
  }, [canvas, closeTransientMenus])

  const handleNodeClick = useCallback((nodeId: string, additive: boolean) => {
    closeTransientMenus()
    canvas.onNodeClick(nodeId, additive)
  }, [canvas, closeTransientMenus])

  const handleUpdateNode = useCallback((nodeId: string, data: Record<string, unknown>) => {
    const node = canvas.document.nodes.get(nodeId)
    if (node?.sharedActivityId && props.onUpdateSharedActivity) {
      const patch: Record<string, unknown> = {}
      for (const key of ['title', 'summary', 'expectations', 'responsibilities']) {
        if (key in data) patch[key] = data[key]
      }
      if (Array.isArray(patch.responsibilities) && patch.responsibilities.some((item) =>
        !item || typeof item !== 'object' || !('roleId' in item) || !item.roleId,
      )) {
        // RasicEditor immediately reflects free-form typing, then resolves
        // names to shared Role ids asynchronously. Only persist the second,
        // resolved update so the shared Activity never stores string-only
        // responsibilities.
        return
      }
      if (Object.keys(patch).length > 0) {
        void props.onUpdateSharedActivity(node.sharedActivityId, patch)
        return
      }
    }
    canvas.updateNodeData(nodeId, data)
  }, [canvas, props])

  const processAssetActions = {
    ...canvas.assetActions,
    createAsset: (kind: 'workProduct' | 'guidance' | 'milestone', data: { title: string; kind?: import('./canvasTypes').GuidanceKind }) => {
      if (kind === 'workProduct' && props.onCreateSharedWorkProduct) {
        void props.onCreateSharedWorkProduct({ title: data.title })
        return
      }
      canvas.assetActions.createAsset(kind, data)
    },
    updateAsset: (kind: 'workProduct' | 'guidance' | 'milestone', id: string, patch: Record<string, unknown>) => {
      const asset = kind === 'workProduct' ? canvas.document.processAssets.workProducts[id] : null
      if (asset?.sharedWorkProductId && props.onUpdateSharedWorkProduct) {
        void props.onUpdateSharedWorkProduct(asset.sharedWorkProductId, patch)
        return
      }
      canvas.assetActions.updateAsset(kind, id, patch)
    },
    renameAsset: (kind: 'workProduct' | 'guidance' | 'milestone', id: string, title: string) => {
      const asset = kind === 'workProduct' ? canvas.document.processAssets.workProducts[id] : null
      if (asset?.sharedWorkProductId && props.onUpdateSharedWorkProduct) {
        void props.onUpdateSharedWorkProduct(asset.sharedWorkProductId, { title })
        return
      }
      canvas.assetActions.renameAsset(kind, id, title)
    },
  }

  const handleEdgeClick = useCallback((edgeId: string, additive: boolean) => {
    closeTransientMenus()
    canvas.onEdgeClick(edgeId, additive)
  }, [canvas, closeTransientMenus])

  const handleConnect = useCallback((
    sourceNodeId: string,
    targetNodeId: string,
    sourcePortId?: string,
    targetPortId?: string,
    anchors?: { sourceAnchor?: EdgeEndpointAnchor; targetAnchor?: EdgeEndpointAnchor },
  ) => {
    closeTransientMenus()
    canvas.onConnect(sourceNodeId, targetNodeId, sourcePortId, targetPortId, anchors)
  }, [canvas, closeTransientMenus])

  const handleQuickCreate = useCallback((type: ProcessElementType) => {
    closeTransientMenus()
    canvas.quickCreate(type)
  }, [canvas, closeTransientMenus])

  const handlePickConnectionNodeType = useCallback((type: ProcessElementType) => {
    if (!connectionCreateMenu) return
    canvas.createConnectedNodeFromPort(
      connectionCreateMenu.sourceNodeId,
      connectionCreateMenu.sourcePortId,
      type,
      connectionCreateMenu.worldPosition,
      connectionCreateMenu.sourceAnchor,
    )
    setConnectionCreateMenu(null)
  }, [canvas, connectionCreateMenu])

  const handleCancelConnectionCreate = useCallback(() => {
    setConnectionCreateMenu(null)
    canvas.cancelConnection()
  }, [canvas])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const host = hostRef.current
    if (!host) return
    const sync = () => {
      const rect = host.getBoundingClientRect()
      setHostOrigin({ left: rect.left, top: rect.top })
    }
    sync()
    const ResizeObserverCtor = typeof ResizeObserver !== 'undefined' ? ResizeObserver : null
    const observer = ResizeObserverCtor ? new ResizeObserverCtor(sync) : null
    if (observer) observer.observe(host)
    window.addEventListener('scroll', sync, { passive: true })
    window.addEventListener('resize', sync, { passive: true })
    return () => {
      observer?.disconnect()
      window.removeEventListener('scroll', sync)
      window.removeEventListener('resize', sync)
    }
  }, [])


  const handleDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    if (hasDraggedProcessElement(event.dataTransfer)) {
      event.preventDefault()
      event.dataTransfer.dropEffect = 'copy'
    }
  }, [])

  const handleDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      const type = readDraggedProcessElement(event.dataTransfer)
      if (!type) return

      event.preventDefault()
      const rect = event.currentTarget.getBoundingClientRect()
      const screenX = event.clientX - rect.left
      const screenY = event.clientY - rect.top
      const worldX = (screenX - canvas.viewport.x) / canvas.viewport.zoom
      const worldY = (screenY - canvas.viewport.y) / canvas.viewport.zoom
      canvas.addNodeByType(type, { x: worldX, y: worldY })
    },
    [canvas],
  )

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.defaultPrevented || isEditingText(event)) return

      if (event.key === 'Escape' && (connectionCreateMenu || edgeContextMenu)) {
        event.preventDefault()
        closeTransientMenus()
        canvas.cancelConnection()
        return
      }

      if (
        (event.key === 'Delete' || event.key === 'Backspace') &&
        (canvas.selectedNodeIds.size > 0 || canvas.selectedEdgeIds.size > 0)
      ) {
        event.preventDefault()
        closeTransientMenus()
        canvas.removeSelected()
        return
      }

      if (
        event.key === 'Tab' &&
        !event.shiftKey &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey
      ) {
        const selectedNodeIds = Array.from(canvas.document.selectedNodeIds)
        if (selectedNodeIds.length === 1) {
          const selectedNode = canvas.document.nodes.get(selectedNodeIds[0])
          const request = selectedNode
            ? buildQuickConnectorCreateRequest(selectedNode, canvas.viewport)
            : null
          if (request) {
            event.preventDefault()
            openConnectionCreateMenu(request)
            return
          }
        }
      }

      const action = mapKeyToAction({
        key: event.key,
        metaKey: event.metaKey,
        ctrlKey: event.ctrlKey,
        shiftKey: event.shiftKey,
      })

      if (!action) return

      event.preventDefault()

      switch (action) {
        case 'tool-activity':
          canvas.addActivity()
          break
        case 'tool-decision':
          canvas.addDecision()
          break
        case 'tool-start-end':
          canvas.addEnd()
          break
        case 'tool-connector':
          // Toggle connector mode indicator
          canvas.toggleConnectorMode()
          break
        case 'auto-layout':
          void canvas.applyFlowLayout()
          break
        case 'undo':
          canvas.undo()
          break
        case 'redo':
          canvas.redo()
          break
        case 'zoom-in':
          canvas.zoomIn()
          break
        case 'zoom-out':
          canvas.zoomOut()
          break
        case 'zoom-reset':
          canvas.zoomReset()
          break
      }
    },
    [canvas, closeTransientMenus, connectionCreateMenu, edgeContextMenu, openConnectionCreateMenu],
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  const { graphNodes, graphEdges, nodesById } = useCanvasGraphModel({
    nodes: canvas.nodes,
    edges: canvas.edges,
  })

  // Refs for derived graph data that the long-lived Pixi helpers read.
  // Keep the derivation in `useCanvasGraphModel`, but keep the imperative
  // ref-sync adapter local to this Pixi container so the exported hook API
  // stays purely declarative.
  const graphEdgesRef = useRef(graphEdges)
  const graphNodesRef = useRef(graphNodes)
  const nodesByIdRef = useRef(nodesById)
  useEffect(() => {
    graphEdgesRef.current = graphEdges
  }, [graphEdges])
  useEffect(() => {
    graphNodesRef.current = graphNodes
  }, [graphNodes])
  useEffect(() => {
    nodesByIdRef.current = nodesById
  }, [nodesById])

  // Mount the long-lived Pixi stage plus its sibling native/Pixi
  // helpers once. The lifecycle hook owns only the imperative stage
  // orchestration; this component keeps ownership of the latest canvas
  // state refs and the derived graph refs that the helpers read.
  useCanvasStageLifecycle({
    hostRef,
    canvasRef,
    graphNodesRef,
    graphEdgesRef,
    nodesByIdRef,
    labelEditorRef,
    closeTransientMenusRef,
    openConnectionCreateMenuRef,
    openEdgeContextMenuRef,
  })

  const handleExport = useCallback(async (format: ProcessMapExportFormat) => {
    const artifact = await createBrowserExport(canvas.document, format, {
      mapName: props.mapName,
      elementLibrary: props.elementLibrary,
    })
    downloadBlob(artifact.blob, artifact.filename)
  }, [canvas.document, props.elementLibrary, props.mapName])

  const handleCreateAiMap = useCallback(async (draft: AiGeneratedMapDraft) => {
    if (!props.onCreateMapFromDocument) return
    const source = deserializeGraphDocument(draft.document as unknown as Parameters<typeof deserializeGraphDocument>[0])
    const promoted = await promoteAiDraftToSharedProcess(draft, source, props)
    const doc = promoted
      ? insertSharedProcessInstance(createEmptyDocument(`ai-${Date.now()}`), promoted.process, `ai-instance-${Date.now()}`, { x: 260, y: 220 }, promoted.library)
      : source
    await props.onCreateMapFromDocument(draft.title, doc)
  }, [props])

  const handleReplaceWithAiMap = useCallback(async (draft: AiGeneratedMapDraft) => {
    const source = deserializeGraphDocument(draft.document as unknown as Parameters<typeof deserializeGraphDocument>[0])
    const promoted = await promoteAiDraftToSharedProcess(draft, source, props)
    const doc = promoted
      ? insertSharedProcessInstance(createEmptyDocument(props.mapId ?? source.id), promoted.process, `ai-instance-${Date.now()}`, { x: 260, y: 220 }, promoted.library)
      : source
    canvas.replaceDocument({
      ...doc,
      id: props.mapId ?? doc.id,
      meta: { ...doc.meta, dirty: true, version: doc.meta.version + 1 },
    })
  }, [canvas, props])

  const selectionCount = canvas.selectedNodeIds.size + canvas.selectedEdgeIds.size
  const hasSelection = selectionCount > 0

  return (
    <CanvasChrome
      hostRef={hostRef}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onCanvasPointerDown={closeTransientMenus}
      onQuickCreate={handleQuickCreate}
      toolbar={{
        onRemove: canvas.removeSelected,
        onApplyFlowLayout: () => void canvas.applyFlowLayout(),
        onApplySwimlaneLayout: canvas.applySwimlaneLayout,
        onUndo: canvas.undo,
        onRedo: canvas.redo,
        onExport: handleExport,
        onZoomIn: canvas.zoomIn,
        onZoomOut: canvas.zoomOut,
        onZoomReset: canvas.zoomReset,
        onZoomSet: canvas.zoomToPercent,
        onOpenAiGenerate: () => setAiGenerateOpen(true),
        canUndo: canvas.canUndo,
        canRedo: canvas.canRedo,
        hasSelection,
        zoomPercent: Math.round(canvas.viewport.zoom * 100),
      }}
      overlays={{
        hostOrigin,
        labelEditor,
        viewport: canvas.viewport,
        edges: canvas.edges,
        nodes: canvas.nodes,
        selectedNodeIds: canvas.selectedNodeIds,
        selectedEdge: canvas.selectedEdge,
        connectionCreateMenu,
        edgeContextMenu,
        onPickConnectionNodeType: handlePickConnectionNodeType,
        onCancelConnectionCreate: handleCancelConnectionCreate,
        onConnect: handleConnect,
        onOpenConnectionCreateMenu: openConnectionCreateMenu,
        onOpenEdgeContextMenu: handleOpenEdgeContextMenu,
        onCloseEdgeContextMenu: handleCloseEdgeContextMenu,
        onUpdateEdgeColor: handleUpdateEdgeColor,
        onEdgeClick: handleEdgeClick,
        onNodeClick: handleNodeClick,
        openEditor: handleOpenEditor,
        openEdgeEditor: handleOpenEdgeEditor,
        removeSelected: canvas.removeSelected,
        nodesById,
      }}
      focusBar={{
        focus: canvas.focus,
        roles: canvas.roles,
        onChange: canvas.setFocus,
      }}
      checklist={{
        diagnostics: canvas.diagnostics,
        onSelectDiagnostic: (diagnostic) => canvas.selectDiagnosticTarget(diagnostic.targetType, diagnostic.targetId),
      }}
      activationBar={{
        activation: canvas.activation,
        eligible: canvas.activationEligible.eligible,
        reasons: canvas.activationEligible.reasons,
        bottlenecks: canvas.bottleneckMetrics,
        processIntelligence: canvas.processIntelligence,
        onSelectProcessFinding: (finding) => {
          const nodeId = finding.nodeIds[0]
          if (nodeId) canvas.selectDiagnosticTarget('node', nodeId)
        },
        onActivate: canvas.activateMap,
      }}
      processAssets={{
        document: canvas.document,
        selectedAsset: canvas.selectedAsset,
        onSelectAsset: processAssetActions.selectAsset,
        onCreateAsset: processAssetActions.createAsset,
        onRenameAsset: processAssetActions.renameAsset,
        onDeleteAsset: processAssetActions.deleteAsset,
        onUpdateAsset: processAssetActions.updateAsset,
        onLinkAsset: processAssetActions.linkAsset,
        onUnlinkAsset: processAssetActions.unlinkAsset,
        onSelectObjectTarget: processAssetActions.selectObjectTarget,
      }}
      statusBar={{
        nodeCount: canvas.nodes.length,
        edgeCount: canvas.edges.length,
        zoomPercent: Math.round(canvas.viewport.zoom * 100),
        selectedNodeCount: selectionCount,
      }}
      propertiesPanel={{
        node: canvas.editorNode,
        edge: canvas.editorEdge,
        nodes: canvas.nodes,
        processAssets: canvas.processAssets,
        assetActions: processAssetActions,
        sharedRoles: props.sharedRoles,
        onEnsureSharedRoles: props.onEnsureSharedRoles,
        onUpdateNode: handleUpdateNode,
        onUpdateEdge: canvas.updateEdgeData,
        onDeleteEdge: canvas.removeSelected,
        onClose: () => canvas.closeEditor(),
      }}
    >
      <AIGenerateModal
        open={aiGenerateOpen}
        onClose={() => setAiGenerateOpen(false)}
        onCreateNewMap={handleCreateAiMap}
        onReplaceCurrentMap={handleReplaceWithAiMap}
      />
    </CanvasChrome>
  )
}

type SharedAiPromotionOptions = {
  elementLibrary?: SharedElementLibrary
  onEnsureSharedRoles?: (roleNames: string[]) => Promise<Record<string, string>>
  onCreateSharedElement?: (kind: 'process' | 'activity' | 'workProduct', draft: Record<string, unknown>) => Promise<Record<string, unknown>>
}

async function promoteAiDraftToSharedProcess(
  draft: AiGeneratedMapDraft,
  document: GraphDocument,
  options: SharedAiPromotionOptions,
): Promise<{ process: SharedProcess; library: SharedElementLibrary } | null> {
  if (!options.elementLibrary || !options.onEnsureSharedRoles || !options.onCreateSharedElement) return null
  const sourceActivities = Array.from(document.nodes.values()).filter((node) => node.type === 'activity')
  if (sourceActivities.length === 0) return null

  let library: SharedElementLibrary = {
    roles: { ...options.elementLibrary.roles },
    workProducts: { ...options.elementLibrary.workProducts },
    activities: { ...options.elementLibrary.activities },
    processes: { ...options.elementLibrary.processes },
  }
  const responsibilityNames = sourceActivities.flatMap((node) => [
    ...(node.responsibilities ?? []).map((item) => item.roleName),
    ...(node.responsibilities?.length ? [] : node.roleTags),
  ]).filter(Boolean)
  const roleIdsByName = await options.onEnsureSharedRoles(responsibilityNames)
  for (const roleName of responsibilityNames) {
    const id = roleIdsByName[roleName.trim().toLocaleLowerCase()]
    if (id && !library.roles[id]) library = { ...library, roles: { ...library.roles, [id]: { id, name: roleName.trim(), description: '' } } }
  }

  const sharedWorkProductIds = new Map<string, string>()
  for (const workProduct of Object.values(document.processAssets.workProducts)) {
    const key = workProduct.title.trim().toLocaleLowerCase()
    const existing = Object.values(library.workProducts).find((item) => item.title.trim().toLocaleLowerCase() === key)
    const shared = existing ?? await options.onCreateSharedElement('workProduct', {
      title: workProduct.title,
      state: workProduct.state,
      description: workProduct.description,
    }) as unknown as SharedWorkProduct
    library = { ...library, workProducts: { ...library.workProducts, [shared.id]: shared } }
    sharedWorkProductIds.set(workProduct.id, shared.id)
  }

  const placementByNodeId = new Map<string, string>()
  const createdActivities: SharedActivity[] = []
  for (const [index, node] of sourceActivities.entries()) {
    const sourceResponsibilities = node.responsibilities?.length
      ? node.responsibilities
      : node.roleTags.map((roleName, roleIndex) => ({ id: `ai-responsibility-${roleIndex}`, roleName, kind: roleIndex === 0 ? 'responsible' as const : 'supporting' as const }))
    const responsibilities = sourceResponsibilities.flatMap((responsibility, responsibilityIndex) => {
      const roleId = roleIdsByName[responsibility.roleName.trim().toLocaleLowerCase()]
      return roleId ? [{
        id: `ai-responsibility-${index}-${roleId}-${responsibilityIndex}`,
        roleId,
        kind: responsibility.kind,
      }] : []
    })
    const workProductLinks = Object.values(document.processAssets.workProducts).flatMap((asset) =>
      getWorkProductActivityLinks(asset)
        .filter((link) => link.nodeId === node.id)
        .flatMap((link) => {
          const workProductId = sharedWorkProductIds.get(asset.id)
          return workProductId ? [{
            id: `ai-work-product-${index}-${workProductId}-${link.relation}-${link.maturity}`,
            workProductId,
            relation: link.relation,
            maturity: link.maturity,
          }] : []
        }),
    )
    const key = node.title.trim().toLocaleLowerCase()
    const existing = Object.values(library.activities).find((activity) => activity.title.trim().toLocaleLowerCase() === key)
    const activity = existing ?? await options.onCreateSharedElement('activity', {
      title: node.title,
      summary: node.summary ?? '',
      expectations: node.expectations ?? '',
      responsibilities,
      workProductLinks,
    }) as unknown as SharedActivity
    library = { ...library, activities: { ...library.activities, [activity.id]: activity } }
    createdActivities.push(activity)
    placementByNodeId.set(node.id, `ai-placement-${index + 1}`)
  }

  const process = await options.onCreateSharedElement('process', {
    title: draft.title || 'AI generated process',
    description: draft.summary || '',
    activities: createdActivities.map((activity, index) => ({
      id: `ai-placement-${index + 1}`,
      activityId: activity.id,
      x: index * 280,
      y: 80,
    })),
    handoffs: Array.from(document.edges.values()).flatMap((edge, index) => {
      const sourcePlacementId = placementByNodeId.get(edge.sourceNodeId)
      const targetPlacementId = placementByNodeId.get(edge.targetNodeId)
      return sourcePlacementId && targetPlacementId ? [{
        id: `ai-handoff-${index + 1}`,
        sourcePlacementId,
        targetPlacementId,
        label: edge.label,
        color: edge.color,
      }] : []
    }),
  }) as unknown as SharedProcess

  library = { ...library, processes: { ...library.processes, [process.id]: process } }
  return { process, library }
}
