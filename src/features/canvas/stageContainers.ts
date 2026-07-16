import type { GraphDocument, GraphEdge, GraphNode } from './canvasTypes'

export const STAGE_MIN_PADDING = 24
export const STAGE_DEFAULT_PADDING = 36
const STAGE_MAX_PADDING = 160
const STAGE_MIN_WIDTH = 260
const STAGE_MIN_HEIGHT = 160

export function isStageMember(node: GraphNode | undefined): boolean {
  return node?.type === 'activity' || node?.type === 'decision'
}

/**
 * Map Stages derive their rectangle from direct child nodes. A child can be
 * part of at most one Map Stage, while a projected shared Process Stage is a
 * separate reusable relationship and is deliberately not included here.
 */
export function syncStageContainers(doc: GraphDocument, options: { includeShared?: boolean } = {}): GraphDocument {
  const nodes = new Map(doc.nodes)
  const claimedNodeIds = new Set<string>()

  for (const stage of Array.from(nodes.values()).filter((node) => isStageContainer(node, options))) {
    const memberNodeIds = unique(stage.memberNodeIds ?? []).filter((memberId) => {
      const member = nodes.get(memberId)
      if (!isStageMember(member) || claimedNodeIds.has(memberId)) return false
      claimedNodeIds.add(memberId)
      return true
    })
    const padding = clampPadding(stage.stagePadding)
    const bounds = boundsForMembers(memberNodeIds.map((id) => nodes.get(id)!).filter(Boolean), padding)
    nodes.set(stage.id, {
      ...stage,
      memberNodeIds,
      stagePadding: padding,
      ports: [],
      ...(bounds ?? {
        width: Math.max(STAGE_MIN_WIDTH, stage.width),
        height: Math.max(STAGE_MIN_HEIGHT, stage.height),
      }),
    })
  }

  return nodesEqual(doc.nodes, nodes) ? doc : { ...doc, nodes }
}

export function addNodeToStage(doc: GraphDocument, stageId: string, nodeId: string): GraphDocument {
  const stage = doc.nodes.get(stageId)
  const node = doc.nodes.get(nodeId)
  if (!stage || !isMapStage(stage) || !isStageMember(node)) return doc

  const nodes = new Map(doc.nodes)
  for (const candidate of nodes.values()) {
    if (!isMapStage(candidate)) continue
    const memberNodeIds = (candidate.memberNodeIds ?? []).filter((memberId) => memberId !== nodeId)
    nodes.set(candidate.id, candidate.id === stageId
      ? { ...candidate, memberNodeIds: [...memberNodeIds, nodeId] }
      : { ...candidate, memberNodeIds })
  }
  return syncStageContainers({ ...doc, nodes })
}

export function removeNodeFromStage(doc: GraphDocument, stageId: string, nodeId: string): GraphDocument {
  const stage = doc.nodes.get(stageId)
  if (!stage || !isMapStage(stage) || !(stage.memberNodeIds ?? []).includes(nodeId)) return doc
  const nodes = new Map(doc.nodes)
  nodes.set(stageId, { ...stage, memberNodeIds: stage.memberNodeIds?.filter((memberId) => memberId !== nodeId) ?? [] })
  return syncStageContainers({ ...doc, nodes })
}

export function detachNodeFromMapStages(doc: GraphDocument, nodeId: string): GraphDocument {
  let changed = false
  const nodes = new Map(doc.nodes)
  for (const stage of nodes.values()) {
    if (!isMapStage(stage) || !(stage.memberNodeIds ?? []).includes(nodeId)) continue
    nodes.set(stage.id, { ...stage, memberNodeIds: stage.memberNodeIds?.filter((memberId) => memberId !== nodeId) ?? [] })
    changed = true
  }
  return changed ? syncStageContainers({ ...doc, nodes }) : doc
}

export function addNodeToContainingStage(doc: GraphDocument, nodeId: string): GraphDocument {
  const node = doc.nodes.get(nodeId)
  if (!node || (node.type !== 'activity' && node.type !== 'decision')) return doc
  const center = { x: node.x + node.width / 2, y: node.y + node.height / 2 }
  const stage = Array.from(doc.nodes.values())
    .filter(isMapStage)
    .filter((candidate) => center.x >= candidate.x && center.x <= candidate.x + candidate.width && center.y >= candidate.y && center.y <= candidate.y + candidate.height)
    .sort((left, right) => left.width * left.height - right.width * right.height)[0]
  return stage ? addNodeToStage(doc, stage.id, nodeId) : doc
}

export function collectLegacyStageConnectionIds(doc: GraphDocument): string[] {
  return Array.from(doc.edges.values())
    .filter((edge) => edge.legacyStageConnection || doc.nodes.get(edge.sourceNodeId)?.type === 'stage' || doc.nodes.get(edge.targetNodeId)?.type === 'stage')
    .map((edge) => edge.id)
}

/** Marks, but does not remove, direct Stage connections saved by older maps. */
export function migrateLegacyStageConnections(doc: GraphDocument): GraphDocument {
  const edges = new Map<string, GraphEdge>()
  let changed = false
  for (const [id, edge] of doc.edges) {
    const isLegacy = edge.legacyStageConnection || doc.nodes.get(edge.sourceNodeId)?.type === 'stage' || doc.nodes.get(edge.targetNodeId)?.type === 'stage'
    edges.set(id, isLegacy && !edge.legacyStageConnection ? { ...edge, legacyStageConnection: true } : edge)
    changed ||= isLegacy && !edge.legacyStageConnection
  }
  return changed ? { ...doc, edges } : doc
}

function isMapStage(node: GraphNode): boolean {
  return node.type === 'stage' && !node.sharedProcessStageId
}

function isStageContainer(node: GraphNode, options: { includeShared?: boolean }): boolean {
  return node.type === 'stage' && (options.includeShared || !node.sharedProcessStageId)
}

function boundsForMembers(members: GraphNode[], padding: number): Pick<GraphNode, 'x' | 'y' | 'width' | 'height'> | null {
  if (members.length === 0) return null
  const left = Math.min(...members.map((member) => member.x))
  const top = Math.min(...members.map((member) => member.y))
  const right = Math.max(...members.map((member) => member.x + member.width))
  const bottom = Math.max(...members.map((member) => member.y + member.height))
  return {
    x: left - padding,
    y: top - padding,
    width: Math.max(STAGE_MIN_WIDTH, right - left + padding * 2),
    height: Math.max(STAGE_MIN_HEIGHT, bottom - top + padding * 2),
  }
}

function clampPadding(value: number | undefined): number {
  return Math.max(STAGE_MIN_PADDING, Math.min(STAGE_MAX_PADDING, value ?? STAGE_DEFAULT_PADDING))
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values))
}

function nodesEqual(previous: Map<string, GraphNode>, next: Map<string, GraphNode>): boolean {
  if (previous.size !== next.size) return false
  for (const [id, node] of previous) {
    if (node !== next.get(id)) return false
  }
  return true
}
