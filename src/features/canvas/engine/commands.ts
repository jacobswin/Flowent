import type { GraphCommand, GraphDocument } from '../canvasTypes'
import { addEdge, addNode } from './graphDocument'

export function runCommand(doc: GraphDocument, command: GraphCommand): GraphDocument {
  switch (command.type) {
    case 'AddNode': {
      return addNode(doc, command.payload)
    }
    case 'AddEdge': {
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

      return {
        ...doc,
        nodes,
        meta: {
          dirty: true,
          version: doc.meta.version + 1,
        },
      }
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
        meta: {
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

      return {
        ...doc,
        nodes,
        meta: {
          dirty: true,
          version: doc.meta.version + 1,
        },
      }
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
    default:
      return doc
  }
}
