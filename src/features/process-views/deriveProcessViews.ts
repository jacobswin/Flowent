import type {
  Activity,
  Actor,
  Decision,
  Expectation,
  Handoff,
  ProcessMap,
  ProcessOutput,
  Role,
  WorkProduct,
} from '../process-map/types'

export type ProcessViewKind = 'manager' | 'process-owner' | 'quality-review' | 'stakeholder'

type GapSeverity = 'low' | 'medium' | 'high'

export interface ProcessGap {
  id: string
  title: string
  severity: GapSeverity
}

export interface ManagerView {
  kind: 'manager'
  processTitle: string
  processStatus: ProcessMap['status']
  scenario: string
  participatingRoles: Role[]
  stakeholders: Actor[]
  startActivity: Activity
  endActivity: Activity
  handoffs: Handoff[]
  decisions: Decision[]
  readinessSignals: string[]
}

export interface ProcessOwnerView {
  kind: 'process-owner'
  processTitle: string
  gaps: ProcessGap[]
  completenessSignals: string[]
}

export interface QualityReviewView {
  kind: 'quality-review'
  processTitle: string
  reviewableWorkProducts: WorkProduct[]
  completionStandards: Expectation[]
  decisionRationale: Decision[]
  reviewHandoffs: Handoff[]
}

export interface StakeholderView {
  kind: 'stakeholder'
  processTitle: string
  stakeholder: Actor
  consultedActivities: Activity[]
  informedActivities: Activity[]
  affectedOutputs: ProcessOutput[]
  affectedDecisions: Decision[]
  involvementSummary: string[]
}

export function deriveManagerView(processMap: ProcessMap): ManagerView {
  return {
    kind: 'manager',
    processTitle: processMap.title,
    processStatus: processMap.status,
    scenario: processMap.scenario,
    participatingRoles: processMap.roles,
    stakeholders: processMap.stakeholders,
    startActivity: requireActivity(processMap, 0, 'start'),
    endActivity: requireActivity(processMap, processMap.activities.length - 1, 'end'),
    handoffs: processMap.handoffs,
    decisions: processMap.decisions,
    readinessSignals: [
      `${processMap.activities.length} activities mapped`,
      `${processMap.handoffs.length} handoffs visible`,
      `${processMap.decisions.filter((decision) => decision.criteria.trim().length > 0).length} decisions have criteria`,
      `${processMap.expectations.length} completion expectations defined`,
    ],
  }
}

export function deriveProcessOwnerView(processMap: ProcessMap): ProcessOwnerView {
  const gaps = [
    ...processMap.activities
      .filter((activity) => !hasOwner(activity))
      .map((activity) => toGap(`activity-owner:${activity.id}`, `${activity.title} has no responsible or accountable actor`, 'high')),
    ...processMap.inputs
      .filter((input) => input.sourceActorIds.length === 0)
      .map((input) => toGap(`input-source:${input.id}`, `${input.title} has no upstream source`, 'high')),
    ...processMap.outputs
      .filter((output) => output.recipientActorIds.length === 0)
      .map((output) => toGap(`output-recipient:${output.id}`, `${output.title} has no downstream recipient`, 'high')),
    ...processMap.decisions
      .filter((decision) => decision.criteria.trim().length === 0)
      .map((decision) => toGap(`decision-criteria:${decision.id}`, `${decision.title} has no decision criteria`, 'medium')),
    ...processMap.activities
      .filter((activity) => activity.expectationIds.length === 0)
      .map((activity) => toGap(`activity-expectations:${activity.id}`, `${activity.title} has no completion expectations`, 'medium')),
  ]

  return {
    kind: 'process-owner',
    processTitle: processMap.title,
    gaps,
    completenessSignals: [
      signalOrGap(
        processMap.activities.every(hasOwner),
        'Every activity has a responsible or accountable actor',
        'Some activities still need an owner',
      ),
      signalOrGap(
        processMap.inputs.every((input) => input.sourceActorIds.length > 0),
        'Every input names an upstream source',
        'Some inputs still need upstream sources',
      ),
      signalOrGap(
        processMap.outputs.every((output) => output.recipientActorIds.length > 0),
        'Every output names a downstream recipient',
        'Some outputs still need downstream recipients',
      ),
      signalOrGap(
        processMap.decisions.every((decision) => decision.criteria.trim().length > 0),
        'Every decision has decision criteria',
        'Some decisions still need criteria',
      ),
    ],
  }
}

export function deriveQualityReviewView(processMap: ProcessMap): QualityReviewView {
  return {
    kind: 'quality-review',
    processTitle: processMap.title,
    reviewableWorkProducts: processMap.workProducts,
    completionStandards: processMap.expectations,
    decisionRationale: processMap.decisions.filter((decision) => decision.criteria.trim().length > 0),
    reviewHandoffs: processMap.handoffs.filter((handoff) => handoff.expectationIds.length > 0),
  }
}

export function deriveStakeholderView(processMap: ProcessMap, stakeholderId: string): StakeholderView {
  const stakeholder = processMap.stakeholders.find((candidate) => candidate.id === stakeholderId)

  if (!stakeholder) {
    throw new Error(`Stakeholder ${stakeholderId} was not found in ${processMap.title}`)
  }

  const consultedActivities = activitiesForResponsibility(processMap, stakeholderId, 'consulted')
  const informedActivities = activitiesForResponsibility(processMap, stakeholderId, 'informed')
  const affectedOutputIds = collectIds([
    ...consultedActivities.flatMap((activity) => activity.outputIds),
    ...informedActivities.flatMap((activity) => activity.outputIds),
    ...processMap.outputs.filter((output) => output.recipientActorIds.includes(stakeholderId)).map((output) => output.id),
  ])
  const affectedOutputs = pickByIds(processMap.outputs, affectedOutputIds)
  const affectedDecisions = processMap.decisions.filter((decision) => decision.affectedActorIds.includes(stakeholderId))

  return {
    kind: 'stakeholder',
    processTitle: processMap.title,
    stakeholder,
    consultedActivities,
    informedActivities,
    affectedOutputs,
    affectedDecisions,
    involvementSummary: [
      summarizeCount('Consulted on', consultedActivities.length, 'activity'),
      summarizeCount('Affected by', affectedOutputs.length, 'output'),
      affectedDecisions.length > 0
        ? summarizeCount('Affected by', affectedDecisions.length, 'decision')
        : 'No affected decisions required yet',
    ],
  }
}

function requireActivity(processMap: ProcessMap, index: number, label: string): Activity {
  const activity = processMap.activities[index]

  if (!activity) {
    throw new Error(`${processMap.title} has no ${label} activity`)
  }

  return activity
}

function hasOwner(activity: Activity): boolean {
  return activity.responsibilities.some(
    (responsibility) => responsibility.kind === 'responsible' || responsibility.kind === 'accountable',
  )
}

function toGap(id: string, title: string, severity: GapSeverity): ProcessGap {
  return { id, title, severity }
}

function signalOrGap(isComplete: boolean, complete: string, incomplete: string): string {
  return isComplete ? complete : incomplete
}

function collectIds(ids: string[]): string[] {
  return [...new Set(ids)]
}

function pickByIds<T extends { id: string }>(items: T[], ids: string[]): T[] {
  return ids.flatMap((id) => {
    const item = items.find((candidate) => candidate.id === id)
    return item ? [item] : []
  })
}

function activitiesForResponsibility(
  processMap: ProcessMap,
  actorId: string,
  responsibilityKind: Activity['responsibilities'][number]['kind'],
): Activity[] {
  return processMap.activities.filter((activity) =>
    activity.responsibilities.some(
      (responsibility) => responsibility.actorId === actorId && responsibility.kind === responsibilityKind,
    ),
  )
}

function summarizeCount(prefix: string, count: number, singular: string): string {
  const noun = count === 1 ? singular : `${singular}s`
  return `${prefix} ${count} ${noun}`
}
