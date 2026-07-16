import type { EdgeEndpointAnchor, GraphDocument, GraphEdge, GraphNode, PortSide } from '../canvasTypes'
import { getPortIdForSide } from '../routing/ports'
import { syncStageContainers } from '../stageContainers'

export async function layoutFlowGraph(doc: GraphDocument): Promise<GraphDocument> {
  const layoutNodes = Array.from(doc.nodes.values()).filter((node) => node.type !== 'stage')
  const layout = layoutFlowPositions(layoutNodes, Array.from(doc.edges.values()).filter((edge) =>
    edge.legacyStageConnection || (edge.sourceNodeId !== edge.targetNodeId && doc.nodes.get(edge.sourceNodeId)?.type !== 'stage' && doc.nodes.get(edge.targetNodeId)?.type !== 'stage'),
  ))

  const nodes = new Map(doc.nodes)
  for (const position of layout.nodes) {
    const node = nodes.get(position.id)
    if (node) nodes.set(position.id, { ...node, x: position.x, y: position.y })
  }

  const staged = syncStageContainers({ ...doc, nodes }, { includeShared: true })
  const edges = new Map<string, GraphEdge>()
  for (const [id, edge] of doc.edges) {
    const source = staged.nodes.get(edge.sourceNodeId)
    const target = staged.nodes.get(edge.targetNodeId)
    edges.set(id, source && target ? withFlowAnchors(edge, source, target) : edge)
  }

  return {
    ...doc,
    nodes: staged.nodes,
    edges,
    meta: {
      ...doc.meta,
      layoutProfile: 'left-to-right',
      layoutNodeOrder: resolveFlowNodeOrder(staged.nodes),
    },
  }
}

function layoutFlowPositions(nodes: GraphNode[], edges: GraphEdge[]): { nodes: { id: string; x: number; y: number }[] } {
  const layoutEdges = createForwardEdges(nodes, edges)
  const adjacency = new Map<string, string[]>()
  const inDegree = new Map<string, number>()

  for (const node of nodes) {
    adjacency.set(node.id, [])
    inDegree.set(node.id, 0)
  }

  for (const edge of layoutEdges) {
    adjacency.get(edge.sourceNodeId)?.push(edge.targetNodeId)
    inDegree.set(edge.targetNodeId, (inDegree.get(edge.targetNodeId) ?? 0) + 1)
  }

  const columns: string[][] = []
  const columnMap = new Map<string, number>()

  const startBfs = (root: string): void => {
    const queue: string[] = [root]
    while (queue.length > 0) {
      const columnSize = queue.length
      const column: string[] = []
      for (let index = 0; index < columnSize; index += 1) {
        const nodeId = queue.shift()!
        if (columnMap.has(nodeId)) continue
        column.push(nodeId)
        columnMap.set(nodeId, columns.length)
        for (const neighbor of adjacency.get(nodeId) ?? []) {
          const newDegree = (inDegree.get(neighbor) ?? 1) - 1
          inDegree.set(neighbor, newDegree)
          if (newDegree === 0) queue.push(neighbor)
        }
      }
      if (column.length > 0) columns.push(column)
    }
  }

  for (const [nodeId, degree] of inDegree.entries()) {
    if (degree === 0 && !columnMap.has(nodeId)) startBfs(nodeId)
  }

  const remaining = nodes.filter((node) => !columnMap.has(node.id))
  if (remaining.length > 0) columns.push(remaining.map((node) => node.id))

  const maxNodeWidth = Math.max(220, ...nodes.map((node) => node.width))
  const maxNodeHeight = Math.max(96, ...nodes.map((node) => node.height))
  // Keep a Flow readable as a sequence, rather than making each handoff
  // span an entire screen. Activity role badges sit above nodes, so the
  // horizontal rhythm can remain deliberately compact.
  const spacingX = Math.max(320, maxNodeWidth + 96)
  const spacingY = Math.max(184, maxNodeHeight + 72)
  const maxColumnRows = Math.max(1, ...columns.map((column) => column.length))
  const centerY = 210
  const firstRowCenterY = centerY - ((maxColumnRows - 1) * spacingY) / 2
  const startX = 180

  return {
    nodes: columns.flatMap((column, columnIndex) => {
      return column.map((id, rowIndex) => ({
        id,
        x: startX + columnIndex * spacingX,
        y: firstRowCenterY + rowIndex * spacingY
          - (nodes.find((node) => node.id === id)?.height ?? maxNodeHeight) / 2,
      }))
    }),
  }
}

function createForwardEdges(nodes: GraphNode[], edges: GraphEdge[]): GraphEdge[] {
  const nodeIds = new Set(nodes.map((node) => node.id))
  const order = new Map<string, number>()
  let nextOrder = 1
  for (const node of nodes) {
    if (node.id === 'start') {
      order.set(node.id, 0)
    } else if (node.id === 'end') {
      order.set(node.id, nodes.length + 1)
    } else {
      order.set(node.id, nextOrder)
      nextOrder += 1
    }
  }

  return edges.filter((edge) => {
    if (!nodeIds.has(edge.sourceNodeId) || !nodeIds.has(edge.targetNodeId)) return false
    if (edge.sourceNodeId === edge.targetNodeId) return false
    return (order.get(edge.sourceNodeId) ?? 0) < (order.get(edge.targetNodeId) ?? 0)
  })
}

function resolveFlowNodeOrder(nodes: Map<string, GraphNode>): string[] {
  return Array.from(nodes.values())
    .filter((node) => node.type !== 'start' && node.type !== 'end')
    .sort((a, b) => (a.x - b.x) || (a.y - b.y) || a.id.localeCompare(b.id))
    .map((node) => node.id)
}

function withFlowAnchors(edge: GraphEdge, source: GraphNode, target: GraphNode): GraphEdge {
  if (source.type === 'stage' || target.type === 'stage') return edge
  const sourceCenter = center(source)
  const targetCenter = center(target)
  const dx = targetCenter.x - sourceCenter.x
  const dy = targetCenter.y - sourceCenter.y
  let sourceSide: PortSide
  let targetSide: PortSide

  if (Math.abs(dx) >= Math.abs(dy) * 0.8) {
    sourceSide = dx >= 0 ? 'right' : 'left'
    targetSide = dx >= 0 ? 'left' : 'right'
  } else {
    sourceSide = dy >= 0 ? 'bottom' : 'top'
    targetSide = dy >= 0 ? 'top' : 'bottom'
  }

  return {
    ...edge,
    sourcePortId: getPortIdForSide(source, sourceSide),
    sourceAnchor: anchor(sourceSide),
    targetPortId: getPortIdForSide(target, targetSide),
    targetAnchor: anchor(targetSide),
  }
}

function center(node: GraphNode): { x: number; y: number } {
  return { x: node.x + node.width / 2, y: node.y + node.height / 2 }
}

function anchor(side: PortSide): EdgeEndpointAnchor {
  return { side, offset: 0.5 }
}
