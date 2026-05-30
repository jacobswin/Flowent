import type { GraphNode, GraphEdge } from '../canvasTypes'

export interface LayoutInput {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

export interface LayoutOutput {
  nodes: { id: string; x: number; y: number }[]
}

export async function layoutGraph(graph: LayoutInput): Promise<LayoutOutput> {
  // Build adjacency list
  const adjacency = new Map<string, string[]>()
  const inDegree = new Map<string, number>()

  for (const node of graph.nodes) {
    adjacency.set(node.id, [])
    inDegree.set(node.id, 0)
  }

  for (const edge of graph.edges) {
    adjacency.get(edge.sourceNodeId)?.push(edge.targetNodeId)
    inDegree.set(edge.targetNodeId, (inDegree.get(edge.targetNodeId) ?? 0) + 1)
  }

  // Topological sort with BFS (Kahn's algorithm)
  const queue: string[] = []
  for (const [nodeId, degree] of inDegree.entries()) {
    if (degree === 0) {
      queue.push(nodeId)
    }
  }

  const levels: string[][] = []
  const levelMap = new Map<string, number>()

  while (queue.length > 0) {
    const levelSize = queue.length
    const currentLevel: string[] = []

    for (let i = 0; i < levelSize; i++) {
      const nodeId = queue.shift()!
      currentLevel.push(nodeId)
      levelMap.set(nodeId, levels.length)

      for (const neighbor of adjacency.get(nodeId) ?? []) {
        const newDegree = (inDegree.get(neighbor) ?? 1) - 1
        inDegree.set(neighbor, newDegree)
        if (newDegree === 0) {
          queue.push(neighbor)
        }
      }
    }

    levels.push(currentLevel)
  }

  // Handle nodes with cycles (not reachable from roots)
  const remaining = graph.nodes.filter((n) => !levelMap.has(n.id))
  if (remaining.length > 0) {
    const extraLevel = remaining.map((n) => n.id)
    for (const nodeId of extraLevel) {
      levelMap.set(nodeId, levels.length)
    }
    levels.push(extraLevel)
  }

  // Assign coordinates
  const spacingX = 280
  const spacingY = 160
  const startX = 200
  const startY = 100

  const result: LayoutOutput = { nodes: [] }

  for (let levelIdx = 0; levelIdx < levels.length; levelIdx++) {
    const level = levels[levelIdx]
    const levelWidth = level.length * spacingX
    const offsetX = startX + (1200 - levelWidth) / 2

    for (let nodeIdx = 0; nodeIdx < level.length; nodeIdx++) {
      const nodeId = level[nodeIdx]
      result.nodes.push({
        id: nodeId,
        x: offsetX + nodeIdx * spacingX,
        y: startY + levelIdx * spacingY,
      })
    }
  }

  return result
}
