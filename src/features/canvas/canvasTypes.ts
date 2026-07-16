// Local re-implementation of the small subset of @xyflow/react node/edge
// shapes that Flowent uses. Avoids pulling in the full xyflow runtime
// (which is on the order of hundreds of KB and only added because of
// historical type imports).

import type { ProcessIntelligenceProfileId } from './processIntelligenceProfiles'

export type ReviewStatus = 'unclear' | 'disputed' | 'needs-owner' | 'approved' | 'changed-since-approval'

export type PortSide = 'top' | 'right' | 'bottom' | 'left'

export type ResponsibilityKind = 'responsible' | 'accountable' | 'supporting' | 'consulted' | 'informed'

export type ProcessStageKind = 'value-add' | 'wait' | 'rework'

export type ProcessStageData = {
  kind: ProcessStageKind
  durationMinutesP50?: number
  durationMinutesP90?: number
  classificationSource: 'explicit' | 'inferred'
}

export type ProcessAnalysisProfile = ProcessIntelligenceProfileId

export type ProcessAnalysisSettings = {
  profile: ProcessAnalysisProfile
  wip?: number
}

export type ActivityResponsibility = {
  id: string
  roleName: string
  /** Stable reference into the workspace Role library when available. */
  roleId?: string
  kind: ResponsibilityKind
}

export type GuidanceKind = 'template' | 'checklist' | 'practice' | 'tool' | 'training' | 'link' | 'other'

export type WorkProductActivityRelation = 'input' | 'output'

export type WorkProductActivityLink = {
  id: string
  nodeId: string
  relation: WorkProductActivityRelation
  maturity: string
}

export type WorkProductAsset = {
  id: string
  title: string
  state: string
  description: string
  activityLinks?: WorkProductActivityLink[]
  producerNodeIds: string[]
  consumerNodeIds: string[]
  handoffEdgeIds: string[]
  guidanceIds: string[]
  /** Points to the cross-map Work Product when this is a projected asset. */
  sharedWorkProductId?: string
}

export type GuidanceAsset = {
  id: string
  title: string
  kind: GuidanceKind
  description: string
  url: string
  appliesToNodeIds: string[]
  appliesToEdgeIds: string[]
  workProductIds: string[]
}

export type MilestoneWorkProductState = {
  workProductId: string
  state: string
}

export type MilestoneAsset = {
  id: string
  title: string
  description: string
  stageNodeId: string | null
  workProductStates: MilestoneWorkProductState[]
  /** Stable source ids for milestones projected from a shared Process Stage. */
  sharedProcessStageId?: string
  sharedProcessMilestoneId?: string
}

export type ProcessAssets = {
  workProducts: Record<string, WorkProductAsset>
  guidanceItems: Record<string, GuidanceAsset>
  milestones: Record<string, MilestoneAsset>
}

export type NodeAssetSummary = {
  responsibleRoles: string[]
  accountableRoles: string[]
  inputCount: number
  outputCount: number
  guidanceCount: number
  milestoneCount: number
}

export type EdgeAssetSummary = {
  workProductCount: number
}

export type GraphPort = {
  id: string
  side: PortSide
}

export type EdgeEndpointAnchor = {
  side: PortSide
  offset: number
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
  responsibilities?: ActivityResponsibility[]
  /** Runtime projection metadata for a reusable shared Activity. */
  sharedActivityId?: string
  processInstanceId?: string
  sharedProcessPlacementId?: string
  /** Runtime projection metadata for a reusable shared Process Decision. */
  sharedProcessDecisionId?: string
  /** Runtime projection metadata for a reusable shared Process Stage. */
  sharedProcessStageId?: string
  /** Child Activities and Decisions contained by this Stage. */
  memberNodeIds?: string[]
  /** Shared Role library id for the Stage owner when available. */
  ownerRoleId?: string
  /** Uniform free space around the derived member bounds. */
  stagePadding?: number
  processStage?: ProcessStageData
  assetSummary?: NodeAssetSummary
  ports: GraphPort[]
}

export type GraphEdge = {
  id: string
  sourceNodeId: string
  sourcePortId: string
  sourceAnchor?: EdgeEndpointAnchor
  targetNodeId: string
  targetPortId: string
  targetAnchor?: EdgeEndpointAnchor
  label: string
  color?: string
  kind?: 'handoff'
  fromRole?: string
  toRole?: string
  artifact?: string
  expectation?: string
  readinessSignal?: string
  reviewStatus?: ReviewStatus
  workProductIds?: string[]
  assetSummary?: EdgeAssetSummary
  processInstanceId?: string
  sharedProcessHandoffId?: string
  /** A direct Stage edge saved before Stage became a no-port container. */
  legacyStageConnection?: boolean
}

export type ProcessInstance = {
  id: string
  processId: string
  x: number
  y: number
  nodeIdsByPlacement: Record<string, string>
  nodeIdsByDecision: Record<string, string>
  stageNodeIdsByStage: Record<string, string>
  edgeIdsByHandoff: Record<string, string>
}

export type GraphViewport = {
  x: number
  y: number
  zoom: number
}

export type GraphLayoutProfile = 'generated-flow' | 'left-to-right' | 'swimlane'

export type ConnectionCreateRequest = {
  sourceNodeId: string
  sourcePortId: string
  sourceAnchor?: EdgeEndpointAnchor
  worldPosition: { x: number; y: number }
  screenPosition: { x: number; y: number }
  clientPosition?: { x: number; y: number }
}

export type GraphDocument = {
  id: string
  nodes: Map<string, GraphNode>
  edges: Map<string, GraphEdge>
  processAssets: ProcessAssets
  processInstances: Record<string, ProcessInstance>
  selectedNodeIds: Set<string>
  selectedEdgeIds: Set<string>
  viewport: GraphViewport
  meta: {
    dirty: boolean
    version: number
    layoutProfile?: GraphLayoutProfile
    layoutNodeOrder?: string[]
    processAnalysis?: ProcessAnalysisSettings
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
            | 'responsibilities'
            | 'expectations'
            | 'owner'
            | 'goal'
            | 'entryCondition'
            | 'exitCondition'
            | 'symptom'
            | 'impact'
            | 'suspectedCause'
            | 'reviewStatus'
            | 'processStage'
            | 'memberNodeIds'
            | 'ownerRoleId'
            | 'stagePadding'
            | 'x'
            | 'y'
            | 'width'
            | 'height'
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
            | 'sourceNodeId'
            | 'sourcePortId'
            | 'sourceAnchor'
            | 'targetNodeId'
            | 'targetPortId'
            | 'targetAnchor'
            | 'label'
            | 'color'
            | 'fromRole'
            | 'toRole'
            | 'artifact'
            | 'expectation'
            | 'readinessSignal'
            | 'reviewStatus'
            | 'workProductIds'
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
  responsibilities?: ActivityResponsibility[]
  expectations?: string
  processStage?: ProcessStageData
  assetSummary?: NodeAssetSummary
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
  ownerRoleId?: string
  memberNodeIds?: string[]
  stagePadding?: number
  assetSummary?: NodeAssetSummary
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
      color?: string
      sourceAnchor?: EdgeEndpointAnchor
      targetAnchor?: EdgeEndpointAnchor
      fromRole?: string
    toRole?: string
    artifact?: string
    expectation?: string
    readinessSignal?: string
    reviewStatus?: ReviewStatus
    workProductIds?: string[]
    assetSummary?: EdgeAssetSummary
  }
}
