import type {
  EdgeEndpointAnchor,
  GraphDocument,
  GraphEdge,
  GraphNode,
  PortSide,
  WorkProductActivityRelation,
} from '../canvasTypes'
import { getActivityResponsibilities, getWorkProductActivityLinks } from '../processAssets'
import { getPortIdForSide } from '../routing/ports'

export type SwimlaneLaneKind = 'role' | 'input' | 'activity' | 'output'

export type SwimlaneCard = {
  id: string
  label: string
  x: number
  y: number
  width: number
  height: number
  workProductId?: string
}

export type SwimlaneRow = {
  activityNodeId: string
  y: number
  lanes: Record<SwimlaneLaneKind, { x: number; width: number }>
  roleCards: SwimlaneCard[]
  inputCards: SwimlaneCard[]
  outputCards: SwimlaneCard[]
}

export const SWIMLANE_LANES: Record<SwimlaneLaneKind, { title: string; x: number; width: number }> = {
  role: { title: 'Role', x: 120, width: 220 },
  input: { title: 'Input', x: 340, width: 280 },
  activity: { title: 'Activity', x: 620, width: 300 },
  output: { title: 'Output', x: 920, width: 280 },
}

const START_Y = 222
const ROW_GAP = 188
const CARD_HEIGHT = 46
const CARD_GAP = 8
const CARD_INSET = 12

export function layoutSwimlaneGraph(doc: GraphDocument): GraphDocument {
  const rows = deriveSwimlaneRows(doc)
  const nodes = new Map(doc.nodes)

  rows.forEach((row, index) => {
    const node = nodes.get(row.activityNodeId)
    if (!node) return
    nodes.set(node.id, {
      ...node,
      x: SWIMLANE_LANES.activity.x + (SWIMLANE_LANES.activity.width - node.width) / 2,
      y: START_Y + index * ROW_GAP,
    })
  })

  // A Stage is a phase segment in Swimlane view: it spans all four lanes,
  // while the contained Activities and Decisions remain in the Activity lane.
  const rowIndexByNodeId = new Map(rows.map((row, index) => [row.activityNodeId, index]))
  for (const stage of nodes.values()) {
    if (stage.type !== 'stage') continue
    const memberRows = (stage.memberNodeIds ?? [])
      .map((memberId) => rowIndexByNodeId.get(memberId))
      .filter((index): index is number => index !== undefined)
    if (memberRows.length === 0) continue
    const first = Math.min(...memberRows)
    const last = Math.max(...memberRows)
    const firstNode = nodes.get(rows[first]!.activityNodeId)
    const lastNode = nodes.get(rows[last]!.activityNodeId)
    if (!firstNode || !lastNode) continue
    nodes.set(stage.id, {
      ...stage,
      x: SWIMLANE_LANES.role.x,
      y: firstNode.y - 54,
      width: SWIMLANE_LANES.output.x + SWIMLANE_LANES.output.width - SWIMLANE_LANES.role.x,
      height: lastNode.y + lastNode.height - (firstNode.y - 54) + 42,
      ports: [],
    })
  }

  placeTerminal(nodes, 'start', rows[0]?.activityNodeId, -1)
  placeTerminal(nodes, 'end', rows.at(-1)?.activityNodeId, 1)

  const edges = new Map<string, GraphEdge>()
  for (const [id, edge] of doc.edges) {
    const source = nodes.get(edge.sourceNodeId)
    const target = nodes.get(edge.targetNodeId)
    edges.set(id, source && target ? withSwimlaneAnchors(edge, source, target) : edge)
  }

  return {
    ...doc,
    nodes,
    edges,
    meta: {
      ...doc.meta,
      layoutProfile: 'swimlane',
      layoutNodeOrder: rows.map((row) => row.activityNodeId),
    },
  }
}

export function deriveSwimlaneRows(doc: GraphDocument): SwimlaneRow[] {
  const activityIds = resolveActivityOrder(doc)
  return activityIds.map((activityNodeId, index) => {
    const rowY = doc.nodes.get(activityNodeId)?.y ?? START_Y + index * ROW_GAP
    return {
      activityNodeId,
      y: rowY,
      lanes: {
        role: lane('role'),
        input: lane('input'),
        activity: lane('activity'),
        output: lane('output'),
      },
      roleCards: deriveRoleCards(doc, activityNodeId, rowY),
      inputCards: deriveWorkProductCards(doc, activityNodeId, 'input', rowY),
      outputCards: deriveWorkProductCards(doc, activityNodeId, 'output', rowY),
    }
  })
}

function resolveActivityOrder(doc: GraphDocument): string[] {
  const explicit = (doc.meta.layoutNodeOrder ?? [])
    .filter((id) => isSwimlaneFlowNode(doc.nodes.get(id)))
  if (explicit.length > 0) return unique(explicit)

  const activityIds = Array.from(doc.nodes.values())
    .filter(isSwimlaneFlowNode)
    .map((node) => node.id)
  const activitySet = new Set(activityIds)
  const order: string[] = []
  const visited = new Set<string>()
  let current = 'start'

  while (current && !visited.has(current)) {
    visited.add(current)
    const nextEdge = Array.from(doc.edges.values())
      .filter((edge) => edge.sourceNodeId === current)
      .sort((a, b) => a.id.localeCompare(b.id))[0]
    if (!nextEdge) break
    current = nextEdge.targetNodeId
    if (activitySet.has(current)) order.push(current)
  }

  const ordered = unique(order)
  const remaining = activityIds
    .filter((id) => !ordered.includes(id))
    .sort((a, b) => {
      const nodeA = doc.nodes.get(a)
      const nodeB = doc.nodes.get(b)
      return ((nodeA?.y ?? 0) - (nodeB?.y ?? 0)) ||
        ((nodeA?.x ?? 0) - (nodeB?.x ?? 0)) ||
        a.localeCompare(b)
    })

  return [...ordered, ...remaining]
}

function deriveRoleCards(doc: GraphDocument, activityNodeId: string, rowY: number): SwimlaneCard[] {
  const node = doc.nodes.get(activityNodeId)
  if (!node) return []
  if (node.type === 'decision' && node.owner) {
    return [card(`role-${activityNodeId}`, node.owner, SWIMLANE_LANES.role, rowY)]
  }
  const responsible = getActivityResponsibilities(node)
    .find((responsibility) => responsibility.kind === 'responsible')
  const label = responsible?.roleName ?? node.roleTags[0]
  if (!label) return []

  return [card(`role-${activityNodeId}`, label, SWIMLANE_LANES.role, rowY)]
}

function deriveWorkProductCards(
  doc: GraphDocument,
  activityNodeId: string,
  relation: WorkProductActivityRelation,
  rowY: number,
): SwimlaneCard[] {
  const cards: SwimlaneCard[] = []
  for (const asset of Object.values(doc.processAssets.workProducts)) {
    for (const link of getWorkProductActivityLinks(asset)) {
      if (link.nodeId !== activityNodeId || link.relation !== relation) continue
      const maturity = link.maturity || asset.state
      const laneSpec = relation === 'input' ? SWIMLANE_LANES.input : SWIMLANE_LANES.output
      cards.push({
        ...card(link.id, `${asset.title}${maturity ? ` · ${maturity}` : ''}`, laneSpec, rowY),
        workProductId: asset.id,
      })
    }
  }

  return cards.map((item, index) => ({
    ...item,
    y: item.y + index * (CARD_HEIGHT + CARD_GAP),
  }))
}

function card(
  id: string,
  label: string,
  laneSpec: { x: number; width: number },
  rowY: number,
): SwimlaneCard {
  return {
    id,
    label,
    x: laneSpec.x + CARD_INSET,
    y: rowY + 8,
    width: laneSpec.width - CARD_INSET * 2,
    height: CARD_HEIGHT,
  }
}

function lane(kind: SwimlaneLaneKind): { x: number; width: number } {
  const spec = SWIMLANE_LANES[kind]
  return { x: spec.x, width: spec.width }
}

function placeTerminal(nodes: Map<string, GraphNode>, type: 'start' | 'end', adjacentActivityId: string | undefined, direction: -1 | 1): void {
  const node = Array.from(nodes.values()).find((candidate) => candidate.type === type)
  const adjacent = adjacentActivityId ? nodes.get(adjacentActivityId) : undefined
  if (!node || !adjacent) return

  nodes.set(node.id, {
    ...node,
    x: adjacent.x + adjacent.width / 2 - node.width / 2,
    y: direction < 0
      ? adjacent.y - node.height - 18
      : adjacent.y + adjacent.height + 18,
  })
}

function withSwimlaneAnchors(edge: GraphEdge, source: GraphNode, target: GraphNode): GraphEdge {
  if (source.type === 'stage' || target.type === 'stage') return edge
  const sourceCenter = center(source)
  const targetCenter = center(target)
  const dx = targetCenter.x - sourceCenter.x
  const dy = targetCenter.y - sourceCenter.y
  let sourceSide: PortSide
  let targetSide: PortSide

  if (Math.abs(dy) >= Math.abs(dx) * 0.6) {
    sourceSide = dy >= 0 ? 'bottom' : 'top'
    targetSide = dy >= 0 ? 'top' : 'bottom'
  } else {
    sourceSide = dx >= 0 ? 'right' : 'left'
    targetSide = dx >= 0 ? 'left' : 'right'
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

function isSwimlaneFlowNode(node: GraphNode | undefined): boolean {
  return node?.type === 'activity' || node?.type === 'decision'
}
