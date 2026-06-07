import type { GraphNode, PortSide } from '../canvasTypes'

export interface PortAnchor {
  x: number
  y: number
  side: PortSide
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

export function getPortAnchor(node: GraphNode, portId: string, preferred: 'source' | 'target' = 'source'): PortAnchor {
  const side = getPortSide(node, portId, preferred)

  switch (side) {
    case 'top':
      return { x: node.x + node.width / 2, y: node.y, side }
    case 'right':
      return { x: node.x + node.width, y: node.y + node.height / 2, side }
    case 'bottom':
      return { x: node.x + node.width / 2, y: node.y + node.height, side }
    case 'left':
      return { x: node.x, y: node.y + node.height / 2, side }
  }
}

export function findNearestTargetPort(
  node: GraphNode,
  point: { x: number; y: number },
  snapRadius = 28,
): { id: string; side: PortSide } | null {
  if (node.ports.length === 0) return null

  let nearestPort: { id: string; side: PortSide } | null = null
  let nearestDistance = Number.POSITIVE_INFINITY

  for (const port of node.ports) {
    const anchor = getPortAnchor(node, port.id, 'target')
    const dx = anchor.x - point.x
    const dy = anchor.y - point.y
    const distance = Math.hypot(dx, dy)

    if (distance <= snapRadius && distance < nearestDistance) {
      nearestPort = { id: port.id, side: port.side }
      nearestDistance = distance
    }
  }

  if (nearestPort) return nearestPort

  const fallbackId = getFallbackPortId(node, 'target')
  return {
    id: fallbackId,
    side: getPortSide(node, fallbackId, 'target'),
  }
}
