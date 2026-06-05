import type { GraphDocument } from '../canvasTypes'

export type ProcessFocusState =
  | { mode: 'all' }
  | { mode: 'role'; role: string }
  | { mode: 'decisions' }
  | { mode: 'handoffs' }
  | { mode: 'bottlenecks' }

export interface ProcessFocusView {
  focusedNodeIds: Set<string>
  dimmedNodeIds: Set<string>
  focusedEdgeIds: Set<string>
  dimmedEdgeIds: Set<string>
}

export function deriveProcessFocus(doc: GraphDocument, focus: ProcessFocusState): ProcessFocusView {
  const allNodeIds = new Set(doc.nodes.keys())
  const allEdgeIds = new Set(doc.edges.keys())

  if (focus.mode === 'all') {
    return {
      focusedNodeIds: allNodeIds,
      dimmedNodeIds: new Set(),
      focusedEdgeIds: allEdgeIds,
      dimmedEdgeIds: new Set(),
    }
  }

  const focusedNodeIds = new Set<string>()
  const focusedEdgeIds = new Set<string>()

  if (focus.mode === 'role') {
    for (const node of doc.nodes.values()) {
      if (node.roleTags.includes(focus.role) || node.owner === focus.role) {
        focusedNodeIds.add(node.id)
      }
    }
    for (const edge of doc.edges.values()) {
      if (focusedNodeIds.has(edge.sourceNodeId) || focusedNodeIds.has(edge.targetNodeId) || edge.fromRole === focus.role || edge.toRole === focus.role) {
        focusedEdgeIds.add(edge.id)
      }
    }
  }

  if (focus.mode === 'decisions') {
    for (const node of doc.nodes.values()) {
      if (node.type === 'decision') focusedNodeIds.add(node.id)
    }
  }

  if (focus.mode === 'handoffs') {
    for (const edge of doc.edges.values()) {
      focusedEdgeIds.add(edge.id)
      focusedNodeIds.add(edge.sourceNodeId)
      focusedNodeIds.add(edge.targetNodeId)
    }
  }

  if (focus.mode === 'bottlenecks') {
    for (const node of doc.nodes.values()) {
      if (node.type === 'bottleneck') focusedNodeIds.add(node.id)
    }
  }

  return {
    focusedNodeIds,
    dimmedNodeIds: difference(allNodeIds, focusedNodeIds),
    focusedEdgeIds,
    dimmedEdgeIds: focus.mode === 'handoffs' || focus.mode === 'role' ? difference(allEdgeIds, focusedEdgeIds) : allEdgeIds,
  }
}

export function collectRoles(doc: GraphDocument): string[] {
  const roles = new Set<string>()
  for (const node of doc.nodes.values()) {
    for (const role of node.roleTags) roles.add(role)
    if (node.owner) roles.add(node.owner)
  }
  for (const edge of doc.edges.values()) {
    if (edge.fromRole) roles.add(edge.fromRole)
    if (edge.toRole) roles.add(edge.toRole)
  }
  return Array.from(roles).sort((a, b) => a.localeCompare(b))
}

function difference(left: Set<string>, right: Set<string>): Set<string> {
  const result = new Set<string>()
  for (const value of left) {
    if (!right.has(value)) result.add(value)
  }
  return result
}
