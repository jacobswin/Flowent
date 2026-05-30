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
    default:
      return doc
  }
}
