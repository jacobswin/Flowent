import type { EdgeEndpointAnchor, GraphNode, PortSide } from '../canvasTypes'

export interface PortAnchor {
  x: number
  y: number
  side: PortSide
}

export interface BoundaryAnchorHit {
  id: string
  side: PortSide
  anchor: EdgeEndpointAnchor
}

const PORT_ID_BY_SIDE: Record<PortSide, string> = {
  top: 'top',
  right: 'out',
  bottom: 'bottom',
  left: 'in',
}

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(Math.max(value, min), max)
}

export function getFallbackPortId(node: GraphNode, preferred: 'source' | 'target'): string {
  const preferredId = preferred === 'source' ? 'out' : 'in'
  const preferredPort = node.ports.find((port) => port.id === preferredId)
  if (preferredPort) return preferredPort.id

  return node.ports[0]?.id ?? preferredId
}

export function getPortSide(node: GraphNode, portId: string, preferred: 'source' | 'target' = 'source'): PortSide {
  const port = node.ports.find((candidate) => candidate.id === portId)
  if (port) return port.side

  const fallbackId = getFallbackPortId(node, preferred)
  return node.ports.find((candidate) => candidate.id === fallbackId)?.side ?? (preferred === 'target' ? 'left' : 'right')
}

export function getPortIdForSide(node: GraphNode, side: PortSide): string {
  const preferredId = PORT_ID_BY_SIDE[side]
  return node.ports.find((port) => port.id === preferredId && port.side === side)?.id
    ?? node.ports.find((port) => port.side === side)?.id
    ?? preferredId
}

export function getPortAnchor(
  node: GraphNode,
  portId: string,
  preferred: 'source' | 'target' = 'source',
  edgeAnchor?: EdgeEndpointAnchor,
): PortAnchor {
  const side = edgeAnchor?.side ?? getPortSide(node, portId, preferred)
  const offset = clamp(edgeAnchor?.offset ?? 0.5)

  switch (side) {
    case 'top':
      return { x: node.x + node.width * offset, y: node.y, side }
    case 'right':
      return { x: node.x + node.width, y: node.y + node.height * offset, side }
    case 'bottom':
      return { x: node.x + node.width * offset, y: node.y + node.height, side }
    case 'left':
      return { x: node.x, y: node.y + node.height * offset, side }
  }
}

export function getBoundaryAnchor(
  node: GraphNode,
  point: { x: number; y: number },
  hitRadius = 18,
): BoundaryAnchorHit | null {
  const rawCandidates: Array<{ side: PortSide; distance: number; offset: number }> = [
    {
      side: 'top',
      distance: Math.abs(point.y - node.y),
      offset: clamp((point.x - node.x) / node.width),
    },
    {
      side: 'right',
      distance: Math.abs(point.x - (node.x + node.width)),
      offset: clamp((point.y - node.y) / node.height),
    },
    {
      side: 'bottom',
      distance: Math.abs(point.y - (node.y + node.height)),
      offset: clamp((point.x - node.x) / node.width),
    },
    {
      side: 'left',
      distance: Math.abs(point.x - node.x),
      offset: clamp((point.y - node.y) / node.height),
    },
  ]

  const candidates = rawCandidates.filter((candidate) => {
    if (candidate.side === 'top' || candidate.side === 'bottom') {
      return point.x >= node.x - hitRadius && point.x <= node.x + node.width + hitRadius
    }
    return point.y >= node.y - hitRadius && point.y <= node.y + node.height + hitRadius
  })

  const nearest = candidates
    .filter((candidate) => candidate.distance <= hitRadius)
    .sort((a, b) => a.distance - b.distance)[0]

  if (!nearest) return null

  return {
    id: getPortIdForSide(node, nearest.side),
    side: nearest.side,
    anchor: { side: nearest.side, offset: nearest.offset },
  }
}

export function findNearestTargetPort(
  node: GraphNode,
  point: { x: number; y: number },
  snapRadius = 28,
): { id: string; side: PortSide; anchor: EdgeEndpointAnchor } | null {
  if (node.ports.length === 0) return null

  const boundaryAnchor = getBoundaryAnchor(node, point, snapRadius)
  if (boundaryAnchor) return boundaryAnchor

  let nearestPort: { id: string; side: PortSide; anchor: EdgeEndpointAnchor } | null = null
  let nearestDistance = Number.POSITIVE_INFINITY

  for (const port of node.ports) {
    const anchor = getPortAnchor(node, port.id, 'target')
    const dx = anchor.x - point.x
    const dy = anchor.y - point.y
    const distance = Math.hypot(dx, dy)

    if (distance <= snapRadius && distance < nearestDistance) {
      nearestPort = { id: port.id, side: port.side, anchor: { side: port.side, offset: 0.5 } }
      nearestDistance = distance
    }
  }

  if (nearestPort) return nearestPort

  const fallbackId = getFallbackPortId(node, 'target')
  return {
    id: fallbackId,
    side: getPortSide(node, fallbackId, 'target'),
    anchor: { side: getPortSide(node, fallbackId, 'target'), offset: 0.5 },
  }
}
