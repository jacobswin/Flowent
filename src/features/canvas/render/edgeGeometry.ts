import type { GraphEdge, GraphNode } from '../canvasTypes'
import { getPortAnchor } from '../routing/ports'

export interface EdgeControlPoints {
  from: { x: number; y: number }
  to: { x: number; y: number }
  cp1: { x: number; y: number }
  cp2: { x: number; y: number }
}

export function getEdgeControlPoints(edge: GraphEdge, nodesById: Map<string, GraphNode>): EdgeControlPoints | null {
  const source = nodesById.get(edge.sourceNodeId)
  const target = nodesById.get(edge.targetNodeId)
  if (!source || !target) return null

  const from = getPortAnchor(source, edge.sourcePortId, 'source')
  const to = getPortAnchor(target, edge.targetPortId, 'target')

  return {
    from: { x: from.x, y: from.y },
    to: { x: to.x, y: to.y },
    cp1: { x: from.x + (to.x - from.x) * 0.25, y: from.y },
    cp2: { x: from.x + (to.x - from.x) * 0.75, y: to.y },
  }
}

export function getEdgeLabelCenter(edge: GraphEdge, nodesById: Map<string, GraphNode>): { x: number; y: number } | null {
  const points = getEdgeControlPoints(edge, nodesById)
  if (!points) return null

  const t = 0.5
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
