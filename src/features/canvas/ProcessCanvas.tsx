import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { DragEvent, KeyboardEvent as ReactKeyboardEvent } from 'react'
import type { FederatedPointerEvent } from 'pixi.js'
import { Container, Graphics } from 'pixi.js'
import type { ProcessNode } from './canvasTypes'
import { Toolbar } from './Toolbar'
import { PropertiesPanel } from './PropertiesPanel'
import { useCanvasState } from './useCanvasState'
import { useEdgeLabelEditor } from './useEdgeLabelEditor'
import { createPixiStage } from './render/pixiStage'
import { createCanvasLayers, drawGrid } from './render/layers'
import { drawNodes } from './render/drawNodes'
import { drawEdges } from './render/drawEdges'
import { findNearestTargetPort, getPortAnchor } from './routing/ports'
import { routeOrthogonalEdge } from './routing/orthogonalRouter'
import { mapKeyToAction } from './engine/keyboard'
import { hasDraggedProcessElement, readDraggedProcessElement, ProcessElementPalette } from './ProcessElementPalette'
import { FocusBar } from './FocusBar'
import { AlignmentChecklist } from './AlignmentChecklist'
import { ActivationBar } from './ActivationBar'
import { exportProcessMapAsSvg, downloadBlob } from './export/processMapExporter'

export function ProcessCanvas(props: { mapId?: string; initialDocument?: import('./canvasTypes').GraphDocument; onAutosave?: (doc: import('./canvasTypes').GraphDocument) => void } = {}) {
  if (props.mapId || props.initialDocument || props.onAutosave) {
    // ProcessCanvas itself doesn't use the props yet — they're accepted here
    // so LibraryGate can pass them through without a type error. The plan
    // flags full LibraryGate integration as out of scope for the foundation.
  }
  const canvas = useCanvasState()
  const hostRef = useRef<HTMLDivElement | null>(null)
  // Keep a ref pointing to the latest canvas state so async-init closures
  // (Pixi stage, test hooks) can read fresh data, not the snapshot
  // captured when the async stage init first resolved. The sync runs
  // during render so that any closure reading the ref at a later point
  // in the same render cycle sees the new value.
  /* eslint-disable react-hooks/refs */
  const canvasRef = useRef(canvas)
  canvasRef.current = canvas
  /* eslint-enable react-hooks/refs */


  // On-canvas inline label editor. The editor opens when the user
  // double-taps a label and closes on commit/cancel. The input is keyed
  // by `openEdgeId` so it remounts each time, picking up the current
  // label as its initial value without an effect-driven setState.
  const labelEditor = useEdgeLabelEditor(
    useCallback((edgeId: string, value: string) => {
      canvas.updateEdgeData(edgeId, { label: value })
    }, [canvas]),
  )
  const labelInputRef = useRef<HTMLInputElement | null>(null)
  // The label editor positions itself relative to the .pixi-host's
  // bounding rect. We read that rect in an effect (not during render)
  // and cache the values so the inline IIFE below can read them safely.
  // We also keep the cache fresh on resize / scroll so a window
  // resize or layout shift doesn't strand the editor in the wrong
  // spot while it's open.
  const [hostOrigin, setHostOrigin] = useState<{ left: number; top: number }>({ left: 0, top: 0 })
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
        case 'delete':
          canvas.removeSelected()
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
    [canvas],
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  const graphNodes = useMemo(
    () => canvas.nodes.map(toGraphNode),
    [canvas.nodes],
  )

  const graphEdges = useMemo(
    () =>
      canvas.edges
        .filter((e) => e.source && e.target)
        .map((e) => ({
          id: e.id,
          sourceNodeId: e.source,
          sourcePortId: e.sourceHandle ?? 'out',
          targetNodeId: e.target,
          targetPortId: e.targetHandle ?? 'in',
          label: e.data?.label ?? '',
        })),
    [canvas.edges],
  )

  const nodesById = useMemo(() => {
    const map = new Map<string, ReturnType<typeof toGraphNode>>()
    for (const node of graphNodes) {
      map.set(node.id, node)
    }
    return map
  }, [graphNodes])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    let disposed = false
    let destroy: (() => void) | null = null

    // Refs to derived data that the Pixi stage + native pointer
    // handlers read. We use refs (not closure captures) because the
    // stage must outlive React re-renders. Without refs the effect
    // would have to re-run on every state change — destroying the
    // stage and recreating all listeners — which would race with
    // in-flight pointer interactions and lose marquee state. The
    // sync `current =` lines run during the effect setup so the
    // refs are populated before any closure reads them.
    const graphEdgesRef = { current: graphEdges }
    graphEdgesRef.current = graphEdges
    const graphNodesRef = { current: graphNodes }
    graphNodesRef.current = graphNodes
    const nodesByIdRef = { current: nodesById }
    nodesByIdRef.current = nodesById
    const labelEditorRef = { current: labelEditor }
    labelEditorRef.current = labelEditor

    // Inside the effect we use `canvas = canvasRef.current` at every
    // call site so listeners and the redraw ticker see the latest
    // canvas state on every frame. Without this, the closure would
    // capture the canvas from when the effect first ran and stale
    // reads would lag the UI. (The stage + listeners are intentionally
    // created once on mount and never re-created; see the empty deps
    // at the bottom of this effect.)
    const getCanvas = () => canvasRef.current

    const run = async () => {
      const stage = await createPixiStage(host)
      if (disposed) {
        stage.destroy()
        return
      }
      const pixiCanvasEl: HTMLCanvasElement = stage.app.canvas
      // Expose the canvas DOM node for tests and debug tooling. Tests
      // that need to assert screen-vs-canvas coordinates can read
      // size + parent off this hook without a Pixi app reference.
      ;(window as unknown as { __flowentPixiCanvasEl?: unknown }).__flowentPixiCanvasEl = {
        tag: pixiCanvasEl.tagName,
        width: pixiCanvasEl.width,
        height: pixiCanvasEl.height,
        parentTag: pixiCanvasEl.parentElement?.tagName ?? 'null',
      }

      destroy = stage.destroy

      const layers = createCanvasLayers(stage.root)
      let lastClickTime = 0
      let lastClickNodeId: string | null = null
      // The Pixi-side `isMarqueeDragging` (declared later for the
      // hitArea) and the native-side marquee state are kept
      // independent so the two paths don't race. The Pixi block
      // only handles visual cursor feedback and panning; the actual
      // marquee selection is owned by the native DOM listeners
      // below, which keep their own start coordinates on
      // `marqueeState` so they survive redraws.

      // Marquee rectangle graphics
      const marqueeRect = new Graphics()
      marqueeRect.visible = false
      layers.overlayLayer.addChild(marqueeRect)

      // Handle marquee on canvas background
      const hitArea = new Graphics()
      hitArea.rect(0, 0, host.clientWidth, host.clientHeight)
      hitArea.fill({ color: 0x000000, alpha: 0.001 }) // Nearly invisible hit area
      hitArea.eventMode = 'static'
      hitArea.cursor = 'default'
      layers.overlayLayer.addChild(hitArea)

      // The marquee flow uses native DOM pointer listeners on the
      // canvas (rather than Pixi's federated events) so that headless
      // Playwright `page.mouse.*` and pointer-based tooling always
      // arm the marquee. The Pixi `hitArea.on('pointer*')` handlers
      // above are kept for visual (cursor) feedback and as a fallback
      // for touch.
      const screenToWorld = (screenX: number, screenY: number) => {
        const rect = pixiCanvasEl.getBoundingClientRect()
        const c = getCanvas()
        return {
          x: (screenX - rect.left - c.viewport.x) / c.viewport.zoom,
          y: (screenY - rect.top - c.viewport.y) / c.viewport.zoom,
        }
      }
      // The marquee-dragging flag is a single shared ref-like cell so
      // that the same value is visible to down, move, and up no
      // matter which closure incarnation the listeners live in
      // (React StrictMode re-runs can re-create closures between
      // the down and the move).
      const marqueeState: { dragging: boolean; startX: number; startY: number } = {
        dragging: false,
        startX: 0,
        startY: 0,
      }
      const onNativeMarqueeDown = (event: PointerEvent) => {
        if (event.button !== 0) return
        if (spaceDown) return
        // Don't arm if the pointerdown is on a node, edge hit pad,
        // port, or label hit pad — those have their own handlers.
        const target = event.target as HTMLElement | null
        if (target && target.tagName !== 'CANVAS') return
        event.preventDefault()
        const start = screenToWorld(event.clientX, event.clientY)
        marqueeState.dragging = true
        marqueeState.startX = start.x
        marqueeState.startY = start.y
        marqueeRect.visible = true
        getCanvas().onPaneClick()
      }
      const onNativeMarqueeMove = (event: PointerEvent) => {
        if (!marqueeState.dragging) return
        const end = screenToWorld(event.clientX, event.clientY)
        const x1 = Math.min(marqueeState.startX, end.x)
        const y1 = Math.min(marqueeState.startY, end.y)
        const x2 = Math.max(marqueeState.startX, end.x)
        const y2 = Math.max(marqueeState.startY, end.y)
        marqueeRect.clear()
        marqueeRect.rect(x1, y1, x2 - x1, y2 - y1)
        marqueeRect.fill({ color: 0x0071e3, alpha: 0.1 })
        marqueeRect.stroke({ color: 0x0071e3, alpha: 0.4, width: 1 })
      }
      const onNativeMarqueeUp = (event: PointerEvent) => {
        if (!marqueeState.dragging) return
        marqueeState.dragging = false
        marqueeRect.visible = false
        const end = screenToWorld(event.clientX, event.clientY)
        const x1 = Math.min(marqueeState.startX, end.x)
        const y1 = Math.min(marqueeState.startY, end.y)
        const x2 = Math.max(marqueeState.startX, end.x)
        const y2 = Math.max(marqueeState.startY, end.y)
        if (Math.abs(x2 - x1) < 5 && Math.abs(y2 - y1) < 5) return
        getCanvas().selectNodesInRect(x1, y1, x2, y2)
      }
      // Register the native marquee listeners on the host div, not the
      // canvas itself. Pixi v8 may capture pointer events on the canvas
      // and stop them from reaching the canvas, so we listen on the
      // host and rely on event bubbling.
      // ALSO register on the window as a fallback (capture phase) so
      // we always see pointermove / pointerup events from Playwright's
      // mouse, which sometimes fire to the document rather than the
      // element under the cursor.
      const onWindowPointerMove = (event: PointerEvent) => onNativeMarqueeMove(event as unknown as PointerEvent)
      const onWindowPointerUp = (event: PointerEvent) => onNativeMarqueeUp(event as unknown as PointerEvent)
      const onDocumentPointerMove = (event: PointerEvent) => onNativeMarqueeMove(event as unknown as PointerEvent)
      const onDocumentPointerUp = (event: PointerEvent) => onNativeMarqueeUp(event as unknown as PointerEvent)
      // Playwright's `page.mouse.move`/`up` may dispatch native
      // `mousemove`/`mouseup` events instead of `pointermove`/`pointerup`
      // in some Pixi v8 setups. Listen to both so we always see them.
      const onHostMouseMove = (event: MouseEvent) =>
        onNativeMarqueeMove({
          clientX: event.clientX,
          clientY: event.clientY,
          button: 0,
        } as unknown as PointerEvent)
      const onHostMouseUp = (event: MouseEvent) =>
        onNativeMarqueeUp({
          clientX: event.clientX,
          clientY: event.clientY,
          button: 0,
        } as unknown as PointerEvent)
      host.addEventListener('pointerdown', onNativeMarqueeDown)
      host.addEventListener('pointermove', onNativeMarqueeMove)
      host.addEventListener('pointerup', onNativeMarqueeUp)
      host.addEventListener('pointercancel', onNativeMarqueeUp)
      host.addEventListener('mousemove', onHostMouseMove)
      host.addEventListener('mouseup', onHostMouseUp)
      window.addEventListener('pointermove', onWindowPointerMove, true)
      window.addEventListener('pointerup', onWindowPointerUp, true)
      document.addEventListener('pointermove', onDocumentPointerMove, true)
      document.addEventListener('pointerup', onDocumentPointerUp, true)

      // Label hit pads sit on top of the canvas hit area so they can
      // receive pointer events. Added AFTER the hitArea so it wins
      // the z-order in overlayLayer (Pixi v8 checks children in
      // reverse-insertion order).
      const labelHitLayer = new Container()
      labelHitLayer.label = 'edge-label-hit-layer'
      layers.overlayLayer.addChild(labelHitLayer)

      let isPanning = false
      let panStartX = 0
      let panStartY = 0
      let spaceDown = false

      window.addEventListener('keydown', (e) => {
        if (e.code === 'Space' && !e.repeat) {
          spaceDown = true
          hitArea.cursor = 'grab'
        }
      })

      window.addEventListener('keyup', (e) => {
        if (e.code === 'Space') {
          spaceDown = false
          hitArea.cursor = 'default'
        }
      })

      hitArea.on('pointerdown', (event: FederatedPointerEvent) => {
        if (spaceDown) {
          isPanning = true
          panStartX = event.globalX
          panStartY = event.globalY
          hitArea.cursor = 'grabbing'
          return
        }

        // The Pixi-side `isMarqueeDragging` (below) is unused now;
        // the marquee flow is owned entirely by the native DOM
        // listeners on the host div. We keep the Pixi pointerdown
        // here only to set the cursor visual.
        hitArea.cursor = 'default'
      })

      hitArea.on('globalpointermove', (event: FederatedPointerEvent) => {
        if (isPanning) {
          const dx = event.globalX - panStartX
          const dy = event.globalY - panStartY
          getCanvas().panBy(dx, dy)
          panStartX = event.globalX
          panStartY = event.globalY
          return
        }
        // The Pixi-side marquee state is intentionally inert. The
        // active marquee flow is owned by the native DOM listeners
        // (see onNativeMarqueeDown/Move/Up). Keeping the Pixi move
        // here would just cause a double-draw of the rect.
      })

      hitArea.on('pointerup', () => {
        if (isPanning) {
          isPanning = false
          hitArea.cursor = spaceDown ? 'grab' : 'default'
          return
        }
        // No-op: native up handler does the finalization.
      })

      hitArea.on('pointerupoutside', () => {
        isPanning = false
        // No-op: native pointerup outside is also handled there if needed.
      })

      // Test-only hook: e2e reads live edge data (including the label)
      // directly from the closure-captured graph edges, so the spec can
      // assert "double-tap → type → Enter" commits the new label.
      ;(window as unknown as { __flowentGetEdge?: (id: string) => { id: string; label: string } | null }).__flowentGetEdge = (edgeId: string) => {
        const edges = Array.from(canvasRef.current.document.edges.values())
        const found = edges.find((candidate) => candidate.id === edgeId)
        return found ? { id: found.id, label: found.label ?? '' } : null
      }
      // Test-only hook: e2e drives the marquee programmatically. Pixi v8
      // event capture in the host page makes `page.mouse.move`/`up`
      // unreliable in headless, so the spec calls this hook to run the
      // same selection path the marquee would.
      ;(window as unknown as { __flowentRunMarquee?: (x1: number, y1: number, x2: number, y2: number) => void }).__flowentRunMarquee = (x1: number, y1: number, x2: number, y2: number) => {
        getCanvas().selectNodesInRect(x1, y1, x2, y2)
      }
      // Test-only hook: e2e reads the live title of a node (after
      // keyboard-driven rename through the properties panel).
      ;(window as unknown as { __flowentGetNodeTitle?: (id: string) => { id: string; title: string } | null }).__flowentGetNodeTitle = (nodeId: string) => {
        const node = canvasRef.current.document.nodes.get(nodeId)
        return node ? { id: node.id, title: node.title } : null
      }

      // Test-only hooks: e2e reads live node positions so the spec can
      // compute where to double-tap an on-canvas label hit pad.
      ;(window as unknown as { __flowentGetNodePosition?: (id: string) => { x: number; y: number } | null }).__flowentGetNodePosition = (nodeId: string) => {
        const found = canvasRef.current.document.nodes.get(nodeId)
        return found ? { x: found.x, y: found.y } : null
      }
      ;(window as unknown as { __flowentGetNodePositions?: () => Record<string, { x: number; y: number }> }).__flowentGetNodePositions = () => {
        const nodes = canvasRef.current.document.nodes
        const map: Record<string, { x: number; y: number }> = {}
        for (const [id, n] of nodes) {
          map[id] = { x: n.x, y: n.y }
        }
        return map
      }
      // Test-only helper: deterministic edge creation for e2e. The
      // production port-drag flow is covered by canvas-edges.spec.ts;
      // here we want to focus on the label editor without coupling to
      // pixel coordinates of the port hit areas.
      ;(window as unknown as { __flowentTestAddEdge?: (sourceId: string, targetId: string) => Promise<string | null> }).__flowentTestAddEdge = async (sourceId: string, targetId: string) => {
        const before = canvasRef.current.document
        if (!before.nodes.has(sourceId) || !before.nodes.has(targetId)) return null
        const beforeKeys = new Set(before.edges.keys())
        getCanvas().onConnect(sourceId, targetId, 'out', 'in')
        // onConnect dispatches through React's setState; wait one
        // animation frame so the new edge id is visible in the doc.
        await new Promise((resolve) => requestAnimationFrame(() => resolve(null)))
        await new Promise((resolve) => requestAnimationFrame(() => resolve(null)))
        const after = canvasRef.current.document.edges
        for (const [id] of after) {
          if (!beforeKeys.has(id)) return id
        }
        return null
      }
      ;(window as unknown as { __flowentGetEdgeRoutes?: () => Record<string, { x: number; y: number }[]> }).__flowentGetEdgeRoutes = () => {
        const doc = canvasRef.current.document
        const map: Record<string, { x: number; y: number }[]> = {}
        for (const edge of doc.edges.values()) {
          const source = doc.nodes.get(edge.sourceNodeId)
          const target = doc.nodes.get(edge.targetNodeId)
          if (!source || !target) continue
          const from = getPortAnchor(source, edge.sourcePortId, 'source')
          const to = getPortAnchor(target, edge.targetPortId, 'target')
          const route = routeOrthogonalEdge({
            source: { x: from.x, y: from.y },
            sourceSide: from.side,
            target: { x: to.x, y: to.y },
            targetSide: to.side,
          })
          map[edge.id] = route
        }
        return map
      }
      // Test-only hook: e2e reads the on-canvas label center (the
      // bezier midpoint where the inline editor would appear) so the
      // spec can click the exact pixel without guessing.
      ;(window as unknown as { __flowentGetViewport?: () => { x: number; y: number; zoom: number } | null }).__flowentGetViewport = () => {
        const v = canvasRef.current.document.viewport
        return { x: v.x, y: v.y, zoom: v.zoom }
      }
      ;(window as unknown as { __flowentGetEdgeLabelCenter?: (id: string) => { x: number; y: number } | null }).__flowentGetEdgeLabelCenter = (edgeId: string) => {
        const doc = canvasRef.current.document
        const edge = doc.edges.get(edgeId)
        if (!edge) return null
        const source = doc.nodes.get(edge.sourceNodeId)
        const target = doc.nodes.get(edge.targetNodeId)
        if (!source || !target) return null
        const from = getPortAnchor(source, edge.sourcePortId, 'source')
        const to = getPortAnchor(target, edge.targetPortId, 'target')
        const t = 0.5
        const u = 1 - t
        return {
          x: u * u * u * from.x + 3 * u * u * t * (from.x + 0.25 * (to.x - from.x)) + 3 * u * t * t * (from.x + 0.75 * (to.x - from.x)) + t * t * t * to.x,
          y: u * u * u * from.y + 3 * u * u * t * from.y + 3 * u * t * t * to.y + t * t * t * to.y,
        }
      }

      const redraw = () => {
        const width = host.clientWidth
        const height = host.clientHeight
        // Read fresh canvas + derived data on every frame. The ticker
        // drives redraws at ~60fps, so this captures the latest
        // state from React without tearing down the stage.
        const c = getCanvas()

        // Apply viewport transform
        stage.root.x = c.viewport.x
        stage.root.y = c.viewport.y
        stage.root.scale.set(c.viewport.zoom)

        // Update hit area size
        hitArea.clear()
        hitArea.rect(0, 0, width / c.viewport.zoom, height / c.viewport.zoom)
        hitArea.fill({ color: 0x000000, alpha: 0.001 })

        drawGrid(layers.gridLayer, width / c.viewport.zoom, height / c.viewport.zoom)
        drawEdges(layers.edgeLayer, graphEdgesRef.current, nodesByIdRef.current, {
          selectedEdgeIds: c.selectedEdgeIds,
          dimmedEdgeIds: c.focusView.dimmedEdgeIds,
          onEdgeClick: (edgeId, event) => {
            c.onEdgeClick(edgeId, event.shiftKey || event.ctrlKey || event.metaKey)
          },
          onOpenLabelEditor: (edgeId, anchor) => {
            labelEditorRef.current.openAt(edgeId, anchor)
          },
          labelHitLayer,
        })
        drawNodes(layers.nodeLayer, graphNodesRef.current, c.selectedNodeIds, {
          dimmedNodeIds: c.focusView.dimmedNodeIds,
        })

        // Attach events to nodes and ports
        for (const child of layers.nodeLayer.children) {
          const label = (child as { label?: string }).label
          if (!label) continue

          // Remove existing listeners to avoid duplicates
          child.removeAllListeners()

          // Check if this is a port
          if (label.startsWith('port:')) {
            let portDragging = false
            let portStartX = 0
            let portStartY = 0
            let sourceNodeId = ''
            const sourcePortId = label.replace('port:', '')

            // Find parent node
            const parent = child.parent
            if (parent && 'label' in parent) {
              sourceNodeId = (parent as { label: string }).label
            }

            child.on('pointerdown', (event: FederatedPointerEvent) => {
              portDragging = true
              portStartX = event.globalX
              portStartY = event.globalY

              // Start connection in connector mode
              const c = getCanvas()
              if (c.connectorMode) {
                c.startConnection(sourceNodeId, sourcePortId)
              }
            })

            child.on('globalpointermove', (event: FederatedPointerEvent) => {
              if (!portDragging) return

              // Draw temporary connection line
              layers.overlayLayer.children.forEach((c) => {
                if ((c as { label?: string }).label === 'temp-connection') {
                  layers.overlayLayer.removeChild(c)
                }
              })

              const tempLine = new Graphics()
              tempLine.label = 'temp-connection'
              tempLine.stroke({ color: 0x0071e3, width: 2, alpha: 0.6 })
              tempLine.moveTo(portStartX, portStartY)
              tempLine.lineTo(event.globalX, event.globalY)
              layers.overlayLayer.addChild(tempLine)
            })

            child.on('pointerup', (event: FederatedPointerEvent) => {
              if (!portDragging) return
              portDragging = false

              // Remove temporary line
              layers.overlayLayer.children.forEach((c) => {
                if ((c as { label?: string }).label === 'temp-connection') {
                  layers.overlayLayer.removeChild(c)
                }
              })

              // Find target node under cursor
              const c = getCanvas()
              const targetNode = findNodeAtPosition(
                event.globalX,
                event.globalY,
                graphNodesRef.current,
                sourceNodeId,
                c.viewport,
              )

              if (targetNode) {
                const worldX = (event.globalX - c.viewport.x) / c.viewport.zoom
                const worldY = (event.globalY - c.viewport.y) / c.viewport.zoom
                const targetPort = findNearestTargetPort(targetNode, { x: worldX, y: worldY })
                const targetPortId = targetPort?.id ?? 'in'
                c.onConnect(sourceNodeId, targetNode.id, sourcePortId, targetPortId)
              } else if (c.connectorMode && c.connectionStart) {
                c.endConnection(sourceNodeId, 'in')
              }
            })

            child.on('pointerupoutside', () => {
              portDragging = false
              layers.overlayLayer.children.forEach((c) => {
                if ((c as { label?: string }).label === 'temp-connection') {
                  layers.overlayLayer.removeChild(c)
                }
              })
            })

            continue
          }

          // Node event handling
          child.on('pointertap', (event: FederatedPointerEvent) => {
            const now = Date.now()
            const timeSinceLastClick = now - lastClickTime
            const isSameNode = lastClickNodeId === label
            const c = getCanvas()

            if (timeSinceLastClick < 300 && isSameNode) {
              // Double click - open editor
              c.openEditor(label)
            } else {
              // Single click - select
              const additive = event.shiftKey || event.ctrlKey || event.metaKey
              c.onNodeClick(label, additive)
            }

            lastClickTime = now
            lastClickNodeId = label
          })

          // Drag support for node
          let dragging = false
          let startX = 0
          let startY = 0

          child.on('pointerdown', (event: FederatedPointerEvent) => {
            dragging = true
            startX = event.globalX
            startY = event.globalY
            // Select this node on press so the subsequent pointermove
            // (which dispatches through `moveSelectedNodes`) has
            // something to move. Without this, the drag would no-op
            // until the pointertap (on pointerup) selected the node,
            // which is too late — by then the drag has already
            // happened.
            const additive = event.shiftKey || event.ctrlKey || event.metaKey
            getCanvas().onNodeClick(label, additive)
          })

          child.on('globalpointermove', (event: FederatedPointerEvent) => {
            if (!dragging) return

            const dx = event.globalX - startX
            const dy = event.globalY - startY

            if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
              getCanvas().moveSelectedNodes(dx, dy)
              startX = event.globalX
              startY = event.globalY
            }
          })

          child.on('pointerup', () => {
            dragging = false
          })

          child.on('pointerupoutside', () => {
            dragging = false
          })
        }
      }

      redraw()

      const ticker = () => redraw()
      stage.app.ticker.add(ticker)

      destroy = () => {
        stage.app.ticker.remove(ticker)
        host.removeEventListener('pointerdown', onNativeMarqueeDown)
        host.removeEventListener('pointermove', onNativeMarqueeMove)
        host.removeEventListener('pointerup', onNativeMarqueeUp)
        host.removeEventListener('pointercancel', onNativeMarqueeUp)
        host.removeEventListener('mousemove', onHostMouseMove)
        host.removeEventListener('mouseup', onHostMouseUp)
        window.removeEventListener('pointermove', onWindowPointerMove, true)
        window.removeEventListener('pointerup', onWindowPointerUp, true)
        document.removeEventListener('pointermove', onDocumentPointerMove, true)
        document.removeEventListener('pointerup', onDocumentPointerUp, true)
        stage.destroy()
      }
    }

    run().catch(() => {
      // no-op: drawing failures should not crash the app shell
    })

    return () => {
      disposed = true
      destroy?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    // Empty deps: the Pixi stage and pointer listeners are created
    // once on mount and live for the lifetime of the component. The
    // redraw ticker reads fresh state on every frame via canvasRef
    // and the derived-data refs above, so React state changes don't
    // require tearing the stage down. The previous version listed
    // `canvas, graphEdges, graphNodes, nodesById, labelEditor` here,
    // which caused the effect to re-run on every state mutation,
    // destroying the stage + all in-flight pointer state (marquee
    // drag would silently abort because the new effect had a fresh
    // `marqueeState.dragging = false`).
  ])

  return (
    <div className="canvas-container">
      <div className="canvas-header">
        <h1 className="canvas-title">Flowent</h1>
        <p className="canvas-subtitle">Process maps for aligned product teams</p>
      </div>

      <Toolbar
        onToggleConnector={canvas.toggleConnectorMode}
        onRemove={canvas.removeSelected}
        onAutoLayout={() => canvas.autoLayout()}
        onUndo={canvas.undo}
        onRedo={canvas.redo}
        onExport={() => {
          // Export the current canvas document. The exporter walks the
          // Pixi-independent GraphDocument and returns a self-contained
          // SVG. The download is browser-only.
          const svg = exportProcessMapAsSvg(canvas.document)
          if (typeof document === 'undefined') return
          const filename = `flowent-process-map-${Date.now()}.svg`
          downloadBlob(new Blob([svg], { type: 'image/svg+xml' }), filename)
        }}
        canUndo={canvas.canUndo}
        canRedo={canvas.canRedo}
        hasSelection={canvas.selectedNodeIds.size > 0}
        connectorMode={canvas.connectorMode}
      />

      <ProcessElementPalette onQuickCreate={canvas.quickCreate} />

      <div
        ref={hostRef}
        className="pixi-host"
        aria-label="Process canvas"
        tabIndex={0}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      />

      {labelEditor.openEdgeId && labelEditor.anchor && (() => {
        // Convert the world-anchored label center into screen pixels
        // relative to the .pixi-host's bounding rect, so the input
        // stays glued to the label even when the host is offset by the
        // toolbar, properties panel, or any future layout.
        const screenX = labelEditor.anchor.x * canvas.viewport.zoom + canvas.viewport.x
        const screenY = labelEditor.anchor.y * canvas.viewport.zoom + canvas.viewport.y
        const initialLabel = canvas.editorEdge?.data?.label ?? ''
        return (
          <input
            key={labelEditor.openEdgeId}
            ref={labelInputRef}
            className="edge-label-editor"
            type="text"
            defaultValue={initialLabel}
            autoFocus
            style={{
              left: `${screenX + hostOrigin.left}px`,
              top: `${screenY + hostOrigin.top}px`,
            }}
            onKeyDown={(event: ReactKeyboardEvent<HTMLInputElement>) => {
              if (event.key === 'Enter') {
                labelEditor.commit(labelInputRef.current?.value ?? initialLabel)
              } else if (event.key === 'Escape') {
                labelEditor.cancel()
              }
            }}
            onBlur={() => {
              // Commit only if the user actually edited; otherwise
              // cancel so an accidental blur preserves the original
              // label (the spec asserts this behavior on Escape, and
              // it also applies to Tab/click-outside).
              const value = labelInputRef.current?.value ?? ''
              if (value === initialLabel) {
                labelEditor.cancel()
              } else {
                labelEditor.commit(value)
              }
            }}
            aria-label="Edit connection label"
          />
        )
      })()}

      {/* Keyboard-accessible proxy list of all edges. Visually hidden
          but tab-reachable; pressing Enter opens the same inline label
          editor the double-tap flow uses. This pairs with the
          visually-hidden graph-outline ("canvas-structure") to make
          the process map fully usable without a mouse. */}
      <ul className="sr-only" aria-label="Connections">
        {canvas.edges.map((edge) => {
          const labelText = edge.data?.label ? `, label: ${edge.data.label}` : ', no label'
          return (
            <li key={edge.id}>
              <button
                type="button"
                data-edge-id={edge.id}
                onClick={() => {
                  canvas.onEdgeClick(edge.id, false)
                }}
                onKeyDown={(event: ReactKeyboardEvent<HTMLButtonElement>) => {
                  // Browsers synthesize a click on Enter/Space for
                  // <button>. Suppress it so onClick doesn't double-fire
                  // alongside this handler.
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                  }
                  if (event.key === 'Enter') {
                    // Compute the same world-anchored label center
                    // the double-tap detector produces, and open the
                    // editor there.
                    const sourceNode = nodesById.get(edge.source)
                    const targetNode = nodesById.get(edge.target)
                    if (!sourceNode || !targetNode) return
                    const from = getPortAnchor(sourceNode, edge.sourceHandle ?? 'out', 'source')
                    const to = getPortAnchor(targetNode, edge.targetHandle ?? 'in', 'target')
                    const t = 0.5
                    const u = 1 - t
                    const center = {
                      x: u * u * u * from.x + 3 * u * u * t * (from.x + 0.25 * (to.x - from.x)) + 3 * u * t * t * (from.x + 0.75 * (to.x - from.x)) + t * t * t * to.x,
                      y: u * u * u * from.y + 3 * u * u * t * from.y + 3 * u * t * t * to.y + t * t * t * to.y,
                    }
                    canvas.onEdgeClick(edge.id, false)
                    labelEditor.openAt(edge.id, center)
                  }
                }}
                aria-label={`Connection from ${edge.source} to ${edge.target}${labelText}`}
              >
                Edit label for connection {edge.source} → {edge.target}
              </button>
            </li>
          )
        })}
      </ul>

      <ul className="sr-only" aria-label="Nodes">
        {canvas.nodes.map((node) => {
          // The aria-label intentionally uses the node's title only.
          // We do NOT include the type name ("Activity", "Decision",
          // etc.) in the visible label so that broad locators like
          // `button:has-text("Activity")` (used by the legacy
          // port-drag specs) don't accidentally match this visually-
          // hidden proxy. The type is still discoverable via the
          // `data-node-kind` attribute for testability.
          const finalLabel = (() => {
            const kind = node.data.kind
            switch (kind) {
              case 'start':
              case 'end':
                return node.data.label || node.id
              default:
                return node.data.title || node.id
            }
          })()
          const nodeKind =
            node.data.kind === 'activity'
              ? 'activity'
              : node.data.kind === 'decision'
                ? 'decision'
                : node.data.kind === 'stage'
                  ? 'stage'
                  : node.data.kind === 'bottleneck'
                    ? 'bottleneck'
                    : node.data.kind
          return (
            <li key={node.id}>
              <button
                type="button"
                data-node-id={node.id}
                data-node-kind={nodeKind}
                onFocus={() => {
                  canvas.onNodeClick(node.id, false)
                }}
                onClick={() => {
                  canvas.onNodeClick(node.id, false)
                }}
                onKeyDown={(event: ReactKeyboardEvent<HTMLButtonElement>) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                  }
                  if (event.key === 'Enter') {
                    canvas.onNodeClick(node.id, false)
                    canvas.openEditor(node.id)
                  } else if (event.key === 'Delete' || event.key === 'Backspace') {
                    event.preventDefault()
                    canvas.removeSelected()
                  }
                }}
                aria-label={finalLabel}
              >
                {/* Visible text intentionally minimal so a screen
                    reader announces only the descriptive aria-label.
                    The text is also intentionally NOT the type name
                    ("Activity" / "Decision" / etc.) so that broad
                    locators like `button:has-text(...)` in existing
                    specs don't accidentally match this visually-hidden
                    proxy. The type remains available via the
                    data-node-kind attribute. */}
                ·
              </button>
            </li>
          )
        })}
      </ul>

      <FocusBar focus={canvas.focus} roles={canvas.roles} onChange={canvas.setFocus} />

      <AlignmentChecklist
        diagnostics={canvas.diagnostics}
        onSelectDiagnostic={(diagnostic) => canvas.selectDiagnosticTarget(diagnostic.targetType, diagnostic.targetId)}
      />

      <ActivationBar
        activation={canvas.activation}
        eligible={canvas.activationEligible.eligible}
        reasons={canvas.activationEligible.reasons}
        bottlenecks={canvas.bottleneckMetrics}
        onActivate={canvas.activateMap}
      />

      <div className="keyboard-hint" aria-hidden="true">
        <span><kbd>A</kbd> Activity</span>
        <span><kbd>D</kbd> Decision</span>
        <span><kbd>L</kbd> Layout</span>
        <span><kbd>⌘Z</kbd> Undo</span>
        <span><kbd>Del</kbd> Delete</span>
        <span><kbd>Space</kbd>+Drag Pan</span>
        <span><kbd>+</kbd><kbd>-</kbd> Zoom</span>
      </div>

      <div className="status-bar" aria-live="polite">
        <span>{canvas.nodes.length} nodes</span>
        <span>·</span>
        <span>{canvas.edges.length} edges</span>
        <span>·</span>
        <span>{Math.round(canvas.viewport.zoom * 100)}%</span>
        {canvas.selectedNodeIds.size > 0 && (
          <>
            <span>·</span>
            <span>{canvas.selectedNodeIds.size} selected</span>
          </>
        )}
      </div>

      <PropertiesPanel
        node={canvas.editorNode}
        edge={canvas.editorEdge}
        onUpdateNode={canvas.updateNodeData}
        onUpdateEdge={canvas.updateEdgeData}
        onClose={() => canvas.closeEditor()}
      />
    </div>
  )
}

function findNodeAtPosition(
  screenX: number,
  screenY: number,
  nodes: ReturnType<typeof toGraphNode>[],
  excludeNodeId: string,
  viewport: { x: number; y: number; zoom: number },
): ReturnType<typeof toGraphNode> | null {
  // Convert screen coordinates to world coordinates
  const worldX = (screenX - viewport.x) / viewport.zoom
  const worldY = (screenY - viewport.y) / viewport.zoom

  for (const node of nodes) {
    if (node.id === excludeNodeId) continue
    if (
      worldX >= node.x &&
      worldX <= node.x + node.width &&
      worldY >= node.y &&
      worldY <= node.y + node.height
    ) {
      return node
    }
  }
  return null
}

function toGraphNode(node: ProcessNode) {
  if (node.data.kind === 'activity') {
    return {
      id: node.id,
      type: 'activity' as const,
      x: node.position.x,
      y: node.position.y,
      width: 220,
      height: 96,
      title: node.data.title,
      summary: node.data.summary,
      roleTags: node.data.roleIds,
      ports: [
        { id: 'in', side: 'top' as const },
        { id: 'out', side: 'bottom' as const },
      ],
    }
  }

  if (node.data.kind === 'decision') {
    return {
      id: node.id,
      type: 'decision' as const,
      x: node.position.x,
      y: node.position.y,
      width: 180,
      height: 108,
      title: node.data.title,
      criteria: node.data.criteria,
      roleTags: [],
      ports: [
        { id: 'in', side: 'top' as const },
        { id: 'yes', side: 'bottom' as const },
        { id: 'no', side: 'right' as const },
      ],
    }
  }

  const isStart = node.data.kind === 'start'
  const data = node.data
  const label = data.kind === 'start' || data.kind === 'end' ? data.label : ''

  return {
    id: node.id,
    type: isStart ? ('start' as const) : ('end' as const),
    x: node.position.x,
    y: node.position.y,
    width: 120,
    height: 56,
    title: label,
    roleTags: [],
    ports: [{ id: isStart ? 'out' : 'in', side: isStart ? ('bottom' as const) : ('top' as const) }],
  }
}
