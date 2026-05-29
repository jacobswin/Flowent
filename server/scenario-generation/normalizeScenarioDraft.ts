import type { Actor, ProcessMap, Role } from '../../src/features/process-map/types'
import type { GeneratedMapFinding, GeneratedSource, ScenarioDraft } from '../../src/features/scenario-generation/types'
import type { ClaudeScenarioDraft } from './scenarioDraftSchemas'

type NormalizeResult = { success: true; data: ScenarioDraft } | { success: false; error: string }

export function normalizeScenarioDraft(draft: ClaudeScenarioDraft): NormalizeResult {
  const actorIds = new Set(draft.actors.map((actor) => actor.id))
  const inputIds = new Set(draft.inputs.map((input) => input.id))
  const outputIds = new Set(draft.outputs.map((output) => output.id))
  const decisionIds = new Set(draft.decisions.map((decision) => decision.id))
  const handoffIds = new Set(draft.handoffs.map((handoff) => handoff.id))
  const expectationIds = new Set(draft.expectations.map((expectation) => expectation.id))
  const workProductIds = new Set(draft.workProducts.map((workProduct) => workProduct.id))

  for (const input of draft.inputs) {
    const unknownActor = input.sourceActorIds.find((actorId) => !actorIds.has(actorId))
    if (unknownActor) return { success: false, error: `Draft input references unknown actor ${unknownActor}.` }
  }

  for (const output of draft.outputs) {
    const unknownActor = [...output.producerActorIds, ...output.recipientActorIds].find(
      (actorId) => !actorIds.has(actorId),
    )
    if (unknownActor) return { success: false, error: `Draft output references unknown actor ${unknownActor}.` }
  }

  for (const decision of draft.decisions) {
    const unknownActor = decision.affectedActorIds.find((actorId) => !actorIds.has(actorId))
    if (unknownActor) return { success: false, error: `Draft decision references unknown actor ${unknownActor}.` }
  }

  for (const handoff of draft.handoffs) {
    const unknownActor = [...handoff.fromActorIds, ...handoff.toActorIds].find((actorId) => !actorIds.has(actorId))
    if (unknownActor) return { success: false, error: `Draft handoff references unknown actor ${unknownActor}.` }

    const unknownInput = handoff.inputIds.find((inputId) => !inputIds.has(inputId))
    if (unknownInput) return { success: false, error: `Draft handoff references unknown input ${unknownInput}.` }

    const unknownOutput = handoff.outputIds.find((outputId) => !outputIds.has(outputId))
    if (unknownOutput) return { success: false, error: `Draft handoff references unknown output ${unknownOutput}.` }

    const unknownExpectation = handoff.expectationIds.find((expectationId) => !expectationIds.has(expectationId))
    if (unknownExpectation) {
      return { success: false, error: `Draft handoff references unknown expectation ${unknownExpectation}.` }
    }
  }

  for (const activity of draft.activities) {
    const unknownActor = activity.responsibilities.find((responsibility) => !actorIds.has(responsibility.actorId))
    if (unknownActor) return { success: false, error: `Draft activity references unknown actor ${unknownActor.actorId}.` }

    const unknownInput = activity.inputIds.find((inputId) => !inputIds.has(inputId))
    if (unknownInput) return { success: false, error: `Draft activity references unknown input ${unknownInput}.` }

    const unknownOutput = activity.outputIds.find((outputId) => !outputIds.has(outputId))
    if (unknownOutput) return { success: false, error: `Draft activity references unknown output ${unknownOutput}.` }

    const unknownDecision = activity.decisionIds.find((decisionId) => !decisionIds.has(decisionId))
    if (unknownDecision) return { success: false, error: `Draft activity references unknown decision ${unknownDecision}.` }

    const unknownHandoff = activity.handoffIds.find((handoffId) => !handoffIds.has(handoffId))
    if (unknownHandoff) return { success: false, error: `Draft activity references unknown handoff ${unknownHandoff}.` }

    const unknownExpectation = activity.expectationIds.find((expectationId) => !expectationIds.has(expectationId))
    if (unknownExpectation) {
      return { success: false, error: `Draft activity references unknown expectation ${unknownExpectation}.` }
    }

    const unknownWorkProduct = activity.workProductIds.find((workProductId) => !workProductIds.has(workProductId))
    if (unknownWorkProduct) {
      return { success: false, error: `Draft activity references unknown work product ${unknownWorkProduct}.` }
    }
  }

  const roles: Role[] = draft.actors
    .filter((actor): actor is ClaudeScenarioDraft['actors'][number] & { kind: 'role' } => actor.kind === 'role')
    .map((actor) => ({ id: actor.id, name: actor.name, kind: actor.kind, focus: actor.focus ?? 'Draft role focus to confirm.' }))
  const stakeholders = pickActorsByKind(draft.actors, 'stakeholder')
  const upstreamActors = pickActorsByKind(draft.actors, 'upstream')
  const downstreamActors = pickActorsByKind(draft.actors, 'downstream')

  const processMap: ProcessMap = {
    id: createDraftId(draft.title),
    title: draft.title,
    status: 'draft',
    scenario: draft.scenario,
    roles,
    stakeholders,
    upstreamActors,
    downstreamActors,
    inputs: draft.inputs,
    outputs: draft.outputs,
    workProducts: draft.workProducts,
    expectations: draft.expectations,
    decisions: draft.decisions,
    handoffs: draft.handoffs,
    activities: draft.activities,
  }

  return {
    success: true,
    data: {
      processMap,
      sourcesById: draft.sourcesById as Record<string, GeneratedSource>,
      findings: buildFindings(draft),
    },
  }
}

function pickActorsByKind(actors: ClaudeScenarioDraft['actors'], kind: Actor['kind']): Actor[] {
  return actors
    .filter((actor) => actor.kind === kind)
    .map((actor) => ({ id: actor.id, name: actor.name, kind: actor.kind })) as Actor[]
}

function buildFindings(draft: ClaudeScenarioDraft): GeneratedMapFinding[] {
  return [
    ...draft.missingInformation.map((message) => ({ kind: 'missing-information' as const, message })),
    ...draft.assumptions.map((message) => ({ kind: 'assumption' as const, message })),
    ...draft.riskPoints.map((message) => ({ kind: 'risk-point' as const, message })),
    ...draft.requiredConfirmations.map((message) => ({ kind: 'required-confirmation' as const, message })),
  ]
}

function createDraftId(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

  return `generated-${slug || 'scenario'}-draft`
}
