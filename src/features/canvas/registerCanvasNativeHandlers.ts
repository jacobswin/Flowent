import type { Graphics } from 'pixi.js'
import type { ConnectionCreateRequest, GraphEdge, GraphNode } from './canvasTypes'
import { getEdgeControlPoints } from './render/edgeGeometry'
import { getPortPosition } from './render/drawEdges'

interface CanvasLike {
  viewport: { x: number; y: number; zoom: number }
  connectorMode: boolean
  selectNodesInRect: (x1: number, y1: number, x2: number, y2: number) => void
  onPaneClick: () => void
  zoomAt: (factor: number, screenX: number, screenY: number) => void
  panBy: (dx: number, dy: number) => void
  moveSelectedNodes: (dx: number, dy: number) => void
  onNodeClick: (nodeId: string, additive: boolean) => void
  onEdgeClick: (edgeId: string, additive: boolean) => void
  openEditor: (nodeId: string) => void
  onConnect: (sourceNodeId: string, targetNodeId: string, sourcePortId?: string, targetPortId?: string) => void
  startConnection: (nodeId: string, portId: string) => void
  cancelConnection: () => void
  openConnectionCreateMenu: (request: ConnectionCreateRequest) => void
}

export interface RegisterCanvasNativeHandlersArgs {
  host: HTMLDivElement
  pixiCanvasEl: HTMLCanvasElement
  hitArea: Graphics
  marqueeRect: Graphics
  graphNodesRef: { current: GraphNode[] }
  graphEdgesRef: { current: GraphEdge[] }
  getCanvas: () => CanvasLike
}

export interface CanvasNativeHandlerRegistration {
  getSpaceDown: () => boolean
  destroy: () => void
}

export function registerCanvasNativeHandlers(args: RegisterCanvasNativeHandlersArgs): CanvasNativeHandlerRegistration {
  const {
    host,
    pixiCanvasEl,
    hitArea,
    marqueeRect,
    graphNodesRef,
    graphEdgesRef,
    getCanvas,
  } = args

  let spaceDown = false

  const marqueeState: { dragging: boolean; claimed: boolean; startX: number; startY: number } = {
    dragging: false,
    claimed: false,
    startX: 0,
    startY: 0,
  }

  const nodeDragState: { dragging: boolean; startX: number; startY: number; nodeId: string | null } = {
    dragging: false,
    startX: 0,
    startY: 0,
    nodeId: null,
  }

  const clickConnectionState: { sourceNodeId: string | null; sourcePortId: string | null } = {
    sourceNodeId: null,
    sourcePortId: null,
  }

  const connectionDragState: {
    active: boolean
    moved: boolean
    sourceNodeId: string | null
    sourcePortId: string | null
    startX: number
    startY: number
  } = {
    active: false,
    moved: false,
    sourceNodeId: null,
    sourcePortId: null,
    startX: 0,
    startY: 0,
  }

  const panState: {
    dragging: boolean
    pointerId: number | null
    startX: number
    startY: number
    lastX: number
    lastY: number
    moved: boolean
    button: number
  } = {
    dragging: false,
    pointerId: null,
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,
    moved: false,
    button: 0,
  }

  let suppressNextContextMenu = false
  let lastHandledPanMoveEvent: PointerEvent | null = null
  const PAN_START_THRESHOLD = 3
  const CONNECTION_DRAG_THRESHOLD = 4

  const screenToWorld = (screenX: number, screenY: number) => {
    const rect = pixiCanvasEl.getBoundingClientRect()
    const c = getCanvas()
    return {
      x: (screenX - rect.left - c.viewport.x) / c.viewport.zoom,
      y: (screenY - rect.top - c.viewport.y) / c.viewport.zoom,
    }
  }

  const eventToCanvasPoint = (event: Pick<PointerEvent | WheelEvent, 'clientX' | 'clientY'>) => {
    const rect = pixiCanvasEl.getBoundingClientRect()
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    }
  }

  const clearClickConnection = () => {
    clickConnectionState.sourceNodeId = null
    clickConnectionState.sourcePortId = null
  }

  const clearConnectionDrag = () => {
    connectionDragState.active = false
    connectionDragState.moved = false
    connectionDragState.sourceNodeId = null
    connectionDragState.sourcePortId = null
  }

  const clearConnectionGesture = () => {
    clearClickConnection()
    clearConnectionDrag()
    getCanvas().cancelConnection()
  }

  const sourcePortAllowsConnectedNodeMenu = (nodeId: string, portId: string) => {
    const sourceNode = graphNodesRef.current.find((node) => node.id === nodeId)
    const sourcePort = sourceNode?.ports.find((port) => port.id === portId)
    return sourcePort?.side === 'right'
  }

  const buildConnectionCreateRequest = (
    sourceNodeId: string,
    sourcePortId: string,
    event: Pick<PointerEvent | MouseEvent, 'clientX' | 'clientY'>,
  ): ConnectionCreateRequest => ({
    sourceNodeId,
    sourcePortId,
    worldPosition: screenToWorld(event.clientX, event.clientY),
    screenPosition: eventToCanvasPoint(event),
  })

  const isCanvasTarget = (event: Event) => {
    const target = event.target as HTMLElement | null
    return !target || target === host || target.tagName === 'CANVAS'
  }

  const isOverNodeOrPort = (event: PointerEvent) => {
    const c = getCanvas()
    const point = eventToCanvasPoint(event)
    return Boolean(
      findPortAtPosition(point.x, point.y, graphNodesRef.current, c.viewport) ||
        findNodeAtPosition(point.x, point.y, graphNodesRef.current, '', c.viewport),
    )
  }

  const isOverEdge = (event: PointerEvent) => {
    const c = getCanvas()
    const point = eventToCanvasPoint(event)
    return Boolean(findEdgeAtPosition(point.x, point.y, graphEdgesRef.current, graphNodesRef.current, c.viewport))
  }

  const shouldStartPan = (event: PointerEvent) => {
    if (!isCanvasTarget(event)) return false
    if (event.button === 1 || event.button === 2) return true
    if (event.button !== 0) return false
    if (spaceDown) return true
    if (event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) return false
    return !isOverNodeOrPort(event) && !isOverEdge(event)
  }

  const onNativePanDown = (event: PointerEvent) => {
    if (!shouldStartPan(event)) return
    event.preventDefault()
    if (event.button === 2) {
      suppressNextContextMenu = true
    }
    panState.dragging = true
    panState.pointerId = typeof event.pointerId === 'number' ? event.pointerId : null
    panState.startX = event.clientX
    panState.startY = event.clientY
    panState.lastX = event.clientX
    panState.lastY = event.clientY
    panState.moved = false
    panState.button = event.button
    marqueeState.claimed = true
    hitArea.cursor = 'grabbing'
    try {
      if (panState.pointerId !== null) {
        pixiCanvasEl.setPointerCapture(panState.pointerId)
      }
    } catch {
      // Pointer capture is best-effort; window/document move fallbacks below keep panning alive.
    }
  }

  const onNativePanMove = (event: PointerEvent) => {
    if (!panState.dragging) return
    if (lastHandledPanMoveEvent === event) return
    lastHandledPanMoveEvent = event
    event.preventDefault()
    const totalDx = event.clientX - panState.startX
    const totalDy = event.clientY - panState.startY
    if (!panState.moved && Math.hypot(totalDx, totalDy) >= PAN_START_THRESHOLD) {
      panState.moved = true
    }
    if (panState.moved) {
      const dx = event.clientX - panState.lastX
      const dy = event.clientY - panState.lastY
      if (dx !== 0 || dy !== 0) {
        getCanvas().panBy(dx, dy)
      }
    }
    panState.lastX = event.clientX
    panState.lastY = event.clientY
  }

  const onNativePanUp = (event: PointerEvent) => {
    if (!panState.dragging) return
    event.preventDefault()
    const shouldClickPane = panState.button === 0 && !panState.moved
    const pointerId = panState.pointerId
    panState.dragging = false
    panState.pointerId = null
    panState.moved = false
    hitArea.cursor = spaceDown ? 'grab' : 'default'
    try {
      if (pointerId !== null && pixiCanvasEl.hasPointerCapture(pointerId)) {
        pixiCanvasEl.releasePointerCapture(pointerId)
      }
    } catch {
      // Ignore release errors from synthetic or already-released pointer events.
    }
    if (shouldClickPane && clickConnectionState.sourceNodeId && clickConnectionState.sourcePortId) {
      const { sourceNodeId, sourcePortId } = clickConnectionState
      if (sourcePortAllowsConnectedNodeMenu(sourceNodeId, sourcePortId)) {
        getCanvas().openConnectionCreateMenu(buildConnectionCreateRequest(sourceNodeId, sourcePortId, event))
      }
      clearConnectionGesture()
      return
    }
    if (shouldClickPane) {
      getCanvas().onPaneClick()
    }
  }

  const onNativeContextMenu = (event: MouseEvent) => {
    if (!suppressNextContextMenu) return
    suppressNextContextMenu = false
    event.preventDefault()
  }

  const onNativeMarqueeDown = (event: PointerEvent) => {
    if (event.button !== 0) return
    if (spaceDown) return
    if (!event.shiftKey) return
    const target = event.target as HTMLElement | null
    if (target && target.tagName !== 'CANVAS') return
    event.preventDefault()
    const start = screenToWorld(event.clientX, event.clientY)
    marqueeState.dragging = true
    marqueeState.claimed = false
    marqueeState.startX = start.x
    marqueeState.startY = start.y
    marqueeRect.visible = true
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
    const draggedFar = Math.abs(x2 - x1) >= 5 || Math.abs(y2 - y1) >= 5
    if (marqueeState.claimed) {
      marqueeState.claimed = false
      return
    }
    const c = getCanvas()
    if (draggedFar) {
      c.selectNodesInRect(x1, y1, x2, y2)
    } else {
      c.onPaneClick()
    }
  }

  const onNativeWheel = (event: WheelEvent) => {
    const rect = host.getBoundingClientRect()
    if (
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom
    ) {
      return
    }
    event.preventDefault()
    const point = eventToCanvasPoint(event)
    let factor: number
    if (event.deltaMode === 1) {
      factor = event.deltaY < 0 ? 1.25 : 1 / 1.25
    } else if (event.deltaMode === 2) {
      factor = event.deltaY < 0 ? 1.5 : 1 / 1.5
    } else {
      const pixels = Math.abs(event.deltaY)
      factor = event.deltaY < 0 ? 1 + pixels / 200 : 1 / (1 + pixels / 200)
    }
    getCanvas().zoomAt(factor, point.x, point.y)
  }

  const onWindowPanMove = (event: PointerEvent) => onNativePanMove(event)
  const onWindowPanUp = (event: PointerEvent) => onNativePanUp(event)
  const onDocumentPanMove = (event: PointerEvent) => onNativePanMove(event)
  const onDocumentPanUp = (event: PointerEvent) => onNativePanUp(event)
  const onWindowPointerMove = (event: PointerEvent) => onNativeMarqueeMove(event as unknown as PointerEvent)
  const onWindowPointerUp = (event: PointerEvent) => onNativeMarqueeUp(event as unknown as PointerEvent)
  const onDocumentPointerMove = (event: PointerEvent) => onNativeMarqueeMove(event as unknown as PointerEvent)
  const onDocumentPointerUp = (event: PointerEvent) => onNativeMarqueeUp(event as unknown as PointerEvent)
  const onHostMouseMove = (event: MouseEvent) =>
    onNativeMarqueeMove({ clientX: event.clientX, clientY: event.clientY, button: 0 } as unknown as PointerEvent)
  const onHostMouseUp = (event: MouseEvent) =>
    onNativeMarqueeUp({ clientX: event.clientX, clientY: event.clientY, button: 0 } as unknown as PointerEvent)

  const onNativeNodeDown = (event: PointerEvent) => {
    if (event.button !== 0) return
    if (spaceDown) return
    if (panState.dragging) return
    const c = getCanvas()
    const rect = pixiCanvasEl.getBoundingClientRect()
    const canvasX = event.clientX - rect.left
    const canvasY = event.clientY - rect.top

    const portHit = findPortAtPosition(canvasX, canvasY, graphNodesRef.current, c.viewport)
    if (portHit) {
      event.preventDefault()
      marqueeState.claimed = true
      connectionDragState.active = true
      connectionDragState.moved = false
      connectionDragState.sourceNodeId = portHit.nodeId
      connectionDragState.sourcePortId = portHit.portId
      connectionDragState.startX = event.clientX
      connectionDragState.startY = event.clientY
      if (!clickConnectionState.sourceNodeId) {
        clickConnectionState.sourceNodeId = portHit.nodeId
        clickConnectionState.sourcePortId = portHit.portId
        c.startConnection(portHit.nodeId, portHit.portId)
      } else if (
        clickConnectionState.sourceNodeId === portHit.nodeId
      ) {
        clearConnectionGesture()
      } else {
        c.onConnect(
          clickConnectionState.sourceNodeId!,
          portHit.nodeId,
          clickConnectionState.sourcePortId!,
          portHit.portId,
        )
        clearConnectionGesture()
      }
      return
    }

    const node = findNodeAtPosition(canvasX, canvasY, graphNodesRef.current, '', c.viewport)
    if (!node) return
    marqueeState.claimed = true

    if (c.connectorMode) {
      event.preventDefault()
      const additive = event.shiftKey || event.ctrlKey || event.metaKey
      c.onNodeClick(node.id, additive)

      if (!clickConnectionState.sourceNodeId) {
        const sourcePortId = getPreferredConnectionPortId(node, 'source')
        if (!sourcePortId) return
        clickConnectionState.sourceNodeId = node.id
        clickConnectionState.sourcePortId = sourcePortId
        c.startConnection(node.id, sourcePortId)
      } else if (clickConnectionState.sourceNodeId === node.id) {
        clickConnectionState.sourceNodeId = null
        clickConnectionState.sourcePortId = null
      } else {
        const targetPortId = getPreferredConnectionPortId(node, 'target')
        if (!targetPortId) return
        c.onConnect(
          clickConnectionState.sourceNodeId,
          node.id,
          clickConnectionState.sourcePortId ?? 'out',
          targetPortId,
        )
        clickConnectionState.sourceNodeId = null
        clickConnectionState.sourcePortId = null
      }
      return
    }

    nodeDragState.dragging = true
    nodeDragState.startX = event.clientX
    nodeDragState.startY = event.clientY
    nodeDragState.nodeId = node.id
    const additive = event.shiftKey || event.ctrlKey || event.metaKey
    c.onNodeClick(node.id, additive)
    event.preventDefault()
  }

  const onNativeNodeMove = (event: PointerEvent) => {
    if (connectionDragState.active) {
      const dx = event.clientX - connectionDragState.startX
      const dy = event.clientY - connectionDragState.startY
      if (Math.hypot(dx, dy) >= CONNECTION_DRAG_THRESHOLD) {
        connectionDragState.moved = true
      }
    }

    if (!nodeDragState.dragging) return
    const c = getCanvas()
    const rect = pixiCanvasEl.getBoundingClientRect()
    const startCanvasX = nodeDragState.startX - rect.left
    const startCanvasY = nodeDragState.startY - rect.top
    const curCanvasX = event.clientX - rect.left
    const curCanvasY = event.clientY - rect.top
    const dx = (curCanvasX - startCanvasX) / c.viewport.zoom
    const dy = (curCanvasY - startCanvasY) / c.viewport.zoom
    if (Math.abs(dx) > 2 / c.viewport.zoom || Math.abs(dy) > 2 / c.viewport.zoom) {
      c.moveSelectedNodes(dx, dy)
      nodeDragState.startX = event.clientX
      nodeDragState.startY = event.clientY
    }
  }

  const onNativeNodeUp = (): void => {
    if (!nodeDragState.dragging) return
    nodeDragState.dragging = false
    nodeDragState.nodeId = null
  }

  const onNativeConnectionUp = (event: PointerEvent): void => {
    if (!connectionDragState.active) return
    if (!connectionDragState.moved) {
      clearConnectionDrag()
      return
    }

    const sourceNodeId = connectionDragState.sourceNodeId
    const sourcePortId = connectionDragState.sourcePortId
    if (!sourceNodeId || !sourcePortId) {
      clearConnectionGesture()
      return
    }

    const point = eventToCanvasPoint(event)
    const targetPort = findPortAtPosition(point.x, point.y, graphNodesRef.current, getCanvas().viewport, sourceNodeId)
    if (targetPort) {
      getCanvas().onConnect(sourceNodeId, targetPort.nodeId, sourcePortId, targetPort.portId)
      clearConnectionGesture()
      return
    }

    if (sourcePortAllowsConnectedNodeMenu(sourceNodeId, sourcePortId)) {
      getCanvas().openConnectionCreateMenu(buildConnectionCreateRequest(sourceNodeId, sourcePortId, event))
    }
    clearConnectionGesture()
  }

  const onNativeMarqueeUpWrapped = (event: PointerEvent) => {
    if (nodeDragState.dragging) return
    if (panState.dragging) return
    onNativeMarqueeUp(event)
  }

  host.addEventListener('pointerdown', onNativePanDown)
  host.addEventListener('pointermove', onNativePanMove)
  host.addEventListener('pointerup', onNativePanUp)
  host.addEventListener('pointercancel', onNativePanUp)
  host.addEventListener('contextmenu', onNativeContextMenu)
  host.addEventListener('pointerdown', onNativeMarqueeDown)
  host.addEventListener('pointermove', onNativeMarqueeMove)
  host.addEventListener('pointerup', onNativeMarqueeUp)
  host.addEventListener('pointercancel', onNativeMarqueeUp)
  host.addEventListener('mousemove', onHostMouseMove)
  host.addEventListener('mouseup', onHostMouseUp)
  host.addEventListener('wheel', onNativeWheel, { passive: false })
  window.addEventListener('pointermove', onWindowPointerMove, true)
  window.addEventListener('pointerup', onWindowPointerUp, true)
  document.addEventListener('pointermove', onDocumentPointerMove, true)
  document.addEventListener('pointerup', onDocumentPointerUp, true)
  window.addEventListener('pointermove', onWindowPanMove, true)
  window.addEventListener('pointerup', onWindowPanUp, true)
  document.addEventListener('pointermove', onDocumentPanMove, true)
  document.addEventListener('pointerup', onDocumentPanUp, true)

  host.removeEventListener('pointerup', onNativeMarqueeUp)
  host.removeEventListener('pointercancel', onNativeMarqueeUp)
  host.addEventListener('pointerup', onNativeMarqueeUpWrapped)
  host.addEventListener('pointercancel', onNativeMarqueeUpWrapped)
  host.addEventListener('pointerdown', onNativeNodeDown)
  host.addEventListener('pointermove', onNativeNodeMove)
  host.addEventListener('pointerup', onNativeNodeUp)
  host.addEventListener('pointercancel', onNativeNodeUp)
  const onHostNodeMouseMove = (event: MouseEvent) => onNativeNodeMove(event as unknown as PointerEvent)
  const onHostNodeMouseUp = (event: MouseEvent) => {
    onNativeConnectionUp(event as unknown as PointerEvent)
    onNativeNodeUp()
  }
  host.addEventListener('mousemove', onHostNodeMouseMove)
  host.addEventListener('mouseup', onHostNodeMouseUp)
  const onWindowConnectionMove = (event: PointerEvent) => onNativeNodeMove(event)
  const onWindowConnectionUp = (event: PointerEvent) => onNativeConnectionUp(event)
  const onDocumentConnectionMove = (event: PointerEvent) => onNativeNodeMove(event)
  const onDocumentConnectionUp = (event: PointerEvent) => onNativeConnectionUp(event)
  window.addEventListener('pointermove', onWindowConnectionMove, true)
  window.addEventListener('pointerup', onWindowConnectionUp, true)
  document.addEventListener('pointermove', onDocumentConnectionMove, true)
  document.addEventListener('pointerup', onDocumentConnectionUp, true)

  const onWindowKeyDown = (e: KeyboardEvent) => {
    if (e.code === 'Space' && !e.repeat) {
      spaceDown = true
      hitArea.cursor = 'grab'
    }
  }

  const onWindowKeyUp = (e: KeyboardEvent) => {
    if (e.code === 'Space') {
      spaceDown = false
      hitArea.cursor = 'default'
    }
  }

  window.addEventListener('keydown', onWindowKeyDown)
  window.addEventListener('keyup', onWindowKeyUp)

  return {
    getSpaceDown: () => spaceDown,
    destroy: () => {
      host.removeEventListener('pointerdown', onNativeMarqueeDown)
      host.removeEventListener('pointermove', onNativeMarqueeMove)
      host.removeEventListener('pointerup', onNativeMarqueeUp)
      host.removeEventListener('pointercancel', onNativeMarqueeUp)
      host.removeEventListener('pointerdown', onNativePanDown)
      host.removeEventListener('pointermove', onNativePanMove)
      host.removeEventListener('pointerup', onNativePanUp)
      host.removeEventListener('pointercancel', onNativePanUp)
      host.removeEventListener('contextmenu', onNativeContextMenu)
      host.removeEventListener('mousemove', onHostMouseMove)
      host.removeEventListener('mouseup', onHostMouseUp)
      host.removeEventListener('wheel', onNativeWheel)
      host.removeEventListener('pointerdown', onNativeNodeDown)
      host.removeEventListener('pointermove', onNativeNodeMove)
      host.removeEventListener('pointerup', onNativeNodeUp)
      host.removeEventListener('pointercancel', onNativeNodeUp)
      host.removeEventListener('mousemove', onHostNodeMouseMove)
      host.removeEventListener('mouseup', onHostNodeMouseUp)
      window.removeEventListener('pointermove', onWindowConnectionMove, true)
      window.removeEventListener('pointerup', onWindowConnectionUp, true)
      document.removeEventListener('pointermove', onDocumentConnectionMove, true)
      document.removeEventListener('pointerup', onDocumentConnectionUp, true)
      host.removeEventListener('pointerup', onNativeMarqueeUpWrapped)
      host.removeEventListener('pointercancel', onNativeMarqueeUpWrapped)
      window.removeEventListener('pointermove', onWindowPointerMove, true)
      window.removeEventListener('pointerup', onWindowPointerUp, true)
      document.removeEventListener('pointermove', onDocumentPointerMove, true)
      document.removeEventListener('pointerup', onDocumentPointerUp, true)
      window.removeEventListener('pointermove', onWindowPanMove, true)
      window.removeEventListener('pointerup', onWindowPanUp, true)
      document.removeEventListener('pointermove', onDocumentPanMove, true)
      document.removeEventListener('pointerup', onDocumentPanUp, true)
      window.removeEventListener('keydown', onWindowKeyDown)
      window.removeEventListener('keyup', onWindowKeyUp)
    },
  }
}

function getPreferredConnectionPortId(
  node: GraphNode,
  role: 'source' | 'target',
): string | null {
  const preferred = role === 'source' ? 'out' : 'in'
  return node.ports.find((port) => port.id === preferred)?.id ?? null
}

export function findNodeAtPosition(
  screenX: number,
  screenY: number,
  nodes: GraphNode[],
  excludeNodeId: string,
  viewport: { x: number; y: number; zoom: number },
): GraphNode | null {
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

export function findEdgeAtPosition(
  canvasX: number,
  canvasY: number,
  edges: GraphEdge[],
  nodes: GraphNode[],
  viewport: { x: number; y: number; zoom: number },
  thresholdPx = 14,
): string | null {
  const worldPoint = {
    x: (canvasX - viewport.x) / viewport.zoom,
    y: (canvasY - viewport.y) / viewport.zoom,
  }
  const threshold = thresholdPx / viewport.zoom
  const nodesById = new Map(nodes.map((node) => [node.id, node]))

  for (const edge of edges) {
    const points = getEdgeControlPoints(edge, nodesById)
    if (!points) continue
    let previous = getBezierPoint(points, 0)
    for (let step = 1; step <= 28; step += 1) {
      const current = getBezierPoint(points, step / 28)
      if (distanceToSegment(worldPoint, previous, current) <= threshold) {
        return edge.id
      }
      previous = current
    }
  }

  return null
}

function getBezierPoint(
  points: NonNullable<ReturnType<typeof getEdgeControlPoints>>,
  t: number,
): { x: number; y: number } {
  const u = 1 - t
  return {
    x: u * u * u * points.from.x
      + 3 * u * u * t * points.cp1.x
      + 3 * u * t * t * points.cp2.x
      + t * t * t * points.to.x,
    y: u * u * u * points.from.y
      + 3 * u * u * t * points.cp1.y
      + 3 * u * t * t * points.cp2.y
      + t * t * t * points.to.y,
  }
}

function distanceToSegment(
  point: { x: number; y: number },
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const lengthSquared = dx * dx + dy * dy
  if (lengthSquared === 0) return Math.hypot(point.x - a.x, point.y - a.y)

  const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared))
  const projection = {
    x: a.x + t * dx,
    y: a.y + t * dy,
  }
  return Math.hypot(point.x - projection.x, point.y - projection.y)
}

function findPortAtPosition(
  screenX: number,
  screenY: number,
  nodes: GraphNode[],
  viewport: { x: number; y: number; zoom: number },
  excludeNodeId = '',
): { nodeId: string; portId: string } | null {
  const worldX = (screenX - viewport.x) / viewport.zoom
  const worldY = (screenY - viewport.y) / viewport.zoom
  const HIT_RADIUS = 14

  // Iterate in reverse so the topmost rendered node wins on overlap.
  for (let i = nodes.length - 1; i >= 0; i--) {
    const node = nodes[i]
    if (node.id === excludeNodeId) continue
    for (const port of node.ports) {
      const pos = getPortPosition(node, port.id)
      const dx = pos.x - worldX
      const dy = pos.y - worldY
      if (dx * dx + dy * dy <= HIT_RADIUS * HIT_RADIUS) {
        return { nodeId: node.id, portId: port.id }
      }
    }
  }

  return null
}
