// Local re-implementation of the small subset of @xyflow/react node/edge
// shapes that Flowent uses. Avoids pulling in the full xyflow runtime
// (which is on the order of hundreds of KB and only added because of
// historical type imports).

export type ReviewStatus = 'unclear' | 'disputed' | 'needs-owner' | 'approved' | 'changed-since-approval'

export type PortSide = 'top' | 'right' | 'bottom' | 'left'

export type GraphPort = {
  id: string
  side: PortSide
}

export type GraphNodeType = 'activity' | 'decision' | 'stage' | 'bottleneck' | 'start' | 'end'

export type GraphNode = {
  id: string
  type: GraphNodeType
  x: number
  y: number
  width: number
  height: number
  title: string
  summary?: string
  criteria?: string
  decisionOutcomes?: string[]
  roleTags: string[]
  expectations?: string
  owner?: string
  goal?: string
  entryCondition?: string
  exitCondition?: string
  symptom?: string
  impact?: string
  suspectedCause?: string
  reviewStatus?: ReviewStatus
  ports: GraphPort[]
}

export type GraphEdge = {
  id: string
  sourceNodeId: string
  sourcePortId: string
  targetNodeId: string
  targetPortId: string
  label: string
  kind?: 'handoff'
  fromRole?: string
  toRole?: string
  artifact?: string
  expectation?: string
  readinessSignal?: string
  reviewStatus?: ReviewStatus
}

export type GraphViewport = {
  x: number
  y: number
  zoom: number
}

export type GraphDocument = {
  id: string
  nodes: Map<string, GraphNode>
  edges: Map<string, GraphEdge>
  selectedNodeIds: Set<string>
  selectedEdgeIds: Set<string>
  viewport: GraphViewport
  meta: {
    dirty: boolean
    version: number
  }
}

export type GraphCommand =
  | { type: 'AddNode'; payload: GraphNode }
  | { type: 'AddEdge'; payload: GraphEdge }
  | {
      type: 'UpdateNode'
      payload: {
        id: string
        patch: Partial<
          Pick<
            GraphNode,
            | 'title'
            | 'summary'
            | 'criteria'
            | 'decisionOutcomes'
            | 'roleTags'
            | 'expectations'
            | 'owner'
            | 'goal'
            | 'entryCondition'
            | 'exitCondition'
            | 'symptom'
            | 'impact'
            | 'suspectedCause'
            | 'reviewStatus'
            | 'x'
            | 'y'
          >
        >
      }
    }
  | {
      type: 'UpdateEdge'
      payload: {
        id: string
        patch: Partial<
          Pick<
            GraphEdge,
            | 'label'
            | 'fromRole'
            | 'toRole'
            | 'artifact'
            | 'expectation'
            | 'readinessSignal'
            | 'reviewStatus'
          >
        >
      }
    }
  | {
      type: 'SelectNode'
      payload: { id: string; additive: boolean }
    }
  | {
      type: 'SelectEdge'
      payload: { id: string; additive: boolean }
    }
  | {
      type: 'MoveNodes'
      payload: { ids: string[]; dx: number; dy: number }
    }
  | {
      type: 'UpdateViewport'
      payload: Partial<GraphViewport>
    }

export type ActivityNodeData = {
  title: string
  summary: string
  roleIds: string[]
  expectations?: string
  kind: 'activity'
}

export type DecisionNodeData = {
  title: string
  criteria: string
  decisionOutcomes?: string[]
  owner?: string
  kind: 'decision'
}

export type StageNodeData = {
  title: string
  goal: string
  entryCondition: string
  exitCondition: string
  owner: string
  kind: 'stage'
}

export type BottleneckNodeData = {
  title: string
  symptom: string
  impact: string
  suspectedCause: string
  reviewStatus: ReviewStatus
  kind: 'bottleneck'
}

export type StartEndNodeData = {
  label: string
  kind: 'start' | 'end'
}

export type ProcessNodeData = ActivityNodeData | DecisionNodeData | StageNodeData | BottleneckNodeData | StartEndNodeData

export type ProcessNode = {
  id: string
  type: 'activity' | 'decision' | 'stage' | 'bottleneck' | 'startEnd'
  position: { x: number; y: number }
  data: ProcessNodeData
}

export type ProcessEdge = {
  id: string
  type: 'handoff'
  source: string
  target: string
  sourceHandle?: string
  targetHandle?: string
  data?: {
    label?: string
    fromRole?: string
    toRole?: string
    artifact?: string
    expectation?: string
    readinessSignal?: string
    reviewStatus?: ReviewStatus
  }
}
