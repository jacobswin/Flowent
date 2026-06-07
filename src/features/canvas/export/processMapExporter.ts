import type { GraphDocument, GraphNode } from '../canvasTypes'

interface ExportedNode {
  id: string
  type: GraphNode['type']
  title: string
  x: number
  y: number
  width: number
  height: number
  roleTags: string[]
  fields: Record<string, string>
}

interface ExportedEdge {
  id: string
  sourceNodeId: string
  targetNodeId: string
  sourcePortId: string
  targetPortId: string
  label: string
  fields: Record<string, string>
}

export interface ExportedProcessMap {
  nodes: ExportedNode[]
  edges: ExportedEdge[]
  /** SVG width/height derived from the document bounds. */
  width: number
  height: number
  /** ISO timestamp of export. */
  exportedAt: string
}

/**
 * Pure exporter: reads a GraphDocument and produces a flat
 * `ExportedProcessMap` that downstream serializers (SVG/JSON) can
 * consume. This deliberately has no DOM/Pixii dependency so it can run
 * in tests, server routes, and the browser equally.
 */
export function exportProcessMap(doc: GraphDocument): ExportedProcessMap {
  const nodes: ExportedNode[] = []
  for (const node of doc.nodes.values()) {
    nodes.push({
      id: node.id,
      type: node.type,
      title: node.title,
      x: node.x,
      y: node.y,
      width: node.width,
      height: node.height,
      roleTags: [...node.roleTags],
      fields: extractNodeFields(node),
    })
  }
  const edges: ExportedEdge[] = []
  for (const edge of doc.edges.values()) {
    edges.push({
      id: edge.id,
      sourceNodeId: edge.sourceNodeId,
      targetNodeId: edge.targetNodeId,
      sourcePortId: edge.sourcePortId,
      targetPortId: edge.targetPortId,
      label: edge.label,
      fields: extractEdgeFields(edge),
    })
  }
  const bounds = computeBounds(doc)
  return {
    nodes,
    edges,
    width: bounds.width,
    height: bounds.height,
    exportedAt: new Date().toISOString(),
  }
}

function extractNodeFields(node: GraphNode): Record<string, string> {
  const fields: Record<string, string> = {}
  if (node.type === 'activity') {
    if (node.summary) fields.summary = node.summary
    if (node.expectations) fields.expectations = node.expectations
  }
  if (node.type === 'decision') {
    if (node.criteria) fields.criteria = node.criteria
    if (node.owner) fields.owner = node.owner
    if (node.decisionOutcomes && node.decisionOutcomes.length > 0) {
      fields.outcomes = node.decisionOutcomes.join(' / ')
    }
  }
  if (node.type === 'stage') {
    if (node.goal) fields.goal = node.goal
    if (node.entryCondition) fields.entryCondition = node.entryCondition
    if (node.exitCondition) fields.exitCondition = node.exitCondition
    if (node.owner) fields.owner = node.owner
  }
  if (node.type === 'bottleneck') {
    if (node.symptom) fields.symptom = node.symptom
    if (node.impact) fields.impact = node.impact
    if (node.suspectedCause) fields.suspectedCause = node.suspectedCause
    if (node.reviewStatus) fields.reviewStatus = node.reviewStatus
  }
  if (node.type === 'start' || node.type === 'end') {
    if (node.title) fields.title = node.title
  }
  return fields
}

function extractEdgeFields(edge: GraphDocument['edges'] extends Map<string, infer V> ? V : never): Record<string, string> {
  const fields: Record<string, string> = {}
  if (edge.fromRole) fields.fromRole = edge.fromRole
  if (edge.toRole) fields.toRole = edge.toRole
  if (edge.artifact) fields.artifact = edge.artifact
  if (edge.expectation) fields.expectation = edge.expectation
  if (edge.readinessSignal) fields.readinessSignal = edge.readinessSignal
  if (edge.reviewStatus) fields.reviewStatus = edge.reviewStatus
  return fields
}

function computeBounds(doc: GraphDocument): { width: number; height: number } {
  if (doc.nodes.size === 0) {
    return { width: 200, height: 80 }
  }
  let minX = Number.POSITIVE_INFINITY
  let minY = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let maxY = Number.NEGATIVE_INFINITY
  for (const node of doc.nodes.values()) {
    minX = Math.min(minX, node.x)
    minY = Math.min(minY, node.y)
    maxX = Math.max(maxX, node.x + node.width)
    maxY = Math.max(maxY, node.y + node.height)
  }
  const padding = 32
  return {
    width: Math.max(80, maxX - minX + padding * 2),
    height: Math.max(40, maxY - minY + padding * 2),
  }
}

/**
 * Serializes the exported map to a self-contained SVG document. The
 * output is a single SVG element with the node rects, edge lines,
 * and title labels. No external resources are referenced.
 */
export function exportProcessMapAsSvg(doc: GraphDocument): string {
  const map = exportProcessMap(doc)
  const bounds = computeBounds(doc)
  const xOffset = -doc.nodes.size > 0
    ? Array.from(doc.nodes.values()).reduce((min, n) => Math.min(min, n.x), Number.POSITIVE_INFINITY)
    : 0
  const yOffset = doc.nodes.size > 0
    ? Array.from(doc.nodes.values()).reduce((min, n) => Math.min(min, n.y), Number.POSITIVE_INFINITY)
    : 0

  const nodeEls = map.nodes
    .map((node) => {
      const roleAttr = node.roleTags.length > 0
        ? `<text x="${node.x - xOffset + node.width / 2}" y="${node.y - yOffset + 32}" text-anchor="middle" font-family="sans-serif" font-size="10" fill="#64748b">${escapeXml(node.roleTags.join(', '))}</text>`
        : ''
      const fields = Object.values(node.fields).filter((value) => value.length > 0)
      const fieldEls = fields
        .map((value, index) => `<text x="${node.x - xOffset + 12}" y="${node.y - yOffset + 50 + index * 14}" font-family="sans-serif" font-size="10" fill="#475569">${escapeXml(truncate(value, 60))}</text>`)
        .join('')
      return [
        `<rect x="${node.x - xOffset}" y="${node.y - yOffset}" width="${node.width}" height="${node.height}" rx="10" fill="#ffffff" stroke="${nodeStroke(node.type)}" />`,
        `<text x="${node.x - xOffset + 12}" y="${node.y - yOffset + 18}" font-family="sans-serif" font-size="13" font-weight="600" fill="#0f172a">${escapeXml(truncate(node.title, 40))}</text>`,
        roleAttr,
        fieldEls,
      ].join('')
    })
    .join('')

  const nodeById = new Map(map.nodes.map((node) => [node.id, node]))
  const edgeEls = map.edges
    .map((edge) => {
      const source = nodeById.get(edge.sourceNodeId)
      const target = nodeById.get(edge.targetNodeId)
      if (!source || !target) return ''
      const x1 = source.x - xOffset + source.width
      const y1 = source.y - yOffset + source.height / 2
      const x2 = target.x - xOffset
      const y2 = target.y - yOffset + target.height / 2
      const label = edge.label || edge.fields.expectation || edge.fields.artifact
      const labelEl = label
        ? `<text x="${(x1 + x2) / 2}" y="${(y1 + y2) / 2 - 4}" text-anchor="middle" font-family="sans-serif" font-size="10" fill="#475569">${escapeXml(truncate(label, 40))}</text>`
        : ''
      return [
        `<path d="M ${x1} ${y1} C ${x1 + 60} ${y1}, ${x2 - 60} ${y2}, ${x2} ${y2}" stroke="#94a3b8" stroke-width="1.5" fill="none" />`,
        `<polygon points="${x2 - 8},${y2 - 4} ${x2 - 8},${y2 + 4} ${x2},${y2}" fill="#94a3b8" />`,
        labelEl,
      ].join('')
    })
    .join('')

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" width="${bounds.width}" height="${bounds.height}" viewBox="0 0 ${bounds.width} ${bounds.height}">`,
    `<rect width="${bounds.width}" height="${bounds.height}" fill="#f8fafc" />`,
    edgeEls,
    nodeEls,
    `</svg>`,
  ].join('')
}

function nodeStroke(type: GraphNode['type']): string {
  switch (type) {
    case 'start':
      return '#172033'
    case 'end':
      return '#334155'
    case 'stage':
      return '#94a3b8'
    case 'bottleneck':
      return '#ea580c'
    case 'decision':
      return '#c4c4c6'
    default:
      return '#c4c4c6'
  }
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function truncate(value: string, max: number): string {
  if (value.length <= max) return value
  return value.slice(0, Math.max(0, max - 1)) + '…'
}

/**
 * Browser-only downloader that triggers a Save dialog for the
 * generated blob. Returns the file name. No-op in non-browser
 * environments (tests, SSR).
 */
export function downloadBlob(blob: Blob, filename: string): string | null {
  if (typeof document === 'undefined') return null
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  setTimeout(() => URL.revokeObjectURL(url), 1_000)
  return filename
}
