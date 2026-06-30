import { useEffect } from 'react'
import type { MutableRefObject, RefObject } from 'react'
import { Container, Graphics } from 'pixi.js'
import type { ConnectionCreateRequest, GraphEdge, GraphNode } from './canvasTypes'
import type { EdgeLabelEditorApi } from './useEdgeLabelEditor'
import type { useCanvasState } from './useCanvasState'
import { createPixiStage } from './render/pixiStage'
import { createCanvasLayers } from './render/layers'
import { registerCanvasTestHooks } from './registerCanvasTestHooks'
import { registerCanvasRedrawLoop } from './registerCanvasRedrawLoop'
import { registerCanvasNativeHandlers } from './registerCanvasNativeHandlers'

interface UseCanvasStageLifecycleArgs {
  hostRef: RefObject<HTMLDivElement | null>
  canvasRef: MutableRefObject<ReturnType<typeof useCanvasState>>
  graphNodesRef: MutableRefObject<GraphNode[]>
  graphEdgesRef: MutableRefObject<GraphEdge[]>
  nodesByIdRef: MutableRefObject<Map<string, GraphNode>>
  labelEditorRef: MutableRefObject<EdgeLabelEditorApi>
  openConnectionCreateMenuRef: MutableRefObject<(request: ConnectionCreateRequest) => void>
  openEdgeContextMenuRef: MutableRefObject<(edgeId: string, point: { screenX: number; screenY: number }) => void>
}

// Mount the long-lived Pixi stage and its sibling native/Pixi helpers.
// The hook owns only the imperative lifecycle; the caller remains
// responsible for keeping `canvasRef` and the derived graph refs synced.
export function useCanvasStageLifecycle(args: UseCanvasStageLifecycleArgs): void {
  const {
    hostRef,
    canvasRef,
    graphNodesRef,
    graphEdgesRef,
    nodesByIdRef,
    labelEditorRef,
    openConnectionCreateMenuRef,
    openEdgeContextMenuRef,
  } = args

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    let disposed = false
    let destroy: (() => void) | null = null

    // The caller owns the React-side sync of canvasRef + graph refs.
    // This lifecycle reads those stable ref objects so the stage and
    // listeners see the latest state without a teardown on every edit.
    const getCanvas = () => canvasRef.current

    const run = async () => {
      const stage = await createPixiStage(host)
      if (disposed) {
        stage.destroy()
        return
      }
      const pixiCanvasEl: HTMLCanvasElement = stage.app.canvas

      destroy = stage.destroy

      const layers = createCanvasLayers(stage.root)
      // The Pixi-side pointer handlers (cursor feedback) and the
      // native-side marquee state are kept independent so the two
      // paths don't race. The Pixi block only handles visual cursor
      // feedback; the actual marquee selection and panning are owned
      // by the native DOM listeners in `registerCanvasNativeHandlers`
      // and the Pixi-side `registerCanvasPanHandler` helper below.
      // Both keep their own start coordinates so they survive redraws.

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

      // Native marquee, pan, wheel zoom, and node/port pointer handlers
      // live in a dedicated module so the container stays focused on
      // React state + composition. The per-child Pixi port drag handlers
      // stay in the redraw loop helper because they need closures over
      // the per-frame port-drag state.
      const nativeHandlers = registerCanvasNativeHandlers({
        host,
        pixiCanvasEl,
        hitArea,
        marqueeRect,
        graphNodesRef,
        graphEdgesRef,
        getCanvas: () => {
          const c = canvasRef.current
          return {
            document: c.document,
            viewport: c.viewport,
            connectorMode: c.connectorMode,
            selectNodesInRect: c.selectNodesInRect,
            onPaneClick: c.onPaneClick,
            zoomAt: c.zoomAt,
            panBy: c.panBy,
            moveSelectedNodes: c.moveSelectedNodes,
            onNodeClick: c.onNodeClick,
            onEdgeClick: c.onEdgeClick,
            openEditor: c.openEditor,
            onConnect: c.onConnect,
            startConnection: c.startConnection,
            cancelConnection: c.cancelConnection,
            openConnectionCreateMenu: openConnectionCreateMenuRef.current,
          }
        },
      })

      // Edge and label hit pads sit on top of the canvas hit area so they can
      // receive pointer events. Added AFTER the hitArea so they win the
      // z-order in overlayLayer (Pixi v8 checks children in reverse-
      // insertion order). Labels are added last so label taps take priority
      // over the wider edge hit area.
      const edgeHitLayer = new Container()
      edgeHitLayer.label = 'edge-hit-layer'
      layers.overlayLayer.addChild(edgeHitLayer)

      const labelHitLayer = new Container()
      labelHitLayer.label = 'edge-label-hit-layer'
      layers.overlayLayer.addChild(labelHitLayer)

      // Register all test-only hooks in one place so the stage lifecycle
      // remains readable. The hooks still read fresh data via canvasRef +
      // getCanvas, but the registration itself now lives in a small
      // dedicated helper module.
      registerCanvasTestHooks({ canvasRef, getCanvas })

      // Per-frame Pixi redraw + per-child listener attachment live in a
      // dedicated helper. The helper owns the ticker, the signature-based
      // change detection, the port-hover visibility pass, and the port-
      // drag / node-pointertap Pixi listeners.
      const redrawLoop = registerCanvasRedrawLoop({
        stage,
        layers,
        host,
        hitArea,
        edgeHitLayer,
        labelHitLayer,
        graphNodesRef,
        graphEdgesRef,
        nodesByIdRef,
        labelEditorRef,
        getCanvas: () => {
          const c = canvasRef.current
          return {
            document: c.document,
            viewport: c.viewport,
            selectedNodeIds: c.selectedNodeIds,
            selectedEdgeIds: c.selectedEdgeIds,
            focusView: c.focusView,
            connectorMode: c.connectorMode,
            connectionStart: c.connectionStart,
            onConnect: c.onConnect,
            startConnection: c.startConnection,
            endConnection: c.endConnection,
            cancelConnection: c.cancelConnection,
            openConnectionCreateMenu: openConnectionCreateMenuRef.current,
            onNodeClick: c.onNodeClick,
            onEdgeClick: c.onEdgeClick,
            onEdgeContextMenu: openEdgeContextMenuRef.current,
            openEditor: c.openEditor,
          }
        },
      })

      destroy = () => {
        redrawLoop.destroy()
        nativeHandlers.destroy()
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
  }, [canvasRef, graphEdgesRef, graphNodesRef, hostRef, labelEditorRef, nodesByIdRef, openConnectionCreateMenuRef, openEdgeContextMenuRef])
}
