import type { GraphDocument, GraphEdge, GraphNode } from '../canvasTypes'
import { createGraphNode, createHandoffEdge, type ProcessElementType } from '../processElements'

interface QuickCreateOptions {
  sourceNodeId: string | null
  targetType: ProcessElementType
  newNodeId: string
  newEdgeId: string
  fallbackPosition: { x: number; y: number }
}

interface ConnectedNodeFromPortOptions {
  sourceNodeId: string
  sourcePortId: string
  targetType: ProcessElementType
  newNodeId: string
  newEdgeId: string
  dropPosition: { x: number; y: number }
}

interface QuickCreatePlan {
  node: GraphNode
  edge: GraphEdge | null
}

const QUICK_CREATE_GAP_X = 180

export function planQuickCreate(doc: GraphDocument, options: QuickCreateOptions): QuickCreatePlan {
  const source = options.sourceNodeId ? doc.nodes.get(options.sourceNodeId) ?? null : null
  const position = source
    ? { x: source.x + source.width + QUICK_CREATE_GAP_X, y: source.y }
    : options.fallbackPosition

  const node = createGraphNode(options.targetType, options.newNodeId, position)
  const sourcePort = source?.ports.find((port) => port.id === 'out') ?? source?.ports[0] ?? null
  const targetPort = node.ports.find((port) => port.id === 'in') ?? node.ports[0] ?? null

  if (!source || !sourcePort || !targetPort) {
    return { node, edge: null }
  }

  return {
    node,
    edge: createHandoffEdge(options.newEdgeId, source.id, sourcePort.id, node.id, targetPort.id),
  }
}

export function planConnectedNodeFromPort(
  doc: GraphDocument,
  options: ConnectedNodeFromPortOptions,
): QuickCreatePlan {
  const source = doc.nodes.get(options.sourceNodeId) ?? null
  const draftNode = createGraphNode(options.targetType, options.newNodeId, { x: 0, y: 0 })
  const targetPort = draftNode.ports.find((port) => port.id === 'in') ?? draftNode.ports[0] ?? null
  const targetPortOffset = targetPort ? getPortOffset(draftNode, targetPort.id) : { x: 0, y: 0 }
  const node = {
    ...draftNode,
    x: options.dropPosition.x - targetPortOffset.x,
    y: options.dropPosition.y - targetPortOffset.y,
  }
  const sourcePort = source?.ports.find((port) => port.id === options.sourcePortId) ?? null

  if (!source || !sourcePort || !targetPort) {
    return { node, edge: null }
  }

  return {
    node,
    edge: createHandoffEdge(options.newEdgeId, source.id, sourcePort.id, node.id, targetPort.id),
  }
}

function getPortOffset(node: GraphNode, portId: string): { x: number; y: number } {
  const port = node.ports.find((candidate) => candidate.id === portId)
  switch (port?.side) {
    case 'top':
      return { x: node.width / 2, y: 0 }
    case 'right':
      return { x: node.width, y: node.height / 2 }
    case 'bottom':
      return { x: node.width / 2, y: node.height }
    case 'left':
    default:
      return { x: 0, y: node.height / 2 }
  }
}
