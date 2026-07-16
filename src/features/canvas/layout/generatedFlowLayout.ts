import type { EdgeEndpointAnchor, GraphDocument, GraphEdge, GraphNode, PortSide } from '../canvasTypes'
import { getPortIdForSide } from '../routing/ports'

const CENTER_X = 640
const LEFT_X = 260
const RIGHT_X = 1020
const START_Y = 80
const MAIN_GAP_Y = 220
const BRANCH_GAP_Y = 190
const BRANCH_FIRST_OFFSET_Y = 170

type Side = 'left' | 'right'

export function layoutGeneratedFlowGraph(doc: GraphDocument, generatedNodeIds?: string[]): GraphDocument {
  const orderedGeneratedNodeIds = resolveGeneratedNodeOrder(doc, generatedNodeIds)
  const mainline = findPrimaryPath(doc, orderedGeneratedNodeIds)
  const mainlineSet = new Set(mainline)
  const nodes = new Map(doc.nodes)
  const placed = new Set<string>()
  const reservedYBySide: Record<Side, Set<number>> = {
    left: new Set(),
    right: new Set(),
  }

  mainline.forEach((nodeId, index) => {
    placeNode(nodes, nodeId, CENTER_X, START_Y + index * MAIN_GAP_Y)
    placed.add(nodeId)
  })

  for (const nodeId of mainline) {
    const source = nodes.get(nodeId)
    if (!source) continue
    const outgoing = getOutgoingEdges(doc, nodeId)
      .filter((edge) => !mainlineSet.has(edge.targetNodeId))
      .sort((a, b) => sideSort(branchSide(a, source), branchSide(b, source)))

    outgoing.forEach((edge, branchIndex) => {
      const side = branchSide(edge, source, branchIndex)
      layoutBranch(doc, nodes, edge.targetNodeId, {
        side,
        startY: source.y + BRANCH_FIRST_OFFSET_Y,
        placed,
        mainlineSet,
        reservedY: reservedYBySide[side],
      })
    })
  }

  for (const nodeId of orderedGeneratedNodeIds) {
    if (placed.has(nodeId)) continue
    const lastMainline = mainline.at(-2) ?? mainline.at(-1)
    const last = lastMainline ? nodes.get(lastMainline) : undefined
    layoutBranch(doc, nodes, nodeId, {
      side: 'right',
      startY: (last?.y ?? START_Y) + BRANCH_FIRST_OFFSET_Y,
      placed,
      mainlineSet,
      reservedY: reservedYBySide.right,
    })
  }

  const edges = new Map<string, GraphEdge>()
  for (const [id, edge] of doc.edges) {
    const source = nodes.get(edge.sourceNodeId)
    const target = nodes.get(edge.targetNodeId)
    edges.set(id, source && target ? withDirectionalAnchors(edge, source, target) : edge)
  }

  return {
    ...doc,
    nodes,
    edges,
    meta: {
      ...doc.meta,
      layoutProfile: 'generated-flow',
      layoutNodeOrder: orderedGeneratedNodeIds,
    },
  }
}

export function shouldUseGeneratedFlowLayout(doc: GraphDocument): boolean {
  if (doc.meta.layoutProfile === 'generated-flow') return true
  if (doc.meta.layoutProfile === 'left-to-right' || doc.meta.layoutProfile === 'swimlane') return false
  if (doc.meta.layoutNodeOrder?.some((id) => doc.nodes.has(id))) return true

  const nodes = Array.from(doc.nodes.values())
  const nonTerminalNodes = nodes.filter((node) => node.type !== 'start' && node.type !== 'end')
  if (nonTerminalNodes.length < 3) return false

  const edges = Array.from(doc.edges.values())
  const outgoingCounts = new Map<string, number>()
  for (const edge of edges) {
    outgoingCounts.set(edge.sourceNodeId, (outgoingCounts.get(edge.sourceNodeId) ?? 0) + 1)
  }
  const branchingDecisionCount = nonTerminalNodes
    .filter((node) => node.type === 'decision' && (outgoingCounts.get(node.id) ?? 0) > 1)
    .length
  const hasLoopBack = edges.some((edge) => {
    const source = doc.nodes.get(edge.sourceNodeId)
    const target = doc.nodes.get(edge.targetNodeId)
    return Boolean(source && target && target.y + target.height < source.y - 40)
  })
  const verticalSpread = Math.max(...nonTerminalNodes.map((node) => node.y)) - Math.min(...nonTerminalNodes.map((node) => node.y))
  const horizontalSpread = Math.max(...nonTerminalNodes.map((node) => node.x)) - Math.min(...nonTerminalNodes.map((node) => node.x))
  const hasVerticalAnchors = edges.some((edge) =>
    edge.sourceAnchor?.side === 'bottom' ||
    edge.targetAnchor?.side === 'top' ||
    edge.sourcePortId === 'bottom' ||
    edge.targetPortId === 'top',
  )

  return branchingDecisionCount >= 2 || hasLoopBack || (hasVerticalAnchors && verticalSpread > horizontalSpread * 0.7)
}

function resolveGeneratedNodeOrder(doc: GraphDocument, generatedNodeIds?: string[]): string[] {
  const explicitOrder = (generatedNodeIds && generatedNodeIds.length > 0)
    ? generatedNodeIds
    : doc.meta.layoutNodeOrder

  const filteredOrder = (explicitOrder ?? [])
    .filter((id) => id !== 'start' && id !== 'end' && doc.nodes.has(id))
  if (filteredOrder.length > 0) return unique(filteredOrder)

  return Array.from(doc.nodes.values())
    .filter((node) => node.type !== 'start' && node.type !== 'end')
    .sort((a, b) => (a.y - b.y) || (a.x - b.x))
    .map((node) => node.id)
}

function findPrimaryPath(doc: GraphDocument, generatedNodeIds: string[]): string[] {
  const firstGenerated = generatedNodeIds[0]
  if (!firstGenerated) return doc.nodes.has('start') && doc.nodes.has('end') ? ['start', 'end'] : []

  const order = new Map(generatedNodeIds.map((id, index) => [id, index]))
  const path = doc.nodes.has('start') ? ['start'] : []
  const visited = new Set(path)
  let current = firstGenerated

  while (current && !visited.has(current)) {
    path.push(current)
    visited.add(current)
    const next = choosePrimaryTarget(doc, current, order, visited)
    if (!next) break
    if (next === 'end') {
      current = next
      break
    }
    current = next
  }

  if (current === 'end' && doc.nodes.has('end') && !path.includes('end')) {
    path.push('end')
  } else if (doc.nodes.has('end') && !path.includes('end')) {
    path.push('end')
  }

  return path
}

function choosePrimaryTarget(
  doc: GraphDocument,
  sourceNodeId: string,
  order: Map<string, number>,
  visited: Set<string>,
): string | null {
  const source = doc.nodes.get(sourceNodeId)
  const outgoing = getOutgoingEdges(doc, sourceNodeId)
    .filter((edge) => !visited.has(edge.targetNodeId))
    .filter((edge) => edge.targetNodeId === 'end' || (order.has(edge.targetNodeId) && (order.get(edge.targetNodeId) ?? 0) > (order.get(sourceNodeId) ?? -1)))

  if (outgoing.length === 0) return null
  const scored = outgoing.map((edge) => ({
    edge,
    score: scorePrimaryEdge(edge, source, order),
  }))
  scored.sort((a, b) => b.score - a.score)
  return scored[0].edge.targetNodeId
}

function scorePrimaryEdge(edge: GraphEdge, source: GraphNode | undefined, order: Map<string, number>): number {
  const label = edge.label.trim().toLowerCase()
  const sourceTitle = source?.title.trim().toLowerCase() ?? ''
  let score = 0
  const targetOrder = order.get(edge.targetNodeId)
  if (typeof targetOrder === 'number') score += Math.max(0, 1000 - targetOrder)
  if (/(低风险|low risk|continue|继续|通过|approve|approved|released|归档|解决)/i.test(label)) score += 5000
  if (/(高风险|中风险|法规|禁止|整改|blocked|stop|reject|rework|仍存在|未解决)/i.test(label)) score -= 5000
  if (/(临时|temporary|temp)/i.test(sourceTitle)) {
    if (/^(否|no)$/i.test(label)) score += 6000
    if (/^(是|yes)$/i.test(label)) score -= 2000
  }
  if (/(解决|resolved|到期)/i.test(sourceTitle)) {
    if (/(解决|是|yes|resolved)/i.test(label)) score += 6000
    if (/(仍存在|未解决|no|否|rework)/i.test(label)) score -= 6000
  }
  return score
}

function layoutBranch(
  doc: GraphDocument,
  nodes: Map<string, GraphNode>,
  nodeId: string,
  options: {
    side: Side
    startY: number
    placed: Set<string>
    mainlineSet: Set<string>
    reservedY: Set<number>
  },
): void {
  let currentId: string | undefined = nodeId
  let y = nextAvailableY(options.startY, options.reservedY)
  const visited = new Set<string>()
  while (currentId && !visited.has(currentId) && !options.mainlineSet.has(currentId)) {
    visited.add(currentId)
    if (!options.placed.has(currentId)) {
      placeNode(nodes, currentId, options.side === 'left' ? LEFT_X : RIGHT_X, y)
      options.placed.add(currentId)
      options.reservedY.add(y)
      y = nextAvailableY(y + BRANCH_GAP_Y, options.reservedY)
    }

    const nextEdge: GraphEdge | undefined = getOutgoingEdges(doc, currentId)
      .find((edge) => !options.mainlineSet.has(edge.targetNodeId) && !visited.has(edge.targetNodeId))
    currentId = nextEdge?.targetNodeId
  }
}

function placeNode(nodes: Map<string, GraphNode>, nodeId: string, centerX: number, y: number): void {
  const node = nodes.get(nodeId)
  if (!node) return
  nodes.set(nodeId, {
    ...node,
    x: Math.round(centerX - node.width / 2),
    y,
  })
}

function nextAvailableY(startY: number, reservedY: Set<number>): number {
  let candidate = Math.round(startY)
  while ([...reservedY].some((reserved) => Math.abs(reserved - candidate) < BRANCH_GAP_Y * 0.75)) {
    candidate += BRANCH_GAP_Y
  }
  return candidate
}

function getOutgoingEdges(doc: GraphDocument, nodeId: string): GraphEdge[] {
  return Array.from(doc.edges.values()).filter((edge) => edge.sourceNodeId === nodeId)
}

function branchSide(edge: GraphEdge, source?: GraphNode, index = 0): Side {
  const label = edge.label.trim()
  const title = source?.title ?? ''
  if (/(高风险|中风险|法规|禁止|整改|blocked|stop|reject)/i.test(label)) return 'left'
  if (/(临时|temporary|到期|仍存在|未解决|loop|rework)/i.test(label)) return 'right'
  if (/(风险|risk)/i.test(title)) return index === 0 ? 'left' : 'right'
  return index % 2 === 0 ? 'right' : 'left'
}

function sideSort(a: Side, b: Side): number {
  if (a === b) return 0
  return a === 'left' ? -1 : 1
}

function withDirectionalAnchors(edge: GraphEdge, source: GraphNode, target: GraphNode): GraphEdge {
  const sourceCenter = center(source)
  const targetCenter = center(target)
  const dx = targetCenter.x - sourceCenter.x
  const dy = targetCenter.y - sourceCenter.y
  let sourceSide: PortSide
  let targetSide: PortSide

  if (dy < -80) {
    sourceSide = sourceCenter.x >= CENTER_X ? 'right' : 'left'
    targetSide = sourceSide
  } else if (Math.abs(dx) > 120) {
    sourceSide = dx > 0 ? 'right' : 'left'
    targetSide = dx > 0 ? 'left' : 'right'
  } else if (dy >= 0) {
    sourceSide = 'bottom'
    targetSide = 'top'
  } else {
    sourceSide = 'top'
    targetSide = 'bottom'
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

function unique(values: string[]): string[] {
  return [...new Set(values)]
}
