import type { GraphEdge, GraphNode } from '../canvasTypes'
import { getPortAnchor } from '../routing/ports'
import { getEdgeLabelAnchor } from '../routing/edgeLabelAnchor'
import { routeOrthogonalEdge, type RoutePoint } from '../routing/orthogonalRouter'

export interface EdgeControlPoints {
  from: { x: number; y: number }
  to: { x: number; y: number }
  cp1: { x: number; y: number }
  cp2: { x: number; y: number }
}

export function getEdgeControlPoints(edge: GraphEdge, nodesById: Map<string, GraphNode>): EdgeControlPoints | null {
  const route = getEdgeRoutePoints(edge, nodesById)
  if (!route || route.length < 2) return null
  const from = route[0]
  const to = route[route.length - 1]
  return {
    from: { x: from.x, y: from.y },
    to: { x: to.x, y: to.y },
    cp1: { x: from.x + (to.x - from.x) * 0.25, y: from.y },
    cp2: { x: from.x + (to.x - from.x) * 0.75, y: to.y },
  }
}

export function getEdgeRoutePoints(edge: GraphEdge, nodesById: Map<string, GraphNode>): RoutePoint[] | null {
  const source = nodesById.get(edge.sourceNodeId)
  const target = nodesById.get(edge.targetNodeId)
  if (!source || !target) return null

  const from = getPortAnchor(source, edge.sourcePortId, 'source', edge.sourceAnchor)
  const to = getPortAnchor(target, edge.targetPortId, 'target', edge.targetAnchor)

  return routeOrthogonalEdge({
    source: { x: from.x, y: from.y },
    sourceSide: from.side,
    target: { x: to.x, y: to.y },
    targetSide: to.side,
    obstacles: Array.from(nodesById.values())
      .filter((node) => node.id !== source.id && node.id !== target.id)
      .map((node) => ({
        id: node.id,
        x: node.x,
        y: node.y,
        width: node.width,
        height: node.height,
      })),
  })
}

export function getEdgeLabelCenter(edge: GraphEdge, nodesById: Map<string, GraphNode>): { x: number; y: number } | null {
  const route = getEdgeRoutePoints(edge, nodesById)
  if (!route) return null
  return getEdgeLabelAnchor(route) ?? null
}
