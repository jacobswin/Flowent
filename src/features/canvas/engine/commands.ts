import type { GraphCommand, GraphDocument } from '../canvasTypes'
import { addEdge, addNode } from './graphDocument'
import { syncStageContainers } from '../stageContainers'

function edgeEndpointsAreValid(doc: GraphDocument, edge: {
  sourceNodeId: string
  sourcePortId: string
  targetNodeId: string
  targetPortId: string
  legacyStageConnection?: boolean
}): boolean {
  if (edge.sourceNodeId === edge.targetNodeId) return false

  const source = doc.nodes.get(edge.sourceNodeId)
  const target = doc.nodes.get(edge.targetNodeId)
  if (!source || !target) return false

  // Direct Stage connections are only retained for pre-container maps. New
  // interactions never set this compatibility marker because new Stages have
  // no ports.
  if (edge.legacyStageConnection && (source.type === 'stage' || target.type === 'stage')) return true

  return (
    source.ports.some((port) => port.id === edge.sourcePortId) &&
    target.ports.some((port) => port.id === edge.targetPortId)
  )
}

function edgeAlreadyExists(doc: GraphDocument, edge: {
  sourceNodeId: string
  sourcePortId: string
  sourceAnchor?: { side: string; offset: number }
  targetNodeId: string
  targetPortId: string
  targetAnchor?: { side: string; offset: number }
}): boolean {
  for (const existing of doc.edges.values()) {
    if (
      existing.sourceNodeId === edge.sourceNodeId &&
      existing.sourcePortId === edge.sourcePortId &&
      anchorKey(existing.sourceAnchor) === anchorKey(edge.sourceAnchor) &&
      existing.targetNodeId === edge.targetNodeId &&
      existing.targetPortId === edge.targetPortId &&
      anchorKey(existing.targetAnchor) === anchorKey(edge.targetAnchor)
    ) {
      return true
    }
  }
  return false
}

function anchorKey(anchor?: { side: string; offset: number }): string {
  return anchor ? `${anchor.side}:${Math.round(anchor.offset * 1000)}` : ''
}

export function runCommand(doc: GraphDocument, command: GraphCommand): GraphDocument {
  switch (command.type) {
    case 'AddNode': {
      return syncStageContainers(addNode(doc, command.payload))
    }
    case 'AddEdge': {
      if (!edgeEndpointsAreValid(doc, command.payload)) {
        return doc
      }
      if (edgeAlreadyExists(doc, command.payload)) {
        return doc
      }
      return addEdge(doc, command.payload)
    }
    case 'UpdateNode': {
      const node = doc.nodes.get(command.payload.id)
      if (!node) {
        return doc
      }

      const nodes = new Map(doc.nodes)
      nodes.set(node.id, {
        ...node,
        ...command.payload.patch,
      })

      return syncStageContainers({
        ...doc,
        nodes,
        meta: {
          ...doc.meta,
          dirty: true,
          version: doc.meta.version + 1,
        },
      })
    }
    case 'SelectNode': {
      const selectedNodeIds = new Set(doc.selectedNodeIds)
      if (command.payload.additive) {
        if (selectedNodeIds.has(command.payload.id)) {
          selectedNodeIds.delete(command.payload.id)
        } else {
          selectedNodeIds.add(command.payload.id)
        }
      } else {
        selectedNodeIds.clear()
        selectedNodeIds.add(command.payload.id)
      }

      return {
        ...doc,
        selectedNodeIds,
        selectedEdgeIds: new Set(),
        meta: {
          ...doc.meta,
          dirty: true,
          version: doc.meta.version + 1,
        },
      }
    }
    case 'MoveNodes': {
      const nodes = new Map(doc.nodes)
      for (const id of command.payload.ids) {
        const node = nodes.get(id)
        if (node) {
          nodes.set(id, {
            ...node,
            x: node.x + command.payload.dx,
            y: node.y + command.payload.dy,
          })
        }
      }

      return syncStageContainers({
        ...doc,
        nodes,
        meta: {
          ...doc.meta,
          dirty: true,
          version: doc.meta.version + 1,
        },
      })
    }
    case 'UpdateViewport': {
      return {
        ...doc,
        viewport: {
          ...doc.viewport,
          ...command.payload,
        },
      }
    }
    case 'UpdateEdge': {
      const edge = doc.edges.get(command.payload.id)
      if (!edge) {
        return doc
      }

      const edges = new Map(doc.edges)
      const nextEdge = {
        ...edge,
        ...command.payload.patch,
      }
      if (nextEdge.legacyStageConnection &&
        doc.nodes.get(nextEdge.sourceNodeId)?.type !== 'stage' &&
        doc.nodes.get(nextEdge.targetNodeId)?.type !== 'stage') {
        delete nextEdge.legacyStageConnection
      }
      if (!edgeEndpointsAreValid(doc, nextEdge)) {
        return doc
      }

      edges.set(edge.id, nextEdge)

      return {
        ...doc,
        edges,
        meta: {
          ...doc.meta,
          dirty: true,
          version: doc.meta.version + 1,
        },
      }
    }
    case 'SelectEdge': {
      const selectedEdgeIds = new Set(doc.selectedEdgeIds)
      if (command.payload.additive) {
        if (selectedEdgeIds.has(command.payload.id)) {
          selectedEdgeIds.delete(command.payload.id)
        } else {
          selectedEdgeIds.add(command.payload.id)
        }
      } else {
        selectedEdgeIds.clear()
        selectedEdgeIds.add(command.payload.id)
      }

      return {
        ...doc,
        selectedNodeIds: command.payload.additive ? doc.selectedNodeIds : new Set(),
        selectedEdgeIds,
        meta: {
          ...doc.meta,
          dirty: true,
          version: doc.meta.version + 1,
        },
      }
    }
    default:
      return doc
  }
}
