import type { GraphDocument } from '../canvasTypes'
import { getActivityResponsibilities, getWorkProductActivityLinks } from '../processAssets'

export type DiagnosticSeverity = 'info' | 'warning'

export interface ProcessMapDiagnostic {
  id: string
  targetType: 'node' | 'edge' | 'asset'
  targetId: string
  severity: DiagnosticSeverity
  title: string
  detail: string
}

export function getProcessMapDiagnostics(doc: GraphDocument): ProcessMapDiagnostic[] {
  const diagnostics: ProcessMapDiagnostic[] = []

  for (const node of doc.nodes.values()) {
    if (node.type === 'activity' && getActivityResponsibilities(node).length === 0) {
      diagnostics.push({
        id: `node-${node.id}-missing-role`,
        targetType: 'node',
        targetId: node.id,
        severity: 'warning',
        title: 'Activity needs responsible roles',
        detail: 'Add at least one responsible role so ownership is visible on the map.',
      })
    }

    if (
      node.type === 'activity' &&
      getActivityResponsibilities(node).length > 0 &&
      !getActivityResponsibilities(node).some((responsibility) =>
        responsibility.kind === 'responsible' || responsibility.kind === 'accountable'
      )
    ) {
      diagnostics.push({
        id: `node-${node.id}-missing-rasic-owner`,
        targetType: 'node',
        targetId: node.id,
        severity: 'warning',
        title: 'Activity needs a responsible or accountable role',
        detail: 'Add a Responsible or Accountable role so ownership is clear enough to execute.',
      })
    }

    if (node.type === 'activity' && !hasText(node.expectations)) {
      diagnostics.push({
        id: `node-${node.id}-missing-expectations`,
        targetType: 'node',
        targetId: node.id,
        severity: 'info',
        title: 'Activity expectation is missing',
        detail: 'Describe what makes this activity ready, complete, or acceptable.',
      })
    }

    if (node.type === 'decision' && !hasText(node.criteria)) {
      diagnostics.push({
        id: `node-${node.id}-missing-criteria`,
        targetType: 'node',
        targetId: node.id,
        severity: 'warning',
        title: 'Decision criteria are missing',
        detail: 'Add criteria so the team knows how this decision is made.',
      })
    }

    if (node.type === 'stage' && !hasText(node.exitCondition)) {
      diagnostics.push({
        id: `node-${node.id}-missing-exit`,
        targetType: 'node',
        targetId: node.id,
        severity: 'info',
        title: 'Stage exit condition is missing',
        detail: 'Add an exit condition so the team knows when the stage is complete.',
      })
    }

    if (node.type === 'bottleneck' && node.reviewStatus !== 'approved') {
      diagnostics.push({
        id: `node-${node.id}-open-bottleneck`,
        targetType: 'node',
        targetId: node.id,
        severity: 'warning',
        title: 'Bottleneck needs review',
        detail: 'Clarify owner, cause, and next action before marking this bottleneck approved.',
      })
    }
  }

  for (const edge of doc.edges.values()) {
    if (edge.legacyStageConnection) {
      diagnostics.push({
        id: `edge-${edge.id}-legacy-stage-connection`,
        targetType: 'edge',
        targetId: edge.id,
        severity: 'warning',
        title: 'Legacy connection is attached to a Stage',
        detail: 'Reconnect this handoff to an Activity or Decision inside the Stage, then the compatibility marker will be removed.',
      })
    }
    if (!hasText(edge.expectation)) {
      diagnostics.push({
        id: `edge-${edge.id}-missing-expectation`,
        targetType: 'edge',
        targetId: edge.id,
        severity: 'warning',
        title: 'Handoff expectation is missing',
        detail: 'Describe what context, artifact, or signal moves across this handoff.',
      })
    }
  }

  for (const workProduct of Object.values(doc.processAssets.workProducts)) {
    const activityLinks = getWorkProductActivityLinks(workProduct)
    const producerCount = activityLinks.filter((link) => link.relation === 'output').length
    const consumerCount = activityLinks.filter((link) => link.relation === 'input').length
    if (producerCount === 0 || consumerCount === 0) {
      diagnostics.push({
        id: `asset-${workProduct.id}-unconnected-work-product`,
        targetType: 'asset',
        targetId: workProduct.id,
        severity: 'warning',
        title: 'Work product is not connected to the process',
        detail: 'Link this work product to at least one producing and consuming activity.',
      })
    }
    if (hasMaturityRelationConflict(activityLinks)) {
      diagnostics.push({
        id: `asset-${workProduct.id}-maturity-conflict`,
        targetType: 'asset',
        targetId: workProduct.id,
        severity: 'warning',
        title: 'Work product has conflicting maturity links',
        detail: 'A work product cannot be both input and output for the same activity at the same maturity.',
      })
    }
  }

  for (const guidance of Object.values(doc.processAssets.guidanceItems)) {
    if (
      guidance.appliesToNodeIds.length === 0 &&
      guidance.appliesToEdgeIds.length === 0 &&
      guidance.workProductIds.length === 0
    ) {
      diagnostics.push({
        id: `asset-${guidance.id}-unlinked-guidance`,
        targetType: 'asset',
        targetId: guidance.id,
        severity: 'info',
        title: 'Guidance is not linked to process work',
        detail: 'Attach this guidance to an activity, handoff, or work product so teams can find it in context.',
      })
    }
  }

  for (const milestone of Object.values(doc.processAssets.milestones)) {
    if (!milestone.stageNodeId || milestone.workProductStates.length === 0) {
      diagnostics.push({
        id: `asset-${milestone.id}-missing-timing-evidence`,
        targetType: 'asset',
        targetId: milestone.id,
        severity: 'info',
        title: 'Milestone needs timing evidence',
        detail: 'Connect this milestone to a stage and at least one expected work product maturity.',
      })
    }
  }

  return diagnostics
}

function hasText(value: string | undefined): boolean {
  return typeof value === 'string' && value.trim().length > 0
}

function hasMaturityRelationConflict(links: ReturnType<typeof getWorkProductActivityLinks>): boolean {
  const inputs = new Set<string>()
  const outputs = new Set<string>()
  for (const link of links) {
    const key = `${link.nodeId}:${link.maturity}`
    if (link.relation === 'input') inputs.add(key)
    if (link.relation === 'output') outputs.add(key)
  }
  return [...inputs].some((key) => outputs.has(key))
}
