export interface EdgeMetadataLike {
  fromRole?: string
  toRole?: string
  artifact?: string
  readinessSignal?: string
  expectation?: string
}

export function getSelectedEdgeMetadataLines(edge: EdgeMetadataLike): string[] {
  const roleText = edge.fromRole && edge.toRole
    ? `${edge.fromRole} → ${edge.toRole}`
    : edge.fromRole ?? edge.toRole ?? ''
  const artifactText = edge.artifact?.trim() ?? ''
  const readinessText = edge.readinessSignal?.trim() ?? ''
  const expectationText = edge.expectation?.trim() ?? ''

  const lines: string[] = []
  if (roleText) lines.push(roleText)

  if (artifactText) {
    lines.push(artifactText)
  } else if (readinessText) {
    lines.push(readinessText)
  } else if (expectationText) {
    // Fall back to the handoff expectation whenever artifact and
    // readiness are absent, even if a role line already exists.
    // Without this, a selected edge like
    // { fromRole: 'PM', toRole: 'Engineer', expectation: 'Ready work includes context and owner.' }
    // would render only the role line and silently drop the only
    // remaining metadata line.
    lines.push(expectationText)
  }

  return lines.filter((line) => line.length > 0).slice(0, 2)
}

export function truncateMetadataLine(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text
  return `${text.slice(0, maxChars - 1)}…`
}
