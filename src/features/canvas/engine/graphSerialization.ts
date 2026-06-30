import type { GraphDocument, GraphEdge, GraphNode } from '../canvasTypes'
import type { ProcessAssets } from '../canvasTypes'
import { normalizeProcessAssets } from '../processAssets'

export interface SerializedGraphDocument {
  id: string
  nodes: Record<string, GraphNode>
  edges: Record<string, GraphEdge>
  processAssets?: ProcessAssets
  selectedNodeIds: string[]
  selectedEdgeIds: string[]
  viewport: { x: number; y: number; zoom: number }
  meta: { dirty: boolean; version: number }
}

export function serializeGraphDocument(doc: GraphDocument): SerializedGraphDocument {
  return {
    id: doc.id,
    nodes: Object.fromEntries(doc.nodes),
    edges: Object.fromEntries(doc.edges),
    processAssets: normalizeProcessAssets(doc.processAssets),
    selectedNodeIds: Array.from(doc.selectedNodeIds),
    selectedEdgeIds: Array.from(doc.selectedEdgeIds),
    viewport: doc.viewport,
    meta: { dirty: false, version: doc.meta.version },
  }
}

export function deserializeGraphDocument(document: SerializedGraphDocument): GraphDocument {
  return {
    id: document.id,
    nodes: new Map(Object.entries(document.nodes)),
    edges: new Map(Object.entries(document.edges)),
    processAssets: normalizeProcessAssets(document.processAssets),
    selectedNodeIds: new Set(document.selectedNodeIds),
    selectedEdgeIds: new Set(document.selectedEdgeIds),
    viewport: document.viewport,
    meta: document.meta,
  }
}
