import type { GraphNode, GraphEdge } from '../canvasTypes'

export interface LayoutInput {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

export interface LayoutOutput {
  nodes: { id: string; x: number; y: number }[]
}

export async function layoutGraph(graph: LayoutInput): Promise<LayoutOutput> {
  const layoutEdges = createLayoutEdges(graph)

  // Build adjacency list
  const adjacency = new Map<string, string[]>()
  const inDegree = new Map<string, number>()

  for (const node of graph.nodes) {
    adjacency.set(node.id, [])
    inDegree.set(node.id, 0)
  }

  for (const edge of layoutEdges) {
    adjacency.get(edge.sourceNodeId)?.push(edge.targetNodeId)
    inDegree.set(edge.targetNodeId, (inDegree.get(edge.targetNodeId) ?? 0) + 1)
  }

  // Topological sort with BFS (Kahn's algorithm).
  // Each "level" becomes a column (X grows with depth);
  // nodes within a level stack along Y so siblings read as parallel branches.
  //
  // Disconnected subgraph handling: if the queue has multiple roots at once,
  // we lay them out side-by-side rather than stacking them in the first column.
  // Stacking all roots in column 0 makes the canvas look vertical — wrong for
  // a left-to-right product. We kick off one BFS per disconnected component,
  // then concatenate the columns so each component occupies its own X range.
  const columns: string[][] = []
  const columnMap = new Map<string, number>()

  const startBfs = (root: string): void => {
    const queue: string[] = [root]

    while (queue.length > 0) {
      const columnSize = queue.length
      const currentColumn: string[] = []

      for (let i = 0; i < columnSize; i++) {
        const nodeId = queue.shift()!
        currentColumn.push(nodeId)
        columnMap.set(nodeId, columns.length)

        for (const neighbor of adjacency.get(nodeId) ?? []) {
          const newDegree = (inDegree.get(neighbor) ?? 1) - 1
          inDegree.set(neighbor, newDegree)
          if (newDegree === 0) {
            queue.push(neighbor)
          }
        }
      }

      columns.push(currentColumn)
    }
  }

  // First pass: lay out each connected component whose root is a true root
  // (in-degree 0). Each such component owns its own block of columns.
  for (const [nodeId, degree] of inDegree.entries()) {
    if (degree === 0 && !columnMap.has(nodeId)) {
      startBfs(nodeId)
    }
  }

  // Anything left (cycles / orphans) gets its own column block.
  const remaining = graph.nodes.filter((n) => !columnMap.has(n.id))
  if (remaining.length > 0) {
    for (const node of remaining) {
      columnMap.set(node.id, columns.length)
    }
    columns.push(remaining.map((n) => n.id))
  }

  // Assign coordinates: X grows with column, Y grows with row.
  // Tuned for activity/decision boxes (width ~220, height ~96).
  const maxNodeWidth = Math.max(220, ...graph.nodes.map((node) => node.width))
  const maxNodeHeight = Math.max(96, ...graph.nodes.map((node) => node.height))
  const spacingX = Math.max(560, maxNodeWidth + 280)
  const spacingY = Math.max(240, maxNodeHeight + 140)
  const maxColumnsPerRow = 6
  const rowGap = Math.max(320, maxNodeHeight + 220)
  const startX = 220
  const startY = 130

  const result: LayoutOutput = { nodes: [] }
  const rowGroupHeights: number[] = []
  const rowGroupOffsets: number[] = []

  for (let rowGroupIdx = 0; rowGroupIdx < Math.ceil(columns.length / maxColumnsPerRow); rowGroupIdx++) {
    const rowColumns = columns.slice(rowGroupIdx * maxColumnsPerRow, (rowGroupIdx + 1) * maxColumnsPerRow)
    rowGroupHeights.push(Math.max(spacingY, ...rowColumns.map((column) => column.length * spacingY)))
    rowGroupOffsets.push(rowGroupHeights.slice(0, rowGroupIdx).reduce((sum, height) => sum + height + rowGap, 0))
  }

  for (let columnIdx = 0; columnIdx < columns.length; columnIdx++) {
    const column = columns[columnIdx]
    const rowGroupIdx = Math.floor(columnIdx / maxColumnsPerRow)
    const visualColumnIdx = columnIdx % maxColumnsPerRow
    const rowGroupHeight = rowGroupHeights[rowGroupIdx] ?? spacingY
    const columnHeight = column.length * spacingY
    const offsetY = startY + rowGroupOffsets[rowGroupIdx] + (rowGroupHeight - columnHeight) / 2

    for (let rowIdx = 0; rowIdx < column.length; rowIdx++) {
      const nodeId = column[rowIdx]
      result.nodes.push({
        id: nodeId,
        x: startX + visualColumnIdx * spacingX,
        y: offsetY + rowIdx * spacingY,
      })
    }
  }

  return result
}

function createLayoutEdges(graph: LayoutInput): GraphEdge[] {
  const nodeIds = new Set(graph.nodes.map((node) => node.id))
  const order = new Map<string, number>()
  let nextOrder = 1

  for (const node of graph.nodes) {
    if (node.id === 'start') {
      order.set(node.id, 0)
    } else if (node.id === 'end') {
      order.set(node.id, graph.nodes.length + 1)
    } else {
      order.set(node.id, nextOrder)
      nextOrder += 1
    }
  }

  return graph.edges.filter((edge) => {
    if (!nodeIds.has(edge.sourceNodeId) || !nodeIds.has(edge.targetNodeId)) return false
    if (edge.sourceNodeId === edge.targetNodeId) return false

    const sourceOrder = order.get(edge.sourceNodeId) ?? 0
    const targetOrder = order.get(edge.targetNodeId) ?? 0
    return sourceOrder < targetOrder
  })
}
