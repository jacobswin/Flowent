import type { GraphDocument } from '../canvasTypes'

export type DiagnosticSeverity = 'info' | 'warning'

export interface ProcessMapDiagnostic {
  id: string
  targetType: 'node' | 'edge'
  targetId: string
  severity: DiagnosticSeverity
  title: string
  detail: string
}

export function getProcessMapDiagnostics(doc: GraphDocument): ProcessMapDiagnostic[] {
  const diagnostics: ProcessMapDiagnostic[] = []

  for (const node of doc.nodes.values()) {
    if (node.type === 'activity' && node.roleTags.length === 0) {
      diagnostics.push({
        id: `node-${node.id}-missing-role`,
        targetType: 'node',
        targetId: node.id,
        severity: 'warning',
        title: 'Activity needs responsible roles',
        detail: 'Add at least one responsible role so ownership is visible on the map.',
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

  return diagnostics
}

function hasText(value: string | undefined): boolean {
  return typeof value === 'string' && value.trim().length > 0
}
