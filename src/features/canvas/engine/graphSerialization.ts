import type { GraphDocument, GraphEdge, GraphNode, ProcessInstance } from '../canvasTypes'
import type { ProcessAssets } from '../canvasTypes'
import { normalizeProcessAssets } from '../processAssets'
import { migrateLegacyStageConnections, syncStageContainers } from '../stageContainers'

export interface SerializedGraphDocument {
  id: string
  nodes: Record<string, GraphNode>
  edges: Record<string, GraphEdge>
  processAssets?: ProcessAssets
  processInstances?: Record<string, ProcessInstance>
  selectedNodeIds: string[]
  selectedEdgeIds: string[]
  viewport: { x: number; y: number; zoom: number }
  meta: GraphDocument['meta']
}

export function serializeGraphDocument(doc: GraphDocument): SerializedGraphDocument {
  const normalized = syncStageContainers(migrateLegacyStageConnections(doc))
  return {
    id: normalized.id,
    nodes: Object.fromEntries(normalized.nodes),
    edges: Object.fromEntries(normalized.edges),
    processAssets: normalizeProcessAssets(normalized.processAssets),
    processInstances: normalized.processInstances,
    selectedNodeIds: Array.from(normalized.selectedNodeIds),
    selectedEdgeIds: Array.from(normalized.selectedEdgeIds),
    viewport: normalized.viewport,
    meta: { ...normalized.meta, dirty: false },
  }
}

export function deserializeGraphDocument(document: SerializedGraphDocument): GraphDocument {
  const raw: GraphDocument = {
    id: document.id,
    nodes: new Map(Object.entries(document.nodes)),
    edges: new Map(Object.entries(document.edges)),
    processAssets: normalizeProcessAssets(document.processAssets),
    processInstances: Object.fromEntries(Object.entries(document.processInstances ?? {}).map(([id, instance]) => [id, {
      ...instance,
      nodeIdsByDecision: instance.nodeIdsByDecision ?? {},
      stageNodeIdsByStage: instance.stageNodeIdsByStage ?? {},
    }])),
    selectedNodeIds: new Set(document.selectedNodeIds),
    selectedEdgeIds: new Set(document.selectedEdgeIds),
    viewport: document.viewport,
    meta: document.meta,
  }
  return syncStageContainers(migrateLegacyStageConnections(raw))
}
