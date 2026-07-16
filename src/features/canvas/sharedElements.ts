export type SharedElementKind = 'process' | 'activity' | 'role' | 'workProduct'

export type SharedRole = {
  id: string
  name: string
  description: string
}

export type SharedActivityResponsibility = {
  id: string
  roleId: string
  kind: 'responsible' | 'accountable' | 'supporting' | 'consulted' | 'informed'
}

export type SharedActivityWorkProductLink = {
  id: string
  workProductId: string
  relation: 'input' | 'output'
  maturity: string
}

export type SharedActivity = {
  id: string
  title: string
  summary: string
  expectations: string
  responsibilities: SharedActivityResponsibility[]
  workProductLinks: SharedActivityWorkProductLink[]
}

export type SharedWorkProduct = {
  id: string
  title: string
  state: string
  description: string
}

export type SharedProcessActivityPlacement = {
  id: string
  activityId: string
  x: number
  y: number
}

export type SharedProcessDecision = {
  id: string
  title: string
  criteria: string
  ownerRoleId?: string
  decisionOutcomes: string[]
  x: number
  y: number
}

export type SharedProcessStageMilestone = {
  id: string
  title: string
  description: string
  workProductStates: { workProductId: string; state: string }[]
}

export type SharedProcessStage = {
  id: string
  title: string
  description: string
  goal: string
  entryCondition: string
  exitCondition: string
  ownerRoleId?: string
  x: number
  y: number
  width: number
  height: number
  memberIds: string[]
  milestones: SharedProcessStageMilestone[]
}

export type SharedProcessHandoff = {
  id: string
  /** Generic internal node ids. Old data uses the placement aliases below. */
  sourceNodeId?: string
  targetNodeId?: string
  sourcePlacementId?: string
  targetPlacementId?: string
  label: string
  color?: string
}

export type SharedProcess = {
  id: string
  title: string
  description: string
  activities: SharedProcessActivityPlacement[]
  decisions: SharedProcessDecision[]
  stages: SharedProcessStage[]
  handoffs: SharedProcessHandoff[]
}

export type SharedElementLibrary = {
  roles: Record<string, SharedRole>
  workProducts: Record<string, SharedWorkProduct>
  activities: Record<string, SharedActivity>
  processes: Record<string, SharedProcess>
}

export type SharedElementDeletionImpact = {
  activities: string[]
  processes: string[]
  maps: string[]
}

export function createEmptySharedElementLibrary(): SharedElementLibrary {
  return { roles: {}, workProducts: {}, activities: {}, processes: {} }
}

export function normalizeSharedElementLibrary(value: unknown): SharedElementLibrary {
  if (!value || typeof value !== 'object') return createEmptySharedElementLibrary()
  const candidate = value as Partial<SharedElementLibrary>
  return {
    roles: normalizeRecord(candidate.roles, normalizeRole),
    workProducts: normalizeRecord(candidate.workProducts, normalizeWorkProduct),
    activities: normalizeRecord(candidate.activities, normalizeActivity),
    processes: normalizeRecord(candidate.processes, normalizeProcess),
  }
}

export function ensureSharedRole(
  library: SharedElementLibrary,
  rawName: string,
): { library: SharedElementLibrary; role: SharedRole } {
  const name = rawName.trim()
  if (!name) throw new Error('Role name is required.')
  const normalizedName = normalizeName(name)
  const existing = Object.values(library.roles).find((role) => normalizeName(role.name) === normalizedName)
  if (existing) return { library, role: existing }

  const id = uniqueId('role', name, library.roles)
  const role: SharedRole = { id, name, description: '' }
  return {
    library: { ...library, roles: { ...library.roles, [id]: role } },
    role,
  }
}

export function deleteSharedElement(
  library: SharedElementLibrary,
  kind: SharedElementKind,
  id: string,
): { library: SharedElementLibrary; impact: SharedElementDeletionImpact } {
  const impact: SharedElementDeletionImpact = { activities: [], processes: [], maps: [] }
  if (kind === 'role') {
    if (!library.roles[id]) return { library, impact }
    const activities = Object.fromEntries(Object.entries(library.activities).map(([activityId, activity]) => {
      const responsibilities = activity.responsibilities.filter((item) => item.roleId !== id)
      if (responsibilities.length !== activity.responsibilities.length) impact.activities.push(activityId)
      return [activityId, { ...activity, responsibilities }]
    }))
    const processes = Object.fromEntries(Object.entries(library.processes).map(([processId, process]) => {
      const stages = (process.stages ?? []).map((stage) => stage.ownerRoleId === id ? { ...stage, ownerRoleId: undefined } : stage)
      if (stages.some((stage, index) => stage !== (process.stages ?? [])[index])) impact.processes.push(processId)
      return [processId, { ...process, stages }]
    }))
    const roles = { ...library.roles }
    delete roles[id]
    return { library: { ...library, roles, activities, processes }, impact }
  }

  if (kind === 'workProduct') {
    if (!library.workProducts[id]) return { library, impact }
    const activities = Object.fromEntries(Object.entries(library.activities).map(([activityId, activity]) => {
      const workProductLinks = activity.workProductLinks.filter((link) => link.workProductId !== id)
      if (workProductLinks.length !== activity.workProductLinks.length) impact.activities.push(activityId)
      return [activityId, { ...activity, workProductLinks }]
    }))
    const processes = Object.fromEntries(Object.entries(library.processes).map(([processId, process]) => {
      const stages = (process.stages ?? []).map((stage) => ({
        ...stage,
        milestones: stage.milestones.map((milestone) => ({
          ...milestone,
          workProductStates: milestone.workProductStates.filter((state) => state.workProductId !== id),
        })),
      }))
      return [processId, { ...process, stages }]
    }))
    const workProducts = { ...library.workProducts }
    delete workProducts[id]
    return { library: { ...library, workProducts, activities, processes }, impact }
  }

  if (kind === 'activity') {
    if (!library.activities[id]) return { library, impact }
    const processes = Object.fromEntries(Object.entries(library.processes).map(([processId, process]) => {
      const removedPlacementIds = new Set(process.activities.filter((placement) => placement.activityId === id).map((placement) => placement.id))
      const activities = process.activities.filter((placement) => placement.activityId !== id)
      const handoffs = process.handoffs.filter((handoff) => !removedPlacementIds.has(getSharedProcessHandoffSourceId(handoff)) && !removedPlacementIds.has(getSharedProcessHandoffTargetId(handoff)))
      const stages = (process.stages ?? []).map((stage) => ({
        ...stage,
        memberIds: stage.memberIds.filter((memberId) => !removedPlacementIds.has(memberId)),
      }))
      if (removedPlacementIds.size > 0) impact.processes.push(processId)
      return [processId, { ...process, activities, handoffs, stages }]
    }))
    const activities = { ...library.activities }
    delete activities[id]
    return { library: { ...library, activities, processes }, impact }
  }

  if (!library.processes[id]) return { library, impact }
  const processes = { ...library.processes }
  delete processes[id]
  return { library: { ...library, processes }, impact }
}

export function getSharedRoleName(library: SharedElementLibrary, roleId: string): string {
  return library.roles[roleId]?.name ?? ''
}

function normalizeRecord<T>(
  value: Record<string, T> | undefined,
  normalize: (item: T, id: string) => T,
): Record<string, T> {
  if (!value || typeof value !== 'object') return {}
  return Object.fromEntries(Object.entries(value).map(([id, item]) => [id, normalize(item, id)]))
}

function normalizeRole(value: SharedRole, id: string): SharedRole {
  return { id: value?.id || id, name: value?.name?.trim() || id, description: value?.description ?? '' }
}

function normalizeWorkProduct(value: SharedWorkProduct, id: string): SharedWorkProduct {
  return {
    id: value?.id || id,
    title: value?.title?.trim() || id,
    state: value?.state?.trim() || 'Draft',
    description: value?.description ?? '',
  }
}

function normalizeActivity(value: SharedActivity, id: string): SharedActivity {
  return {
    id: value?.id || id,
    title: value?.title?.trim() || id,
    summary: value?.summary ?? '',
    expectations: value?.expectations ?? '',
    responsibilities: Array.isArray(value?.responsibilities) ? value.responsibilities : [],
    workProductLinks: Array.isArray(value?.workProductLinks) ? value.workProductLinks : [],
  }
}

function normalizeProcess(value: SharedProcess, id: string): SharedProcess {
  return {
    id: value?.id || id,
    title: value?.title?.trim() || id,
    description: value?.description ?? '',
    activities: Array.isArray(value?.activities) ? value.activities : [],
    decisions: Array.isArray(value?.decisions) ? value.decisions.map(normalizeDecision) : [],
    stages: Array.isArray(value?.stages) ? value.stages.map(normalizeStage) : [],
    handoffs: Array.isArray(value?.handoffs) ? value.handoffs.map(normalizeHandoff) : [],
  }
}

export function getSharedProcessHandoffSourceId(handoff: SharedProcessHandoff): string {
  return handoff.sourceNodeId ?? handoff.sourcePlacementId ?? ''
}

export function getSharedProcessHandoffTargetId(handoff: SharedProcessHandoff): string {
  return handoff.targetNodeId ?? handoff.targetPlacementId ?? ''
}

function normalizeDecision(value: SharedProcessDecision): SharedProcessDecision {
  return {
    id: value?.id || uniqueId('decision', value?.title ?? 'decision', {}),
    title: value?.title?.trim() || 'New decision',
    criteria: value?.criteria ?? '',
    ...(value?.ownerRoleId ? { ownerRoleId: value.ownerRoleId } : {}),
    decisionOutcomes: Array.isArray(value?.decisionOutcomes) ? value.decisionOutcomes.filter(Boolean) : [],
    x: Number.isFinite(value?.x) ? value.x : 0,
    y: Number.isFinite(value?.y) ? value.y : 0,
  }
}

function normalizeStage(value: SharedProcessStage): SharedProcessStage {
  return {
    id: value?.id || uniqueId('stage', value?.title ?? 'stage', {}),
    title: value?.title?.trim() || 'New stage',
    description: value?.description ?? '',
    goal: value?.goal ?? '',
    entryCondition: value?.entryCondition ?? '',
    exitCondition: value?.exitCondition ?? '',
    ...(value?.ownerRoleId ? { ownerRoleId: value.ownerRoleId } : {}),
    x: Number.isFinite(value?.x) ? value.x : 0,
    y: Number.isFinite(value?.y) ? value.y : 0,
    width: Number.isFinite(value?.width) ? Math.max(260, value.width) : 320,
    height: Number.isFinite(value?.height) ? Math.max(160, value.height) : 220,
    memberIds: Array.isArray(value?.memberIds) ? Array.from(new Set(value.memberIds.filter(Boolean))) : [],
    milestones: Array.isArray(value?.milestones) ? value.milestones.map((milestone) => ({
      id: milestone?.id || uniqueId('milestone', milestone?.title ?? 'milestone', {}),
      title: milestone?.title?.trim() || 'Milestone',
      description: milestone?.description ?? '',
      workProductStates: Array.isArray(milestone?.workProductStates) ? milestone.workProductStates.filter((state) => state?.workProductId && state?.state) : [],
    })) : [],
  }
}

function normalizeHandoff(value: SharedProcessHandoff): SharedProcessHandoff {
  const sourceNodeId = value?.sourceNodeId ?? value?.sourcePlacementId ?? ''
  const targetNodeId = value?.targetNodeId ?? value?.targetPlacementId ?? ''
  return {
    id: value?.id || uniqueId('handoff', `${sourceNodeId}-${targetNodeId}`, {}),
    sourceNodeId,
    targetNodeId,
    // Keep aliases while existing Process editor and maps migrate.
    sourcePlacementId: sourceNodeId,
    targetPlacementId: targetNodeId,
    label: value?.label ?? '',
    ...(value?.color ? { color: value.color } : {}),
  }
}

function normalizeName(value: string): string {
  return value.trim().toLocaleLowerCase()
}

function uniqueId(prefix: string, value: string, entries: Record<string, unknown>): string {
  const stem = value.trim().toLocaleLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'item'
  const base = `${prefix}-${stem}`
  if (!entries[base]) return base
  let index = 2
  while (entries[`${base}-${index}`]) index += 1
  return `${base}-${index}`
}
