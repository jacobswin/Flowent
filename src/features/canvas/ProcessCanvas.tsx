import { useCallback, useEffect, useRef, useState } from 'react'
import type { DragEvent } from 'react'
import { CanvasChrome } from './CanvasChrome'
import type { ConnectionCreateRequest } from './canvasTypes'
import { useCanvasState } from './useCanvasState'
import { useCanvasGraphModel } from './useCanvasGraphModel'
import { useEdgeLabelEditor } from './useEdgeLabelEditor'
import { useCanvasStageLifecycle } from './useCanvasStageLifecycle'
import { mapKeyToAction } from './engine/keyboard'
import { hasDraggedProcessElement, readDraggedProcessElement } from './processElementDrag'
import { exportProcessMapAsSvg, downloadBlob } from './export/processMapExporter'
import type { ProcessElementType } from './processElements'
import { buildQuickConnectorCreateRequest } from './routing/quickConnector'

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

export function ProcessCanvas(props: { mapId?: string; initialDocument?: import('./canvasTypes').GraphDocument; onAutosave?: (doc: import('./canvasTypes').GraphDocument) => void } = {}) {
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

  const handlePickConnectionNodeType = useCallback((type: ProcessElementType) => {
    if (!connectionCreateMenu) return
    canvas.createConnectedNodeFromPort(
      connectionCreateMenu.sourceNodeId,
      connectionCreateMenu.sourcePortId,
      type,
      connectionCreateMenu.worldPosition,
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

      if (
        (event.key === 'Delete' || event.key === 'Backspace') &&
        (canvas.selectedNodeIds.size > 0 || canvas.selectedEdgeIds.size > 0)
      ) {
        event.preventDefault()
        setConnectionCreateMenu(null)
        setEdgeContextMenu(null)
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
          canvas.autoLayout()
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
    [canvas, openConnectionCreateMenu],
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
    openConnectionCreateMenuRef,
    openEdgeContextMenuRef,
  })

  const handleExport = useCallback(() => {
    // Export the current canvas document. The exporter walks the
    // Pixi-independent GraphDocument and returns a self-contained
    // SVG. The download is browser-only.
    const svg = exportProcessMapAsSvg(canvas.document)
    if (typeof document === 'undefined') return
    const filename = `flowent-process-map-${Date.now()}.svg`
    downloadBlob(new Blob([svg], { type: 'image/svg+xml' }), filename)
  }, [canvas.document])

  const selectionCount = canvas.selectedNodeIds.size + canvas.selectedEdgeIds.size
  const hasSelection = selectionCount > 0

  return (
    <CanvasChrome
      hostRef={hostRef}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onQuickCreate={canvas.quickCreate}
      toolbar={{
        onRemove: canvas.removeSelected,
        onAutoLayout: () => canvas.autoLayout(),
        onUndo: canvas.undo,
        onRedo: canvas.redo,
        onExport: handleExport,
        onZoomIn: canvas.zoomIn,
        onZoomOut: canvas.zoomOut,
        onZoomReset: canvas.zoomReset,
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
        onConnect: canvas.onConnect,
        onOpenConnectionCreateMenu: openConnectionCreateMenu,
        onOpenEdgeContextMenu: handleOpenEdgeContextMenu,
        onCloseEdgeContextMenu: handleCloseEdgeContextMenu,
        onUpdateEdgeColor: handleUpdateEdgeColor,
        onEdgeClick: canvas.onEdgeClick,
        onNodeClick: canvas.onNodeClick,
        openEditor: canvas.openEditor,
        openEdgeEditor: canvas.openEdgeEditor,
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
        onActivate: canvas.activateMap,
      }}
      processAssets={{
        document: canvas.document,
        selectedAsset: canvas.selectedAsset,
        onSelectAsset: canvas.assetActions.selectAsset,
        onCreateAsset: canvas.assetActions.createAsset,
        onRenameAsset: canvas.assetActions.renameAsset,
        onDeleteAsset: canvas.assetActions.deleteAsset,
        onUpdateAsset: canvas.assetActions.updateAsset,
        onLinkAsset: canvas.assetActions.linkAsset,
        onUnlinkAsset: canvas.assetActions.unlinkAsset,
        onSelectObjectTarget: canvas.assetActions.selectObjectTarget,
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
        assetActions: canvas.assetActions,
        onUpdateNode: canvas.updateNodeData,
        onUpdateEdge: canvas.updateEdgeData,
        onDeleteEdge: canvas.removeSelected,
        onClose: () => canvas.closeEditor(),
      }}
    />
  )
}
