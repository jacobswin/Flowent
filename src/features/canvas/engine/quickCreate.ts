import type { GraphDocument, GraphEdge, GraphNode } from '../canvasTypes'
import { createGraphNode, createHandoffEdge, type ProcessElementType } from '../processElements'

interface QuickCreateOptions {
  sourceNodeId: string | null
  targetType: ProcessElementType
  newNodeId: string
  newEdgeId: string
  fallbackPosition: { x: number; y: number }
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
