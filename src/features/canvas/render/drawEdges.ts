import { Container, Graphics, Text } from 'pixi.js'
import type { GraphEdge, GraphNode } from '../canvasTypes'
import { edgeColorToNumber } from '../edgeColors'
import { getEdgeLabelAnchor } from '../routing/edgeLabelAnchor'
import type { RoutePoint } from '../routing/orthogonalRouter'
import { getPortAnchor } from '../routing/ports'
import { getEdgeRoutePoints } from './edgeGeometry'
import { getSelectedEdgeMetadataLines, truncateMetadataLine } from './drawEdgeMetadata'

export interface DrawEdgesOptions {
  preview?: boolean
  selected?: boolean
  selectedEdgeIds?: Set<string>
  dimmedEdgeIds?: Set<string>
  viewportZoom?: number
  onEdgeClick?: (edgeId: string, event: { shiftKey: boolean; ctrlKey: boolean; metaKey: boolean }) => void
  onEdgeContextMenu?: (edgeId: string, point: { screenX: number; screenY: number }) => void
  onOpenLabelEditor?: (edgeId: string, anchor: { x: number; y: number }) => void
  edgeHitLayer?: Container
  /**
   * Optional layer to receive the clickable label hit pads. When provided, the
   * pads are added here instead of to the main `layer` so the host can keep
   * them above other overlays (e.g. the canvas-wide hit area) for correct
   * z-ordering of label-pointer events.
   */
  labelHitLayer?: Container
}

export function getPortPosition(node: { x: number; y: number; width: number; height: number; ports: { id: string; side: string }[] }, portId: string): { x: number; y: number } {
  return getPortAnchor(node as GraphNode, portId)
}

type ArrowGeometry = {
  tip: { x: number; y: number }
  base1: { x: number; y: number }
  base2: { x: number; y: number }
}

export type RoundedRoutePathCommand =
  | { type: 'move'; point: RoutePoint }
  | { type: 'line'; point: RoutePoint }
  | { type: 'quadratic'; control: RoutePoint; point: RoutePoint }

function normalizeVector(vector: { x: number; y: number }, fallback: { x: number; y: number }): { x: number; y: number } {
  const length = Math.hypot(vector.x, vector.y)
  if (length > 0.001) return { x: vector.x / length, y: vector.y / length }
  const fallbackLength = Math.hypot(fallback.x, fallback.y)
  if (fallbackLength > 0.001) return { x: fallback.x / fallbackLength, y: fallback.y / fallbackLength }
  return { x: 1, y: 0 }
}

/**
 * Places a filled arrowhead at the visible route endpoint, with the body of
 * the arrow extending back along the final horizontal or vertical segment.
 */
export function getPolylineArrowGeometry(
  points: RoutePoint[],
  options: { tipInset?: number; length?: number; halfWidth?: number } = {},
): ArrowGeometry {
  const tipInset = options.tipInset ?? 0
  const length = options.length ?? 13
  const halfWidth = options.halfWidth ?? 5.5
  const fallbackTip = points.at(-1) ?? { x: 0, y: 0 }
  const previous = [...points].reverse().find((point) => point.x !== fallbackTip.x || point.y !== fallbackTip.y)
  const direction = normalizeVector(
    previous ? { x: fallbackTip.x - previous.x, y: fallbackTip.y - previous.y } : { x: 0, y: 0 },
    { x: 1, y: 0 },
  )
  const tip = {
    x: fallbackTip.x - direction.x * tipInset,
    y: fallbackTip.y - direction.y * tipInset,
  }
  const baseCenter = {
    x: tip.x - direction.x * length,
    y: tip.y - direction.y * length,
  }
  const normal = { x: -direction.y, y: direction.x }
  return {
    tip,
    base1: {
      x: baseCenter.x + normal.x * halfWidth,
      y: baseCenter.y + normal.y * halfWidth,
    },
    base2: {
      x: baseCenter.x - normal.x * halfWidth,
      y: baseCenter.y - normal.y * halfWidth,
    },
  }
}

export function getArrowGeometry(
  points: {
    from: { x: number; y: number }
    to: { x: number; y: number }
  },
  options: { tipInset?: number; length?: number; halfWidth?: number } = {},
): ArrowGeometry {
  return getPolylineArrowGeometry([points.from, points.to], options)
}

/**
 * Back-compatible helper for older tests/callers that only need the two base
 * points of the arrowhead.
 */
export function getArrowPoints(
  from: { x: number; y: number },
  to: { x: number; y: number },
  _cp2: { x: number; y: number },
  size = 8,
): { arrow1: { x: number; y: number }; arrow2: { x: number; y: number } } {
  const arrow = getArrowGeometry(
    {
      from,
      to,
    },
    {
      length: size,
      halfWidth: size * 0.42,
    },
  )
  return { arrow1: arrow.base1, arrow2: arrow.base2 }
}

const EDGE_STROKE = 0x111827
const EDGE_WIDTH = 1.5
const EDGE_SELECTED_STROKE = 0x0071e3
const EDGE_SELECTED_WIDTH = 2.5
const EDGE_SELECTED_HALO_STROKE = 0x93c5fd
const EDGE_SELECTED_HALO_WIDTH = 6
const EDGE_HIT_WIDTH = 28
const EDGE_LABEL_MAX_CHARS = 23
const EDGE_CORNER_RADIUS_SCREEN_PX = 18
const EDGE_CORNER_RADIUS_MIN = 6
const EDGE_CORNER_RADIUS_MAX = 28

export function getDisplayEdgeLabel(label?: string): string | null {
  const normalized = label?.trim() ?? ''
  if (normalized.length === 0) return null
  if (normalized.length <= EDGE_LABEL_MAX_CHARS) return normalized
  return `${normalized.slice(0, EDGE_LABEL_MAX_CHARS - 1)}…`
}

export function getEdgeStrokeColor(edge: Pick<GraphEdge, 'color'>): number {
  return edgeColorToNumber(edge.color)
}

export function getSelectedEdgeMetadataText(edge: Pick<GraphEdge, 'fromRole' | 'toRole' | 'artifact'>): string {
  // Back-compat helper kept for tests and any older callers that
  // still expect a single-line metadata summary.
  return getSelectedEdgeMetadataLines(edge).join(' · ')
}

export function getRoundedCornerRadius(viewportZoom = 1): number {
  const safeZoom = Math.max(0.05, viewportZoom)
  const radius = EDGE_CORNER_RADIUS_SCREEN_PX / safeZoom
  return Math.min(EDGE_CORNER_RADIUS_MAX, Math.max(EDGE_CORNER_RADIUS_MIN, radius))
}

export function getRoundedOrthogonalPath(points: RoutePoint[], requestedRadius: number): RoundedRoutePathCommand[] {
  if (points.length === 0) return []
  if (points.length === 1) return [{ type: 'move', point: points[0] }]

  const commands: RoundedRoutePathCommand[] = [{ type: 'move', point: points[0] }]

  for (let index = 1; index < points.length - 1; index += 1) {
    const previous = points[index - 1]
    const corner = points[index]
    const next = points[index + 1]
    const incoming = normalizeVector(
      { x: corner.x - previous.x, y: corner.y - previous.y },
      { x: 1, y: 0 },
    )
    const outgoing = normalizeVector(
      { x: next.x - corner.x, y: next.y - corner.y },
      { x: 1, y: 0 },
    )
    const incomingLength = Math.hypot(corner.x - previous.x, corner.y - previous.y)
    const outgoingLength = Math.hypot(next.x - corner.x, next.y - corner.y)
    const isTurn = Math.abs(incoming.x * outgoing.x + incoming.y * outgoing.y) < 0.001
    const radius = Math.min(requestedRadius, incomingLength / 2, outgoingLength / 2)

    if (!isTurn || radius < 1) {
      commands.push({ type: 'line', point: corner })
      continue
    }

    commands.push({
      type: 'line',
      point: {
        x: corner.x - incoming.x * radius,
        y: corner.y - incoming.y * radius,
      },
    })
    commands.push({
      type: 'quadratic',
      control: corner,
      point: {
        x: corner.x + outgoing.x * radius,
        y: corner.y + outgoing.y * radius,
      },
    })
  }

  commands.push({ type: 'line', point: points[points.length - 1] })
  return commands
}

function drawRoute(graphics: Graphics, points: RoutePoint[], options: DrawEdgesOptions & { widthOverride?: number; colorOverride?: number; alphaOverride?: number } = {}): void {
  if (points.length < 2) return
  const color = options.colorOverride ?? EDGE_STROKE
  const width = options.widthOverride ?? (options.selected ? EDGE_SELECTED_WIDTH : EDGE_WIDTH)
  const alpha = options.alphaOverride ?? 1
  const path = getRoundedOrthogonalPath(points, getRoundedCornerRadius(options.viewportZoom))

  for (const command of path) {
    if (command.type === 'move') {
      graphics.moveTo(command.point.x, command.point.y)
    } else if (command.type === 'line') {
      graphics.lineTo(command.point.x, command.point.y)
    } else {
      graphics.quadraticCurveTo(
        command.control.x,
        command.control.y,
        command.point.x,
        command.point.y,
      )
    }
  }
  graphics.stroke({ color, width, alpha, cap: 'round', join: 'round' })
}

function drawArrow(graphics: Graphics, points: RoutePoint[], options: DrawEdgesOptions & { colorOverride?: number; alphaOverride?: number } = {}): void {
  if (points.length < 2) return
  const color = options.colorOverride ?? EDGE_STROKE
  const alpha = options.alphaOverride ?? 1
  const arrow = getPolylineArrowGeometry(points)
  graphics.moveTo(arrow.tip.x, arrow.tip.y)
  graphics.lineTo(arrow.base1.x, arrow.base1.y)
  graphics.lineTo(arrow.base2.x, arrow.base2.y)
  graphics.closePath()
  graphics.fill({ color, alpha })
}

function getPointerScreenPoint(event: unknown): { screenX: number; screenY: number } {
  const pointer = event as {
    screen?: { x: number; y: number }
    screenX?: number
    screenY?: number
    global?: { x: number; y: number }
    globalX?: number
    globalY?: number
  }

  if (pointer.screen) {
    return { screenX: pointer.screen.x, screenY: pointer.screen.y }
  }

  return {
    screenX: pointer.screenX ?? pointer.globalX ?? pointer.global?.x ?? 0,
    screenY: pointer.screenY ?? pointer.globalY ?? pointer.global?.y ?? 0,
  }
}

function getPointerModifiers(event: unknown): { shiftKey: boolean; ctrlKey: boolean; metaKey: boolean } {
  const pointer = event as { shiftKey?: boolean; ctrlKey?: boolean; metaKey?: boolean }
  return {
    shiftKey: Boolean(pointer.shiftKey),
    ctrlKey: Boolean(pointer.ctrlKey),
    metaKey: Boolean(pointer.metaKey),
  }
}

function stopPointerEvent(event: unknown): void {
  const pointer = event as { stopPropagation?: () => void; preventDefault?: () => void }
  pointer.preventDefault?.()
  pointer.stopPropagation?.()
}

export function drawEdges(
  layer: Container,
  edges: GraphEdge[],
  nodesById: Map<string, GraphNode>,
  optionsOrSelected: DrawEdgesOptions | string | null = null,
): void {
  // Back-compat: prior callers passed a single edge id or null as the fourth
  // argument. Accept that shape and translate it to the new options object.
  const options: DrawEdgesOptions =
    optionsOrSelected === null || typeof optionsOrSelected === 'string'
      ? (optionsOrSelected ? { selectedEdgeIds: new Set([optionsOrSelected]) } : {})
      : optionsOrSelected

  layer.removeChildren()
  // If a dedicated overlay layer is used for label hit pads, clear it
  // too before repopulating. Otherwise stale pads from the previous
  // frame would remain interactive at their old positions.
  options.edgeHitLayer?.removeChildren()
  options.labelHitLayer?.removeChildren()

  for (const edge of edges) {
    const source = nodesById.get(edge.sourceNodeId)
    const target = nodesById.get(edge.targetNodeId)
    if (!source || !target) continue

    const route = getEdgeRoutePoints(edge, nodesById)
    if (!route) continue

    const selected = options.selectedEdgeIds?.has(edge.id) ?? false
    const dimmed = options.dimmedEdgeIds?.has(edge.id) ?? false
    const strokeColor = getEdgeStrokeColor(edge)

    // Visible curve and arrow
    // Draw the selected-edge halo first so it sits underneath the main stroke.
    if (selected) {
      const halo = new Graphics()
      halo.label = `edge-halo:${edge.id}`
      halo.eventMode = 'none'
      halo.alpha = dimmed ? 0.22 : 1
      drawRoute(halo, route, {
        ...options,
        widthOverride: EDGE_SELECTED_HALO_WIDTH,
        colorOverride: EDGE_SELECTED_HALO_STROKE,
        alphaOverride: 0.9,
      })
      layer.addChild(halo)

      const haloArrow = new Graphics()
      haloArrow.label = `edge-halo-arrow:${edge.id}`
      haloArrow.eventMode = 'none'
      haloArrow.alpha = dimmed ? 0.22 : 1
      drawArrow(haloArrow, route, {
        ...options,
        colorOverride: EDGE_SELECTED_HALO_STROKE,
        alphaOverride: 0.9,
      })
      layer.addChild(haloArrow)
    }

    const curve = new Graphics()
    curve.label = `edge:${edge.id}`
    ;(curve as Graphics & { eventMode?: string }).eventMode = 'none'
    curve.alpha = dimmed ? 0.22 : 1
    drawRoute(curve, route, { ...options, selected, colorOverride: strokeColor })
    layer.addChild(curve)

    const arrow = new Graphics()
    arrow.label = `edge-arrow:${edge.id}`
    ;(arrow as Graphics & { eventMode?: string }).eventMode = 'none'
    arrow.alpha = dimmed ? 0.22 : 1
    drawArrow(arrow, route, { ...options, selected, colorOverride: strokeColor })
    layer.addChild(arrow)

    // Wider hit area on top so the curve never blocks pointer events.
    // The hit area is invisible (alpha 0) but still receives Pixi events.
    const hit = new Graphics()
    hit.label = `edge-hit:${edge.id}`
    ;(hit as Graphics & { eventMode?: string; cursor?: string }).eventMode = 'static'
    ;(hit as Graphics & { eventMode?: string; cursor?: string }).cursor = 'pointer'
    drawRoute(hit, route, { ...options, widthOverride: EDGE_HIT_WIDTH, colorOverride: strokeColor })
    hit.alpha = 0
    if (options.onEdgeClick) {
      hit.on('pointertap', (event) => {
        options.onEdgeClick?.(edge.id, getPointerModifiers(event))
      })
    }
    if (options.onEdgeContextMenu) {
      let lastContextMenuAt = 0
      const openContextMenu = (event: unknown) => {
        const now = Date.now()
        if (now - lastContextMenuAt < 50) return
        lastContextMenuAt = now
        stopPointerEvent(event)
        options.onEdgeContextMenu?.(edge.id, getPointerScreenPoint(event))
      }
      hit.on('rightclick', openContextMenu)
      hit.on('rightdown', openContextMenu)
    }
    ;(options.edgeHitLayer ?? layer).addChild(hit)

    {
      const labelCenter = getEdgeLabelAnchor(route) ?? route[Math.floor(route.length / 2)]
      const labelText = getDisplayEdgeLabel(edge.label)
      let labelHeight = 0

      if (labelText) {
        const label = new Text({
          text: labelText,
          style: {
            fontFamily:
              '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", "Segoe UI", sans-serif',
            fontSize: 11,
            fontWeight: '600',
            fill: selected ? EDGE_SELECTED_STROKE : 0x475569,
          },
        })
        // Place the label at the cubic-bezier midpoint. We sample the
        // visible curve at t=0.5 so the label sits on what the user
        // actually sees, rather than on the control-point segments (which
        // are non-orthogonal and would mislead the segment-based anchor).
        const labelWidth = Math.max(label.width, 16)
        labelHeight = Math.max(label.height, 16)
        const labelX = labelCenter.x - labelWidth / 2
        const labelY = labelCenter.y - labelHeight / 2
        label.x = labelX
        label.y = labelY
        label.alpha = dimmed ? 0.22 : 1
        label.eventMode = 'none'
        layer.addChild(label)

        // A clickable hit pad sitting on top of the label so the label itself
        // selects its edge. Add the pad to the layer LAST so it sits above
        // the curve's wider hit pad, then stop the pointer event from
        // bubbling so we don't double-dispatch SelectEdge (one click = one
        // selection, one history entry, one version bump).
        //
        // We also detect a double-tap here so a quick second tap opens the
        // inline label editor positioned at the pointer. Pixi has no native
        // dblclick, so we approximate it by comparing timestamps on consecutive
        // pointertap events.
        const labelPad = new Graphics()
        labelPad.label = `edge-label-hit:${edge.id}`
        labelPad.alpha = 0
        labelPad.rect(label.x - 4, label.y - 2, labelWidth + 8, labelHeight + 4)
        labelPad.fill({ color: 0x000000 })
        ;(labelPad as Graphics & { eventMode?: string; cursor?: string }).eventMode = 'static'
        ;(labelPad as Graphics & { eventMode?: string; cursor?: string }).cursor = 'pointer'
        if (options.onEdgeClick) {
          labelPad.on('pointertap', (event) => {
            stopPointerEvent(event)
            options.onEdgeClick?.(edge.id, getPointerModifiers(event))
          })
        }
        ;(options.labelHitLayer ?? layer).addChild(labelPad)
      }

      if (selected) {
        const metadataLines = getSelectedEdgeMetadataLines(edge)
        metadataLines.forEach((line, index) => {
          const meta = new Text({
            text: truncateMetadataLine(line, 32),
            style: {
              fontFamily:
                '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", "Segoe UI", sans-serif',
              fontSize: index === 0 ? 10 : 9,
              fontWeight: index === 0 ? '600' : '500',
              fill: index === 0 ? 0x475569 : 0x64748b,
            },
          })
          meta.x = labelCenter.x - meta.width / 2
          meta.y = labelCenter.y + (labelText ? labelHeight / 2 + 4 : 8) + index * 14
          meta.alpha = dimmed ? 0.22 : 1
          meta.eventMode = 'none'
          layer.addChild(meta)
        })
      }

      const workProductCount = edge.assetSummary?.workProductCount ?? edge.workProductIds?.length ?? 0
      if (workProductCount > 0) {
        const chip = new Text({
          text: `${workProductCount} work products`,
          style: {
            fontFamily:
              '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", "Segoe UI", sans-serif',
            fontSize: 10,
            fontWeight: '600',
            fill: selected ? EDGE_SELECTED_STROKE : 0x334155,
          },
        })
        const chipWidth = chip.width + 14
        const chipHeight = 18
        const bg = new Graphics()
        bg.roundRect(labelCenter.x - chipWidth / 2, labelCenter.y - 32, chipWidth, chipHeight, 9)
        bg.fill(0xeef2ff)
        bg.stroke({ color: 0xa5b4fc, width: 1 })
        bg.alpha = dimmed ? 0.22 : 1
        chip.x = labelCenter.x - chip.width / 2
        chip.y = labelCenter.y - 30
        chip.alpha = dimmed ? 0.22 : 1
        chip.eventMode = 'none'
        layer.addChild(bg)
        layer.addChild(chip)
      }
    }
  }
}
