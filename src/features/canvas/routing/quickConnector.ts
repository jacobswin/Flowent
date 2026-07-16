import type { ConnectionCreateRequest, EdgeEndpointAnchor, GraphNode, GraphViewport } from '../canvasTypes'
import { getPortAnchor } from './ports'

type Point = { x: number; y: number }

const DEFAULT_NEXT_NODE_DISTANCE = 240

export function getQuickConnectorSourcePortId(node: GraphNode): string | null {
  const outPort = node.ports.find((port) => port.id === 'out' && port.side === 'right')
  if (outPort) return outPort.id

  return node.ports.find((port) => port.side === 'right')?.id ?? null
}

export function worldToScreen(point: Point, viewport: GraphViewport): Point {
  return {
    x: point.x * viewport.zoom + viewport.x,
    y: point.y * viewport.zoom + viewport.y,
  }
}

export function screenToWorld(point: Point, viewport: GraphViewport): Point {
  return {
    x: (point.x - viewport.x) / viewport.zoom,
    y: (point.y - viewport.y) / viewport.zoom,
  }
}

export function buildQuickConnectorCreateRequest(
  node: GraphNode,
  viewport: GraphViewport,
  options: {
    sourcePortId?: string
    sourceAnchor?: EdgeEndpointAnchor
    worldPosition?: Point
    screenPosition?: Point
    clientPosition?: Point
    defaultDistance?: number
  } = {},
): ConnectionCreateRequest | null {
  const sourcePortId = options.sourcePortId ?? getQuickConnectorSourcePortId(node)
  if (!sourcePortId) return null

  const anchor = getPortAnchor(node, sourcePortId, 'source')
  const worldPosition = options.worldPosition ?? {
    x: anchor.x + (options.defaultDistance ?? DEFAULT_NEXT_NODE_DISTANCE),
    y: anchor.y,
  }

  return {
    sourceNodeId: node.id,
    sourcePortId,
    ...(options.sourceAnchor ? { sourceAnchor: options.sourceAnchor } : {}),
    worldPosition,
    screenPosition: options.screenPosition ?? worldToScreen(worldPosition, viewport),
    clientPosition: options.clientPosition,
  }
}

export function findQuickConnectorTargetNode(
  nodes: GraphNode[],
  worldPoint: Point,
  excludeNodeId: string,
): GraphNode | null {
  for (let i = nodes.length - 1; i >= 0; i--) {
    const node = nodes[i]
    if (node.id === excludeNodeId) continue
    if (
      worldPoint.x >= node.x &&
      worldPoint.x <= node.x + node.width &&
      worldPoint.y >= node.y &&
      worldPoint.y <= node.y + node.height
    ) {
      return node
    }
  }

  return null
}
