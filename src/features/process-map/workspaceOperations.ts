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
  WorkProduct,
} from './types'
import type { GeneratedSource } from '../scenario-generation/types'

export interface WorkspaceResult {
  map: ProcessMap
  sources: Record<string, GeneratedSource>
}

export interface ReadinessStatus {
  hasActivities: boolean
  hasRoles: boolean
  isReady: boolean
  missing: string[]
}

function markSource(
  sources: Record<string, GeneratedSource>,
  id: string,
  source: GeneratedSource = 'user-provided',
): Record<string, GeneratedSource> {
  return { ...sources, [id]: source }
}

function unmarkSource(
  sources: Record<string, GeneratedSource>,
  id: string,
): Record<string, GeneratedSource> {
  const next = { ...sources }
  delete next[id]
  return next
}

export function addActivity(
  map: ProcessMap,
  sources: Record<string, GeneratedSource>,
  activity: Activity,
): WorkspaceResult {
  return {
    map: { ...map, activities: [...map.activities, activity] },
    sources: markSource(sources, activity.id),
  }
}

export function removeActivity(
  map: ProcessMap,
  sources: Record<string, GeneratedSource>,
  activityId: string,
): WorkspaceResult {
  return {
    map: { ...map, activities: map.activities.filter((a) => a.id !== activityId) },
    sources: unmarkSource(sources, activityId),
  }
}

export function updateActivity(
  map: ProcessMap,
  sources: Record<string, GeneratedSource>,
  activityId: string,
  updates: Partial<Pick<Activity, 'title' | 'summary' | 'responsibilities' | 'inputIds' | 'outputIds' | 'decisionIds' | 'handoffIds' | 'expectationIds' | 'workProductIds'>>,
): WorkspaceResult {
  return {
    map: {
      ...map,
      activities: map.activities.map((a) => (a.id === activityId ? { ...a, ...updates } : a)),
    },
    sources: markSource(sources, activityId),
  }
}

export function addDecision(
  map: ProcessMap,
  sources: Record<string, GeneratedSource>,
  decision: Decision,
): WorkspaceResult {
  return {
    map: { ...map, decisions: [...map.decisions, decision] },
    sources: markSource(sources, decision.id),
  }
}

export function removeDecision(
  map: ProcessMap,
  sources: Record<string, GeneratedSource>,
  decisionId: string,
): WorkspaceResult {
  return {
    map: { ...map, decisions: map.decisions.filter((d) => d.id !== decisionId) },
    sources: unmarkSource(sources, decisionId),
  }
}

export function updateDecision(
  map: ProcessMap,
  sources: Record<string, GeneratedSource>,
  decisionId: string,
  updates: Partial<Pick<Decision, 'title' | 'affectedActorIds' | 'criteria'>>,
): WorkspaceResult {
  return {
    map: {
      ...map,
      decisions: map.decisions.map((d) => (d.id === decisionId ? { ...d, ...updates } : d)),
    },
    sources: markSource(sources, decisionId),
  }
}

export function addHandoff(
  map: ProcessMap,
  sources: Record<string, GeneratedSource>,
  handoff: Handoff,
): WorkspaceResult {
  return {
    map: { ...map, handoffs: [...map.handoffs, handoff] },
    sources: markSource(sources, handoff.id),
  }
}

export function removeHandoff(
  map: ProcessMap,
  sources: Record<string, GeneratedSource>,
  handoffId: string,
): WorkspaceResult {
  return {
    map: { ...map, handoffs: map.handoffs.filter((h) => h.id !== handoffId) },
    sources: unmarkSource(sources, handoffId),
  }
}

export function updateHandoff(
  map: ProcessMap,
  sources: Record<string, GeneratedSource>,
  handoffId: string,
  updates: Partial<Pick<Handoff, 'title' | 'fromActorIds' | 'toActorIds' | 'inputIds' | 'outputIds' | 'expectationIds'>>,
): WorkspaceResult {
  return {
    map: {
      ...map,
      handoffs: map.handoffs.map((h) => (h.id === handoffId ? { ...h, ...updates } : h)),
    },
    sources: markSource(sources, handoffId),
  }
}

export function addRole(
  map: ProcessMap,
  sources: Record<string, GeneratedSource>,
  role: Role,
): WorkspaceResult {
  return {
    map: { ...map, roles: [...map.roles, role] },
    sources: markSource(sources, role.id),
  }
}

export function removeRole(
  map: ProcessMap,
  sources: Record<string, GeneratedSource>,
  roleId: string,
): WorkspaceResult {
  return {
    map: { ...map, roles: map.roles.filter((r) => r.id !== roleId) },
    sources: unmarkSource(sources, roleId),
  }
}

export function addStakeholder(
  map: ProcessMap,
  sources: Record<string, GeneratedSource>,
  actor: Actor,
): WorkspaceResult {
  return {
    map: { ...map, stakeholders: [...map.stakeholders, actor] },
    sources: markSource(sources, actor.id),
  }
}

export function removeStakeholder(
  map: ProcessMap,
  sources: Record<string, GeneratedSource>,
  actorId: string,
): WorkspaceResult {
  return {
    map: { ...map, stakeholders: map.stakeholders.filter((a) => a.id !== actorId) },
    sources: unmarkSource(sources, actorId),
  }
}

export function addInput(
  map: ProcessMap,
  sources: Record<string, GeneratedSource>,
  input: ProcessInput,
): WorkspaceResult {
  return {
    map: { ...map, inputs: [...map.inputs, input] },
    sources: markSource(sources, input.id),
  }
}

export function removeInput(
  map: ProcessMap,
  sources: Record<string, GeneratedSource>,
  inputId: string,
): WorkspaceResult {
  return {
    map: { ...map, inputs: map.inputs.filter((i) => i.id !== inputId) },
    sources: unmarkSource(sources, inputId),
  }
}

export function addOutput(
  map: ProcessMap,
  sources: Record<string, GeneratedSource>,
  output: ProcessOutput,
): WorkspaceResult {
  return {
    map: { ...map, outputs: [...map.outputs, output] },
    sources: markSource(sources, output.id),
  }
}

export function removeOutput(
  map: ProcessMap,
  sources: Record<string, GeneratedSource>,
  outputId: string,
): WorkspaceResult {
  return {
    map: { ...map, outputs: map.outputs.filter((o) => o.id !== outputId) },
    sources: unmarkSource(sources, outputId),
  }
}

export function addExpectation(
  map: ProcessMap,
  sources: Record<string, GeneratedSource>,
  expectation: Expectation,
): WorkspaceResult {
  return {
    map: { ...map, expectations: [...map.expectations, expectation] },
    sources: markSource(sources, expectation.id),
  }
}

export function removeExpectation(
  map: ProcessMap,
  sources: Record<string, GeneratedSource>,
  expectationId: string,
): WorkspaceResult {
  return {
    map: { ...map, expectations: map.expectations.filter((e) => e.id !== expectationId) },
    sources: unmarkSource(sources, expectationId),
  }
}

export function addWorkProduct(
  map: ProcessMap,
  sources: Record<string, GeneratedSource>,
  workProduct: WorkProduct,
): WorkspaceResult {
  return {
    map: { ...map, workProducts: [...map.workProducts, workProduct] },
    sources: markSource(sources, workProduct.id),
  }
}

export function removeWorkProduct(
  map: ProcessMap,
  sources: Record<string, GeneratedSource>,
  workProductId: string,
): WorkspaceResult {
  return {
    map: { ...map, workProducts: map.workProducts.filter((w) => w.id !== workProductId) },
    sources: unmarkSource(sources, workProductId),
  }
}

export function updateMapTitle(map: ProcessMap, title: string): ProcessMap {
  return { ...map, title }
}

export function updateMapScenario(map: ProcessMap, scenario: string): ProcessMap {
  return { ...map, scenario }
}

export function createEmptyMap(): ProcessMap {
  return {
    id: `map-${Date.now()}`,
    title: 'Untitled process map',
    status: 'draft',
    scenario: '',
    roles: [],
    stakeholders: [],
    upstreamActors: [],
    downstreamActors: [],
    inputs: [],
    outputs: [],
    workProducts: [],
    expectations: [],
    decisions: [],
    handoffs: [],
    activities: [],
  }
}

export function computeReadiness(map: ProcessMap): ReadinessStatus {
  const hasActivities = map.activities.length > 0
  const hasRoles = map.roles.length > 0
  const missing: string[] = []

  if (!hasActivities) missing.push('Add at least one activity.')
  if (!hasRoles) missing.push('Add at least one role.')

  return {
    hasActivities,
    hasRoles,
    isReady: missing.length === 0,
    missing,
  }
}
