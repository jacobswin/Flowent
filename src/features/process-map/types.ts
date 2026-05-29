export type ProcessMapStatus = 'draft' | 'active' | 'replaced'

export type ResponsibilityKind =
  | 'responsible'
  | 'accountable'
  | 'supporting'
  | 'consulted'
  | 'informed'

export type Actor = {
  id: string
  name: string
  kind: 'role' | 'stakeholder' | 'upstream' | 'downstream'
}

export type Role = Actor & {
  kind: 'role'
  focus: string
}

export type ProcessInput = {
  id: string
  title: string
  sourceActorIds: string[]
}

export type ProcessOutput = {
  id: string
  title: string
  producerActorIds: string[]
  recipientActorIds: string[]
}

export type WorkProduct = {
  id: string
  title: string
  state: string
}

export type Expectation = {
  id: string
  title: string
  detail: string
  roleIds: string[]
}

export type Decision = {
  id: string
  title: string
  affectedActorIds: string[]
  criteria: string
}

export type Handoff = {
  id: string
  title: string
  fromActorIds: string[]
  toActorIds: string[]
  inputIds: string[]
  outputIds: string[]
  expectationIds: string[]
}

export type ActivityResponsibility = {
  actorId: string
  kind: ResponsibilityKind
}

export type Activity = {
  id: string
  title: string
  summary: string
  responsibilities: ActivityResponsibility[]
  inputIds: string[]
  outputIds: string[]
  decisionIds: string[]
  handoffIds: string[]
  expectationIds: string[]
  workProductIds: string[]
}

export type ProcessMap = {
  id: string
  title: string
  status: ProcessMapStatus
  scenario: string
  roles: Role[]
  stakeholders: Actor[]
  upstreamActors: Actor[]
  downstreamActors: Actor[]
  inputs: ProcessInput[]
  outputs: ProcessOutput[]
  workProducts: WorkProduct[]
  expectations: Expectation[]
  decisions: Decision[]
  handoffs: Handoff[]
  activities: Activity[]
}

export type DraftState =
  | 'draft'
  | 'in-discussion'
  | 'ready-for-confirmation'
  | 'confirmed'
  | 'approved'
  | 'activated'
  | 'rejected'

export type Confirmation = {
  actorId: string
  actorName: string
  actorKind: Actor['kind']
  confirmedAt: string
  comment?: string
}

export type ApprovalState = 'pending' | 'approved' | 'rejected'

export type Approval = {
  approverName: string
  state: ApprovalState
  comment?: string
  decidedAt: string
}

export type ImpactChangeKind = 'added' | 'removed' | 'changed'

export type ImpactChange = {
  kind: ImpactChangeKind
  category: 'activity' | 'decision' | 'handoff' | 'input' | 'output' | 'expectation' | 'work-product' | 'role'
  id: string
  title: string
}

export type ImpactAnalysis = {
  affectedRoles: string[]
  changes: ImpactChange[]
  confirmedBy: string[]
  replacedVersionId?: string
}

export type ProcessMapVersion = {
  id: string
  mapId: string
  title: string
  snapshot: ProcessMap
  confirmations: Confirmation[]
  approval: Approval | null
  impact: ImpactAnalysis
  activatedAt: string
}
