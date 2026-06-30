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
    label: 'Stage',
    description: 'Group work around a process phase with entry and exit expectations.',
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

export function getPortsForNodeType(type: GraphNodeType): GraphPort[] {
  switch (type) {
    case 'start':
      return [{ id: 'out', side: 'right' }]
    case 'end':
      return [{ id: 'in', side: 'left' }]
    case 'activity':
    case 'decision':
    case 'stage':
    case 'bottleneck':
      return [
        { id: 'in', side: 'left' },
        { id: 'out', side: 'right' },
      ]
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
        width: 280,
        height: 132,
        title: 'New stage',
        goal: '',
        entryCondition: '',
        exitCondition: '',
        owner: '',
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
): GraphEdge {
  return {
    id,
    sourceNodeId,
    sourcePortId,
    targetNodeId,
    targetPortId,
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
