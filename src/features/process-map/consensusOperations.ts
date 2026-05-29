import type {
  Actor,
  Approval,
  Confirmation,
  DraftState,
  ImpactAnalysis,
  ImpactChange,
  ProcessMap,
  ProcessMapVersion,
} from './types'

export interface ConsensusResult {
  map: ProcessMap
  draftState: DraftState
  confirmations: Confirmation[]
  approval: Approval | null
}

export function confirmForRole(
  map: ProcessMap,
  confirmations: Confirmation[],
  actorId: string,
  actorName: string,
  actorKind: Actor['kind'],
): { confirmations: Confirmation[] } {
  const existing = confirmations.find((c) => c.actorId === actorId)
  if (existing) {
    return { confirmations }
  }

  return {
    confirmations: [
      ...confirmations,
      {
        actorId,
        actorName,
        actorKind,
        confirmedAt: new Date().toISOString(),
      },
    ],
  }
}

export function removeConfirmation(confirmations: Confirmation[], actorId: string): Confirmation[] {
  return confirmations.filter((c) => c.actorId !== actorId)
}

export function markReadyForConfirmation(map: ProcessMap, currentState: DraftState): { draftState: DraftState } {
  if (currentState === 'draft' || currentState === 'in-discussion') {
    return { draftState: 'ready-for-confirmation' }
  }
  return { draftState: currentState }
}

export function approveMap(
  map: ProcessMap,
  approverName: string,
  comment?: string,
): { approval: Approval } {
  return {
    approval: {
      approverName,
      state: 'approved',
      comment,
      decidedAt: new Date().toISOString(),
    },
  }
}

export function rejectMap(
  map: ProcessMap,
  approverName: string,
  comment?: string,
): { approval: Approval } {
  return {
    approval: {
      approverName,
      state: 'rejected',
      comment,
      decidedAt: new Date().toISOString(),
    },
  }
}

export function activateMap(map: ProcessMap): ProcessMap {
  return { ...map, status: 'active' }
}

export function computeImpactAnalysis(currentMap: ProcessMap, previousMap: ProcessMap | null): ImpactAnalysis {
  const affectedRoles = currentMap.roles.map((r) => r.name)
  const changes: ImpactChange[] = []

  if (!previousMap) {
    for (const activity of currentMap.activities) {
      changes.push({ kind: 'added', category: 'activity', id: activity.id, title: activity.title })
    }
    for (const decision of currentMap.decisions) {
      changes.push({ kind: 'added', category: 'decision', id: decision.id, title: decision.title })
    }
    for (const handoff of currentMap.handoffs) {
      changes.push({ kind: 'added', category: 'handoff', id: handoff.id, title: handoff.title })
    }
    for (const input of currentMap.inputs) {
      changes.push({ kind: 'added', category: 'input', id: input.id, title: input.title })
    }
    for (const output of currentMap.outputs) {
      changes.push({ kind: 'added', category: 'output', id: output.id, title: output.title })
    }
    for (const expectation of currentMap.expectations) {
      changes.push({ kind: 'added', category: 'expectation', id: expectation.id, title: expectation.title })
    }
    for (const wp of currentMap.workProducts) {
      changes.push({ kind: 'added', category: 'work-product', id: wp.id, title: wp.title })
    }

    return { affectedRoles, changes, confirmedBy: [] }
  }

  compareCollection(previousMap.activities, currentMap.activities, 'activity', changes)
  compareCollection(previousMap.decisions, currentMap.decisions, 'decision', changes)
  compareCollection(previousMap.handoffs, currentMap.handoffs, 'handoff', changes)
  compareCollection(previousMap.inputs, currentMap.inputs, 'input', changes)
  compareCollection(previousMap.outputs, currentMap.outputs, 'output', changes)
  compareCollection(previousMap.expectations, currentMap.expectations, 'expectation', changes)
  compareCollection(previousMap.workProducts, currentMap.workProducts, 'work-product', changes)

  for (const prevRole of previousMap.roles) {
    if (!currentMap.roles.find((r) => r.id === prevRole.id)) {
      changes.push({ kind: 'removed', category: 'role', id: prevRole.id, title: prevRole.name })
    }
  }
  for (const currRole of currentMap.roles) {
    if (!previousMap.roles.find((r) => r.id === currRole.id)) {
      changes.push({ kind: 'added', category: 'role', id: currRole.id, title: currRole.name })
    }
  }

  return {
    affectedRoles,
    changes,
    confirmedBy: [],
    replacedVersionId: previousMap.id,
  }
}

function compareCollection(
  previous: Array<{ id: string; title: string }>,
  current: Array<{ id: string; title: string }>,
  category: ImpactChange['category'],
  changes: ImpactChange[],
): void {
  for (const prev of previous) {
    const curr = current.find((c) => c.id === prev.id)
    if (!curr) {
      changes.push({ kind: 'removed', category, id: prev.id, title: prev.title })
    } else if (curr.title !== prev.title) {
      changes.push({ kind: 'changed', category, id: curr.id, title: curr.title })
    }
  }
  for (const curr of current) {
    if (!previous.find((p) => p.id === curr.id)) {
      changes.push({ kind: 'added', category, id: curr.id, title: curr.title })
    }
  }
}

export function createVersionSnapshot(
  map: ProcessMap,
  confirmations: Confirmation[],
  approval: Approval,
  impact: ImpactAnalysis,
): ProcessMapVersion {
  return {
    id: `version-${Date.now()}`,
    mapId: map.id,
    title: map.title,
    snapshot: map,
    confirmations,
    approval,
    impact,
    activatedAt: new Date().toISOString(),
  }
}
