import { Container, Graphics } from 'pixi.js'
import type { FederatedPointerEvent } from 'pixi.js'
import type { GraphEdge, GraphNode } from './canvasTypes'
import type { CanvasLayers } from './render/layers'
import { drawGrid } from './render/layers'
import { drawEdges } from './render/drawEdges'
import { getPortPosition } from './render/drawEdges'
import { drawNodes } from './render/drawNodes'
import type { PixiStage } from './render/pixiStage'
import type { EdgeLabelAnchor } from './useEdgeLabelEditor'

export interface RedrawCanvasLike {
  document: import('./canvasTypes').GraphDocument
  viewport: { x: number; y: number; zoom: number }
  selectedNodeIds: Set<string>
  selectedEdgeIds: Set<string>
  focusView: { dimmedNodeIds: Set<string>; dimmedEdgeIds: Set<string> }
  connectorMode: boolean
  connectionStart: { nodeId: string; portId: string } | null
  onConnect: (
    sourceNodeId: string,
    targetNodeId: string,
    sourcePortId?: string,
    targetPortId?: string,
  ) => void
  startConnection: (nodeId: string, portId: string) => void
  endConnection: (nodeId: string, portId: string) => void
  cancelConnection: () => void
  openConnectionCreateMenu: (request: import('./canvasTypes').ConnectionCreateRequest) => void
  onNodeClick: (nodeId: string, additive: boolean) => void
  onEdgeClick: (edgeId: string, additive: boolean) => void
  onEdgeContextMenu: (edgeId: string, point: { screenX: number; screenY: number }) => void
  openEditor: (nodeId: string) => void
}

export interface RedrawLabelEditorLike {
  openAt: (edgeId: string, anchor: EdgeLabelAnchor) => void
}

export interface RegisterCanvasRedrawLoopArgs {
  stage: PixiStage
  layers: CanvasLayers
  host: HTMLDivElement
  hitArea: Graphics
  edgeHitLayer: Container
  labelHitLayer: Container
  graphNodesRef: { current: GraphNode[] }
  graphEdgesRef: { current: GraphEdge[] }
  nodesByIdRef: { current: Map<string, GraphNode> }
  labelEditorRef: { current: RedrawLabelEditorLike | null }
  getCanvas: () => RedrawCanvasLike
}

export interface CanvasRedrawLoopRegistration {
  destroy: () => void
}

// Owns the per-frame Pixi redraw loop for the canvas: viewport
// transform, grid, edge/node redraw (with signature-based change
// detection), port-hover visibility, and the per-child Pixi listener
// attachment pass (port drag, node double-click, node hover). The
// stage + ticker + redraw state all live here so ProcessCanvas can
// stay focused on React state + DOM overlays.
export function registerCanvasRedrawLoop(
  args: RegisterCanvasRedrawLoopArgs,
): CanvasRedrawLoopRegistration {
  const {
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
    getCanvas,
  } = args

  // Hash every field that affects node chrome. As the renderer grows
  // richer (owner chips, decision outcomes, stage goal / entry / exit
  // summaries, review chips, etc.) we must include those fields here
  // so edits redraw immediately instead of waiting for some
  // unrelated state change.
  const computeNodeSignature = (
    nodes: typeof graphNodesRef.current,
    selected: Set<string>,
    dimmed: Set<string>,
  ) =>
    JSON.stringify({
      ids: nodes.map((n) => n.id),
      positions: nodes.map((n) => `${n.id}:${n.x},${n.y}`),
      titles: nodes.map((n) => `${n.id}:${n.title}`),
      summaries: nodes.map((n) => `${n.id}:${n.summary ?? ''}`),
      roleTags: nodes.map((n) => `${n.id}:${n.roleTags.join(',')}`),
      responsibilities: nodes.map((n) =>
        `${n.id}:${(n.responsibilities ?? []).map((r) => `${r.kind}:${r.roleName}`).join('|')}`,
      ),
      assetSummaries: nodes.map((n) =>
        `${n.id}:${n.assetSummary ? [
          n.assetSummary.responsibleRoles.join(','),
          n.assetSummary.accountableRoles.join(','),
          n.assetSummary.inputCount,
          n.assetSummary.outputCount,
          n.assetSummary.guidanceCount,
          n.assetSummary.milestoneCount,
        ].join('|') : ''}`,
      ),
      types: nodes.map((n) => `${n.id}:${n.type}`),
      owners: nodes.map((n) => `${n.id}:${'owner' in n ? n.owner ?? '' : ''}`),
      decisionOutcomes: nodes.map((n) => {
        if ('decisionOutcomes' in n && Array.isArray(n.decisionOutcomes)) {
          return `${n.id}:${n.decisionOutcomes.join('|')}`
        }
        return `${n.id}:`
      }),
      goals: nodes.map((n) => `${n.id}:${'goal' in n ? n.goal ?? '' : ''}`),
      entryConditions: nodes.map((n) =>
        `${n.id}:${'entryCondition' in n ? n.entryCondition ?? '' : ''}`,
      ),
      exitConditions: nodes.map((n) =>
        `${n.id}:${'exitCondition' in n ? n.exitCondition ?? '' : ''}`,
      ),
      reviewStatus: nodes.map((n) =>
        `${n.id}:${'reviewStatus' in n ? n.reviewStatus ?? '' : ''}`,
      ),
      selected: Array.from(selected),
      dimmed: Array.from(dimmed),
    })

  // Hash the bits the edge renderer reads: ids, labels, rendered
  // handoff metadata, AND the endpoint node positions. Without
  // positions in the signature, moving a node wouldn't trigger an
  // edge re-render — the old Bezier curve would stay anchored to
  // the stale coordinates while the nodes dragged away. Also fold
  // the source/target port id so re-pointing a connector to a
  // different port rebuilds the curve. Include fromRole / toRole /
  // artifact because the selected-edge metadata line now renders
  // them and would otherwise go stale until some unrelated redraw.
  const computeEdgeSignature = (
    edges: typeof graphEdgesRef.current,
    selected: Set<string>,
    dimmed: Set<string>,
  ) =>
    JSON.stringify({
      ids: edges.map((e) => e.id),
      labels: edges.map((e) => `${e.id}:${e.label}`),
      colors: edges.map((e) => `${e.id}:${e.color ?? ''}`),
      metadata: edges.map(
        (e) =>
          `${e.id}:${e.fromRole ?? ''}:${e.toRole ?? ''}:${e.artifact ?? ''}:${
            e.readinessSignal ?? ''
          }:${e.expectation ?? ''}:${e.workProductIds?.join(',') ?? ''}:${e.assetSummary?.workProductCount ?? 0}`,
      ),
      endpoints: edges.map((e) => {
        const s = nodesByIdRef.current.get(e.sourceNodeId)
        const t = nodesByIdRef.current.get(e.targetNodeId)
        return `${e.id}:${e.sourcePortId}@${s?.x ?? 0},${s?.y ?? 0}>${e.targetPortId}@${
          t?.x ?? 0
        },${t?.y ?? 0}`
      }),
      selected: Array.from(selected),
      dimmed: Array.from(dimmed),
    })

  // Track the last data signature we rebuilt children with. If the
  // node/edge set, selection, or focus haven't changed since the
  // last redraw, skip the expensive drawNodes/drawEdges pass —
  // recreating those children on every frame would destroy Pixi's
  // per-child event listeners mid-gesture and break pointer drags,
  // port drags, and selection. The cheap per-frame work (viewport
  // transform, hit-area resize, grid) keeps running so panning and
  // zooming stay smooth.
  let lastNodeSignature = ''
  let lastEdgeSignature = ''

  // Track which node (by id) is currently hovered, so the per-frame
  // port-visibility pass can fade the right container's ports in.
  // Stored outside the redraw because the node child instances are
  // recreated on every data change — the ref keeps the value across
  // re-renders.
  const hoveredNodeIdRef = { current: null as string | null }

  // Set to true by the redraw when it just rebuilt the node children
  // (signature changed). The listener-attachment pass below runs
  // only then, so per-frame redraws don't strip and re-bind listeners
  // mid-gesture.
  let needsListenerAttachment = true

  // Shared state for in-flight Pixi port drag (drag-from-port to
  // create a connection). The Pixi children are recreated on every
  // redraw (so the listeners are re-attached to fresh children), but
  // the in-flight drag must survive those recreations. We hoist the
  // state to a stable object that all redraw-attached handlers share
  // by reference. Without this, a pointerdown on frame N's child
  // would set `dragging = true` on a closure that frame N+1's child
  // doesn't see — so the subsequent globalpointermove returns early
  // and the drag silently no-ops.
  const portDragState: {
    dragging: boolean
    startX: number
    startY: number
    sourceNodeId: string
    sourcePortId: string
  } = {
    dragging: false,
    startX: 0,
    startY: 0,
    sourceNodeId: '',
    sourcePortId: '',
  }

  // Pixi-side double-click detection was removed: the native handler
  // (registered on the host) owns double-click → open editor, and
  // duplicating it here caused openEditor to be called twice on a
  // real double-click. The Pixi pointertap now only handles single-
  // click selection.
  //
  // Helper used by both the pointerdown handler on a port and the
  // pointerup cleanup paths to wipe any temp-connection line we
  // drew during a drag. We tag the line by `.label = 'temp-connection'`
  // and walk the overlay layer looking for it; this is cheap because
  // there's at most one temp line at any time.
  const removeTempConnectionLine = () => {
    // We tag the line by `.label = 'temp-connection'`. There's at
    // most one temp line at any time, so break after the first
    // match (also avoids mutating the children array while
    // iterating it).
    for (const c of layers.overlayLayer.children) {
      if ((c as { label?: string }).label === 'temp-connection') {
        layers.overlayLayer.removeChild(c)
        break
      }
    }
  }

  const attachNodeListeners = (
    child: Container,
    label: string,
  ) => {
    // Single click → select. The native handler (registered on the
    // host) owns double-click detection → open editor, so we don't
    // duplicate that here. Pixi's `pointertap` only fires when
    // pointerdown + pointerup land on the same target without
    // leaving, so a drag-then-release won't select — and a click on
    // the node body that doesn't involve a drag still fires this.
    child.on('pointertap', (event: FederatedPointerEvent) => {
      const additive = event.shiftKey || event.ctrlKey || event.metaKey
      getCanvas().onNodeClick(label, additive)
    })

    // Hover-to-reveal ports. We track the hovered node id in a stable
    // ref so the value survives the per-frame child re-creation. Use
    // `pointerenter` / `pointerleave` (not `over`/`out`) so the flag
    // doesn't flicker when the pointer moves between a child port and
    // the body of the same node.
    child.on('pointerenter', () => {
      hoveredNodeIdRef.current = label
    })
    child.on('pointerleave', () => {
      hoveredNodeIdRef.current = null
    })
  }

  const attachPortListeners = (
    child: Container,
    sourcePortId: string,
  ) => {
    // Don't write `portDragState` eagerly here: this attach call
    // runs on every redraw that rebuilds the node children, and an
    // unconditional write would clobber `portDragState` to
    // whichever port the redraw happened to iterate last — even
    // if a port drag is currently in flight. We resolve both
    // `sourceNodeId` and `sourcePortId` lazily inside the
    // pointerdown handler, where we know the user actually
    // pressed this specific port.
    //
    // The closure-captured `sourcePortId` parameter is the safe
    // fallback when the parent lookup fails.
    //
    // Re-attach the hover-stroke effect that `drawPorts` set on the
    // initial render. The redraw's `removeAllListeners()` call below
    // strips the per-child listeners (pointerover/pointerout for the
    // hover stroke + our drag listeners), so we have to re-bind both.
    // The hover-stroke effect is a thin visual cue that's only
    // noticeable during long hovers, so any small drift in the
    // timing is acceptable. We look up the port's local coordinates
    // and the matching port circle from the parent node.
    const parent = child.parent
    if (parent && 'label' in parent) {
      const parentLabel = (parent as { label: string }).label
      const parentNode = nodesByIdRef.current.get(parentLabel)
      if (parentNode) {
        const port = parentNode.ports.find((p) => p.id === sourcePortId)
        if (port) {
          const portPos = getPortPosition(parentNode, port.id)
          const localX = portPos.x - parentNode.x
          const localY = portPos.y - parentNode.y
          const portCircleLabel = `port-circle:${sourcePortId}`
          const portCircle = parent.children.find(
            (c) =>
              (c as { label?: string }).label === portCircleLabel,
          ) as Graphics | undefined
          if (portCircle) {
            const portColor = 0xc4c4c6
            const portHoverColor = 0x0071e3
            const portRadius = 6
            const redrawPortCircle = (highlighted: boolean) => {
              portCircle.clear()
              portCircle.circle(
                localX,
                localY,
                highlighted ? portRadius + 2 : portRadius,
              )
              portCircle.fill(0xffffff)
              portCircle.stroke({
                color: highlighted ? portHoverColor : portColor,
                width: highlighted ? 2.5 : 2,
              })
            }
            child.on('pointerover', () => redrawPortCircle(true))
            child.on('pointerout', () => redrawPortCircle(false))
          }
        }
      }
    }

    child.on('pointerdown', (event: FederatedPointerEvent) => {
      // Resolve the source node id at the moment the user actually
      // presses on this port. We can't trust `portDragState.sourceNodeId`
      // here because the redraw may have just re-attached a different
      // port's listeners and overwritten it.
      const parent = child.parent
      const sourceNodeId =
        parent && 'label' in parent
          ? (parent as { label: string }).label
          : portDragState.sourceNodeId
      portDragState.sourceNodeId = sourceNodeId
      portDragState.sourcePortId = sourcePortId
      portDragState.dragging = true
      portDragState.startX = event.globalX
      portDragState.startY = event.globalY

      // Drag-from-port: start connection in connector mode. (Click-
      // to-connect is handled by the native handler on the host, so
      // this path is for the drag gesture only.)
      const c = getCanvas()
      if (c.connectorMode) {
        c.startConnection(sourceNodeId, sourcePortId)
      }
    })

    child.on('globalpointermove', (event: FederatedPointerEvent) => {
      if (!portDragState.dragging) return

      // Draw a temporary connection line from the port to the cursor.
      removeTempConnectionLine()

      const tempLine = new Graphics()
      tempLine.label = 'temp-connection'
      tempLine.stroke({ color: 0x0071e3, width: 2, alpha: 0.6 })
      tempLine.moveTo(portDragState.startX, portDragState.startY)
      tempLine.lineTo(event.globalX, event.globalY)
      layers.overlayLayer.addChild(tempLine)
    })

    child.on('pointerup', () => {
      if (!portDragState.dragging) return
      portDragState.dragging = false
      removeTempConnectionLine()
    })

    child.on('pointerupoutside', () => {
      portDragState.dragging = false
      removeTempConnectionLine()
    })
  }

  const redraw = () => {
    const width = host.clientWidth
    const height = host.clientHeight
    // Read fresh canvas + derived data on every frame. The ticker
    // drives redraws at ~60fps, so this captures the latest state
    // from React without tearing down the stage.
    const c = getCanvas()

    // Apply viewport transform
    stage.root.x = c.viewport.x
    stage.root.y = c.viewport.y
    stage.root.scale.set(c.viewport.zoom)

    // Update hit area size
    hitArea.clear()
    hitArea.rect(0, 0, width / c.viewport.zoom, height / c.viewport.zoom)
    hitArea.fill({ color: 0x000000, alpha: 0.001 })

    // Grid scales with the viewport, so it needs to redraw on every
    // frame to track zoom/pan. It's cheap (just lines).
    drawGrid(layers.gridLayer, width / c.viewport.zoom, height / c.viewport.zoom)
    // Only rebuild edges/nodes when the data they render has actually
    // changed. Recreating children on every frame destroys the
    // per-child event listeners (pointerdown, globalpointermove,
    // pointerup) mid-gesture, breaking drags and selections. The
    // signatures include ids, positions, titles, types, and
    // selection/dim state — the visible chrome.
    const edgeSig = computeEdgeSignature(
      graphEdgesRef.current,
      c.selectedEdgeIds,
      c.focusView.dimmedEdgeIds,
    )
    if (edgeSig !== lastEdgeSignature) {
      lastEdgeSignature = edgeSig
      drawEdges(layers.edgeLayer, graphEdgesRef.current, nodesByIdRef.current, {
        selectedEdgeIds: c.selectedEdgeIds,
        dimmedEdgeIds: c.focusView.dimmedEdgeIds,
        onEdgeClick: (edgeId, event) => {
          c.onEdgeClick(edgeId, event.shiftKey || event.ctrlKey || event.metaKey)
        },
        onOpenLabelEditor: (edgeId, anchor) => {
          labelEditorRef.current?.openAt(edgeId, anchor)
        },
        onEdgeContextMenu: c.onEdgeContextMenu,
        edgeHitLayer,
        labelHitLayer,
      })
    }
    const nodeSig = computeNodeSignature(
      graphNodesRef.current,
      c.selectedNodeIds,
      c.focusView.dimmedNodeIds,
    )
    if (nodeSig !== lastNodeSignature) {
      lastNodeSignature = nodeSig
      drawNodes(layers.nodeLayer, graphNodesRef.current, c.selectedNodeIds, {
        dimmedNodeIds: c.focusView.dimmedNodeIds,
      })
      // Children were just created; mark them as fresh so the
      // listener attachment loop can run once.
      needsListenerAttachment = true
    }

    // Port hover-visibility pass. Port circles are shown at low
    // alpha by default (0.18) and faded in to 1.0 when their parent
    // node container is hovered. The hovered node id is tracked
    // outside the per-frame redraw so it survives the child
    // re-creation.
    const hoveredNodeId = hoveredNodeIdRef.current
    for (const nodeChild of layers.nodeLayer.children) {
      const isHovered = (nodeChild as { label?: string }).label === hoveredNodeId
      for (const sub of (nodeChild as { children?: { label?: string; alpha?: number; visible?: boolean }[] }).children ?? []) {
        if (sub.label && sub.label.startsWith('port-circle:')) {
          const desiredAlpha = c.connectorMode || isHovered ? 1 : 0.18
          if ((sub.alpha ?? 1) !== desiredAlpha) {
            sub.alpha = desiredAlpha
          }
        }
      }
    }

    // Attach events to nodes and ports — only when the children
    // were just recreated. Re-attaching every frame strips the
    // per-child listeners mid-gesture, which causes the subsequent
    // globalpointermove to fire on a freshly-bound handler whose
    // closure was just rebuilt — the in-flight drag (which is
    // tracked in a stable object) still works in principle, but
    // removing listeners every frame also clears Pixi's internal
    // _allInteractiveElements cache, which is what pointermove uses
    // to find the target. Skipping re-attachment when nothing
    // changed keeps the cache stable and the drag intact.
    if (!needsListenerAttachment) return
    needsListenerAttachment = false
    for (const child of layers.nodeLayer.children) {
      const label = (child as { label?: string }).label
      if (!label) continue

      // Remove existing listeners to avoid duplicates (only on fresh
      // children — the parent block already gated this).
      child.removeAllListeners()

      if (label.startsWith('port:')) {
        const sourcePortId = label.replace('port:', '')
        attachPortListeners(child, sourcePortId)
        continue
      }

      attachNodeListeners(child, label)
    }
  }

  // Run one initial redraw so the canvas is rendered before the
  // first ticker frame, then attach the ticker.
  redraw()
  const ticker = () => redraw()
  stage.app.ticker.add(ticker)

  return {
    destroy: () => {
      stage.app.ticker.remove(ticker)
    },
  }
}
