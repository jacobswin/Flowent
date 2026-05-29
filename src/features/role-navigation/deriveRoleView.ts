import type {
  Activity,
  Actor,
  Decision,
  Expectation,
  Handoff,
  ProcessInput,
  ProcessMap,
  ProcessOutput,
  Role,
} from '../process-map/types'

export type RoleView = {
  role: Role
  processTitle: string
  processStatus: ProcessMap['status']
  scenario: string
  activities: Activity[]
  requiredInputs: ProcessInput[]
  producedOutputs: ProcessOutput[]
  upstreamDependencies: Actor[]
  downstreamRecipients: Actor[]
  decisions: Decision[]
  handoffs: Handoff[]
  expectations: Expectation[]
}

export function deriveRoleView(processMap: ProcessMap, roleId: string): RoleView {
  const role = processMap.roles.find((candidate) => candidate.id === roleId)

  if (!role) {
    throw new Error(`Role ${roleId} was not found in ${processMap.title}`)
  }

  const activities = processMap.activities.filter((activity) =>
    activity.responsibilities.some((responsibility) => responsibility.actorId === roleId),
  )
  const ownedActivities = activities.filter((activity) =>
    activity.responsibilities.some(
      (responsibility) =>
        responsibility.actorId === roleId &&
        (responsibility.kind === 'responsible' || responsibility.kind === 'accountable'),
    ),
  )

  const inputIds = collectIds(activities.flatMap((activity) => activity.inputIds))
  const outputIds = collectIds(ownedActivities.flatMap((activity) => activity.outputIds))
  const decisionIds = collectIds([
    ...activities.flatMap((activity) => activity.decisionIds),
    ...processMap.decisions
      .filter((decision) => decision.affectedActorIds.includes(roleId))
      .map((decision) => decision.id),
  ])
  const handoffIds = collectIds([
    ...activities.flatMap((activity) => activity.handoffIds),
    ...processMap.handoffs
      .filter(
        (handoff) => handoff.fromActorIds.includes(roleId) || handoff.toActorIds.includes(roleId),
      )
      .map((handoff) => handoff.id),
  ])
  const expectationIds = collectIds([
    ...activities.flatMap((activity) => activity.expectationIds),
    ...processMap.expectations
      .filter((expectation) => expectation.roleIds.includes(roleId))
      .map((expectation) => expectation.id),
  ])

  const requiredInputs = pickByIds(processMap.inputs, inputIds).filter(
    (input) => !input.sourceActorIds.includes(roleId),
  )
  const producedOutputs = pickByIds(processMap.outputs, outputIds).filter((output) =>
    output.producerActorIds.includes(roleId),
  )
  const decisions = pickByIds(processMap.decisions, decisionIds)
  const handoffs = pickByIds(processMap.handoffs, handoffIds)
  const expectations = pickByIds(processMap.expectations, expectationIds)

  const upstreamActorIds = [
    ...handoffs
      .filter((handoff) => handoff.toActorIds.includes(roleId))
      .flatMap((handoff) => handoff.fromActorIds),
    ...requiredInputs.flatMap((input) => input.sourceActorIds),
  ]
  const downstreamActorIds = [
    ...handoffs
      .filter((handoff) => handoff.fromActorIds.includes(roleId))
      .flatMap((handoff) => handoff.toActorIds),
    ...producedOutputs.flatMap((output) => output.recipientActorIds),
  ]

  return {
    role,
    processTitle: processMap.title,
    processStatus: processMap.status,
    scenario: processMap.scenario,
    activities,
    requiredInputs,
    producedOutputs,
    upstreamDependencies: collectActors(processMap, upstreamActorIds),
    downstreamRecipients: collectActors(processMap, downstreamActorIds),
    decisions,
    handoffs,
    expectations,
  }
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

function collectActors(processMap: ProcessMap, actorIds: string[]): Actor[] {
  const actors = [
    ...processMap.roles,
    ...processMap.stakeholders,
    ...processMap.upstreamActors,
    ...processMap.downstreamActors,
  ]

  return pickByIds(actors, collectIds(actorIds))
}
