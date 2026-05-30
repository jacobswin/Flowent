import type { GraphDocument, GraphEdge, GraphNode } from '../canvasTypes'

export function createEmptyDocument(id: string): GraphDocument {
  return {
    id,
    nodes: new Map(),
    edges: new Map(),
    selectedNodeIds: new Set(),
    selectedEdgeIds: new Set(),
    viewport: { x: 0, y: 0, zoom: 1 },
    meta: { dirty: false, version: 1 },
  }
}

export function addNode(doc: GraphDocument, node: GraphNode): GraphDocument {
  const nodes = new Map(doc.nodes)
  nodes.set(node.id, node)

  return {
    ...doc,
    nodes,
    meta: {
      dirty: true,
      version: doc.meta.version + 1,
    },
  }
}

export function addEdge(doc: GraphDocument, edge: GraphEdge): GraphDocument {
  if (!doc.nodes.has(edge.sourceNodeId) || !doc.nodes.has(edge.targetNodeId)) {
    throw new Error('Missing endpoint node for edge')
  }

  const edges = new Map(doc.edges)
  edges.set(edge.id, edge)

  return {
    ...doc,
    edges,
    meta: {
      dirty: true,
      version: doc.meta.version + 1,
    },
  }
}
