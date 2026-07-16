import type { GraphLayoutProfile, GraphNode, GraphViewport } from '../canvasTypes'

const MIN_LAYOUT_ZOOM = 0.5
const MAX_LAYOUT_ZOOM = 1
const FLOW_LEFT_INSET = 88
const SWIMLANE_LEFT_EDGE = 120
const SWIMLANE_TOP_EDGE = 100
const SWIMLANE_LEFT_INSET = 48
const SWIMLANE_TOP_INSET = 72
const LOGICAL_CANVAS_HEIGHT = 720

export function getLayoutViewport(
  nodes: GraphNode[],
  layoutProfile: GraphLayoutProfile,
  current: GraphViewport,
): GraphViewport {
  const zoom = clamp(current.zoom, MIN_LAYOUT_ZOOM, MAX_LAYOUT_ZOOM)
  if (nodes.length === 0) return { ...current, zoom }

  if (layoutProfile === 'swimlane') {
    return {
      zoom,
      x: SWIMLANE_LEFT_INSET - SWIMLANE_LEFT_EDGE * zoom,
      y: SWIMLANE_TOP_INSET - SWIMLANE_TOP_EDGE * zoom,
    }
  }

  const minX = Math.min(...nodes.map((node) => node.x))
  const minY = Math.min(...nodes.map((node) => node.y - (node.type === 'activity' ? 38 : 0)))
  const maxY = Math.max(...nodes.map((node) => node.y + node.height))
  const contentHeight = Math.max(1, maxY - minY)

  return {
    zoom,
    x: FLOW_LEFT_INSET - minX * zoom,
    y: (LOGICAL_CANVAS_HEIGHT - contentHeight * zoom) / 2 - minY * zoom,
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
