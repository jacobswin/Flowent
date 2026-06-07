import { Container, Graphics, Text } from 'pixi.js'
import type { GraphEdge, GraphNode } from '../canvasTypes'
import { sampleBezierMidpoint } from '../routing/edgeLabelAnchor'

export interface DrawEdgesOptions {
  preview?: boolean
  selected?: boolean
  selectedEdgeIds?: Set<string>
  dimmedEdgeIds?: Set<string>
  onEdgeClick?: (edgeId: string, event: { shiftKey: boolean; ctrlKey: boolean; metaKey: boolean }) => void
  onOpenLabelEditor?: (edgeId: string, anchor: { x: number; y: number }) => void
}

function getPortPosition(node: GraphNode, portId: string): { x: number; y: number } {
  const port = node.ports.find((p) => p.id === portId)
  const side = port?.side ?? 'bottom'

  switch (side) {
    case 'top':
      return { x: node.x + node.width / 2, y: node.y }
    case 'right':
      return { x: node.x + node.width, y: node.y + node.height / 2 }
    case 'left':
      return { x: node.x, y: node.y + node.height / 2 }
    case 'bottom':
    default:
      return { x: node.x + node.width / 2, y: node.y + node.height }
  }
}

/**
 * Compute the two arrowhead endpoints that the renderer uses to cap an edge
 * with a small triangle. Exported so the arrow placement can be unit-tested
 * without spinning up a Pixi stage.
 */
export function getArrowPoints(
  from: { x: number; y: number },
  to: { x: number; y: number },
  cp2: { x: number; y: number },
  size = 8,
): { arrow1: { x: number; y: number }; arrow2: { x: number; y: number } } {
  const angle = Math.atan2(to.y - cp2.y, to.x - cp2.x)
  return {
    arrow1: {
      x: to.x - size * Math.cos(angle - Math.PI / 6),
      y: to.y - size * Math.sin(angle - Math.PI / 6),
    },
    arrow2: {
      x: to.x - size * Math.cos(angle + Math.PI / 6),
      y: to.y - size * Math.sin(angle + Math.PI / 6),
    },
  }
}

const EDGE_STROKE = 0xc4c4c6
const EDGE_WIDTH = 1.5
const EDGE_SELECTED_STROKE = 0x0071e3
const EDGE_SELECTED_WIDTH = 2.5
const EDGE_HIT_WIDTH = 12

function drawRoute(graphics: Graphics, points: { from: { x: number; y: number }; to: { x: number; y: number }; cp1: { x: number; y: number }; cp2: { x: number; y: number } }, options: DrawEdgesOptions & { widthOverride?: number } = {}): void {
  const color = options.selected ? EDGE_SELECTED_STROKE : EDGE_STROKE
  const width = options.widthOverride ?? (options.selected ? EDGE_SELECTED_WIDTH : EDGE_WIDTH)
  graphics.stroke({ color, width })
  graphics.moveTo(points.from.x, points.from.y)
  graphics.bezierCurveTo(points.cp1.x, points.cp1.y, points.cp2.x, points.cp2.y, points.to.x, points.to.y)
}

function drawArrow(graphics: Graphics, points: { from: { x: number; y: number }; to: { x: number; y: number }; cp1: { x: number; y: number }; cp2: { x: number; y: number } }, options: DrawEdgesOptions & { widthOverride?: number } = {}): void {
  const color = options.selected ? EDGE_SELECTED_STROKE : EDGE_STROKE
  const width = options.widthOverride ?? (options.selected ? EDGE_SELECTED_WIDTH : EDGE_WIDTH)
  const { arrow1, arrow2 } = getArrowPoints(points.from, points.to, points.cp2)
  graphics.stroke({ color, width })
  graphics.moveTo(points.to.x, points.to.y)
  graphics.lineTo(arrow1.x, arrow1.y)
  graphics.moveTo(points.to.x, points.to.y)
  graphics.lineTo(arrow2.x, arrow2.y)
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

  for (const edge of edges) {
    const source = nodesById.get(edge.sourceNodeId)
    const target = nodesById.get(edge.targetNodeId)
    if (!source || !target) continue

    const from = getPortPosition(source, edge.sourcePortId)
    const to = getPortPosition(target, edge.targetPortId)

    const selected = options.selectedEdgeIds?.has(edge.id) ?? false
    const dimmed = options.dimmedEdgeIds?.has(edge.id) ?? false
    const points = {
      from,
      to,
      cp1: { x: from.x + (to.x - from.x) * 0.25, y: from.y },
      cp2: { x: from.x + (to.x - from.x) * 0.75, y: to.y },
    }

    // Visible curve and arrow
    const curve = new Graphics()
    curve.label = `edge:${edge.id}`
    ;(curve as Graphics & { eventMode?: string }).eventMode = 'none'
    curve.alpha = dimmed ? 0.22 : 1
    drawRoute(curve, points, { ...options, selected })
    drawArrow(curve, points, { ...options, selected })
    layer.addChild(curve)

    // Wider hit area on top so the curve never blocks pointer events.
    // The hit area is invisible (alpha 0) but still receives Pixi events.
    const hit = new Graphics()
    hit.label = `edge-hit:${edge.id}`
    ;(hit as Graphics & { eventMode?: string; cursor?: string }).eventMode = 'static'
    ;(hit as Graphics & { eventMode?: string; cursor?: string }).cursor = 'pointer'
    drawRoute(hit, points, { ...options, widthOverride: EDGE_HIT_WIDTH })
    drawArrow(hit, points, { ...options, widthOverride: EDGE_HIT_WIDTH })
    hit.alpha = 0.001
    if (options.onEdgeClick) {
      hit.on('pointertap', (event) => {
        options.onEdgeClick?.(edge.id, {
          shiftKey: event.shiftKey,
          ctrlKey: event.ctrlKey,
          metaKey: event.metaKey,
        })
      })
    }
    layer.addChild(hit)

    if (edge.label) {
      const label = new Text({
        text: edge.label,
        style: {
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", "Segoe UI", sans-serif',
          fontSize: 11,
          fontWeight: '600',
          fill: selected ? 0x0071e3 : 0x475569,
        },
      })
      // Place the label at the cubic-bezier midpoint. We sample the
      // visible curve at t=0.5 so the label sits on what the user
      // actually sees, rather than on the control-point segments (which
      // are non-orthogonal and would mislead the segment-based anchor).
      const labelCenter = sampleBezierMidpoint(points)
      const labelWidth = Math.max(label.width, 16)
      const labelHeight = Math.max(label.height, 16)
      label.x = labelCenter.x - labelWidth / 2
      label.y = labelCenter.y - labelHeight / 2
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
      // inline label editor positioned over the label. Pixi has no native
      // dblclick, so we approximate it by comparing timestamps on consecutive
      // pointertap events.
      const labelPad = new Graphics()
      labelPad.label = `edge-label-hit:${edge.id}`
      labelPad.alpha = 0.001
      labelPad.rect(label.x - 4, label.y - 2, labelWidth + 8, labelHeight + 4)
      labelPad.fill({ color: 0x000000 })
      ;(labelPad as Graphics & { eventMode?: string; cursor?: string }).eventMode = 'static'
      ;(labelPad as Graphics & { eventMode?: string; cursor?: string }).cursor = 'pointer'
      let lastLabelTap = 0
      if (options.onEdgeClick) {
        labelPad.on('pointertap', (event) => {
          event.stopPropagation?.()
          const now = Date.now()
          const isDoubleTap = now - lastLabelTap < 350
          lastLabelTap = now
          if (isDoubleTap && options.onOpenLabelEditor) {
            options.onOpenLabelEditor(edge.id, {
              // labelPad lives in world coords (inside the same container as
              // nodes), so the pad's local bounds are world-space. The host
              // is responsible for converting to viewport/screen coords.
              x: label.x + labelWidth / 2,
              y: label.y + labelHeight / 2,
            })
            return
          }
          options.onEdgeClick?.(edge.id, {
            shiftKey: event.shiftKey,
            ctrlKey: event.ctrlKey,
            metaKey: event.metaKey,
          })
        })
      }
      layer.addChild(labelPad)
    }
  }
}
