import type { GraphEdge, GraphNode, GraphNodeType, GraphPort, ReviewStatus } from './canvasTypes'

export type ProcessElementType = 'stage' | 'activity' | 'decision' | 'bottleneck' | 'end'

export interface ProcessElementDefinition {
  type: ProcessElementType
  label: string
  description: string
  shortcut?: string
}

export const DEFAULT_REVIEW_STATUS: ReviewStatus = 'unclear'

export const PROCESS_ELEMENTS: ProcessElementDefinition[] = [
  {
    type: 'stage',
    label: 'Map stage',
    description: 'Add a map-only phase container for Activities and Decisions.',
  },
  {
    type: 'activity',
    label: 'Activity',
    description: 'Capture a step of work, responsible roles, and expectations.',
    shortcut: 'A',
  },
  {
    type: 'decision',
    label: 'Decision',
    description: 'Capture a decision point, owner, criteria, and outcomes.',
    shortcut: 'D',
  },
  {
    type: 'bottleneck',
    label: 'Bottleneck',
    description: 'Mark a waiting point, unclear owner, or recurring slowdown.',
  },
  {
    type: 'end',
    label: 'End',
    description: 'Mark the end of this process path.',
    shortcut: 'S',
  },
]

const FOUR_SIDE_PORTS: GraphPort[] = [
  { id: 'top', side: 'top' },
  { id: 'in', side: 'left' },
  { id: 'out', side: 'right' },
  { id: 'bottom', side: 'bottom' },
]

export function getPortsForNodeType(type: GraphNodeType): GraphPort[] {
  switch (type) {
    case 'stage':
      // A Stage is a visual container. New connections always attach to one
      // of its Activities or Decisions, never to the container itself.
      return []
    case 'start':
    case 'end':
    case 'activity':
    case 'decision':
    case 'bottleneck':
      return FOUR_SIDE_PORTS.map((port) => ({ ...port }))
  }
}

export function createGraphNode(
  type: ProcessElementType | 'start',
  id: string,
  position: { x: number; y: number },
): GraphNode {
  switch (type) {
    case 'start':
      return {
        id,
        type,
        x: position.x,
        y: position.y,
        width: 120,
        height: 56,
        title: 'Start',
        roleTags: [],
        ports: getPortsForNodeType(type),
      }
    case 'end':
      return {
        id,
        type,
        x: position.x,
        y: position.y,
        width: 120,
        height: 56,
        title: 'End',
        roleTags: [],
        ports: getPortsForNodeType(type),
      }
    case 'stage':
      return {
        id,
        type,
        x: position.x,
        y: position.y,
        width: 320,
        height: 220,
        title: 'New stage',
        goal: '',
        entryCondition: '',
        exitCondition: '',
        owner: '',
        memberNodeIds: [],
        stagePadding: 36,
        roleTags: [],
        ports: getPortsForNodeType(type),
      }
    case 'activity':
      return {
        id,
        type,
        x: position.x,
        y: position.y,
        width: 220,
        height: 112,
        title: 'New activity',
        summary: '',
        expectations: '',
        roleTags: [],
        responsibilities: [],
        ports: getPortsForNodeType(type),
      }
    case 'decision':
      return {
        id,
        type,
        x: position.x,
        y: position.y,
        width: 190,
        height: 124,
        title: 'New decision',
        criteria: '',
        decisionOutcomes: [],
        owner: '',
        roleTags: [],
        ports: getPortsForNodeType(type),
      }
    case 'bottleneck':
      return {
        id,
        type,
        x: position.x,
        y: position.y,
        width: 220,
        height: 104,
        title: 'Potential bottleneck',
        symptom: '',
        impact: '',
        suspectedCause: '',
        reviewStatus: DEFAULT_REVIEW_STATUS,
        roleTags: [],
        ports: getPortsForNodeType(type),
      }
  }
}

export function createHandoffEdge(
  id: string,
  sourceNodeId: string,
  sourcePortId: string,
  targetNodeId: string,
  targetPortId: string,
  options: Pick<GraphEdge, 'sourceAnchor' | 'targetAnchor'> = {},
): GraphEdge {
  return {
    id,
    sourceNodeId,
    sourcePortId,
    ...(options.sourceAnchor ? { sourceAnchor: options.sourceAnchor } : {}),
    targetNodeId,
    targetPortId,
    ...(options.targetAnchor ? { targetAnchor: options.targetAnchor } : {}),
    label: '',
    kind: 'handoff',
    fromRole: '',
    toRole: '',
    artifact: '',
    expectation: '',
    readinessSignal: '',
    reviewStatus: DEFAULT_REVIEW_STATUS,
  }
}
