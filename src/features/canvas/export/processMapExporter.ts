import type { GraphDocument, GraphEdge, GraphNode, PortSide } from '../canvasTypes'
import { normalizeEdgeColor } from '../edgeColors'
import { getActivityResponsibilities, getWorkProductActivityLinks } from '../processAssets'
import { deriveSwimlaneRows, SWIMLANE_LANES, type SwimlaneCard } from '../layout/swimlaneLayout'
import { serializeGraphDocument, type SerializedGraphDocument } from '../engine/graphSerialization'
import { createEmptySharedElementLibrary, type SharedElementLibrary } from '../sharedElements'

export type ProcessMapExportFormat = 'svg' | 'pdf' | 'png' | 'jpg' | 'json'

export type ExportFileSpec = {
  extension: string
  mimeType: string
}

export type FlowentMapBackup = {
  format: 'flowent-map'
  version: 1
  exportedAt: string
  document: SerializedGraphDocument
  sharedElements: SharedElementLibrary
}

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
  color: string
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

export function getExportFileSpec(format: ProcessMapExportFormat): ExportFileSpec {
  switch (format) {
    case 'svg': return { extension: 'svg', mimeType: 'image/svg+xml' }
    case 'pdf': return { extension: 'pdf', mimeType: 'application/pdf' }
    case 'png': return { extension: 'png', mimeType: 'image/png' }
    case 'jpg': return { extension: 'jpg', mimeType: 'image/jpeg' }
    case 'json': return { extension: 'flowent.json', mimeType: 'application/json' }
  }
}

export function createFlowentMapBackup(doc: GraphDocument, elementLibrary?: SharedElementLibrary): FlowentMapBackup {
  return {
    format: 'flowent-map',
    version: 1,
    exportedAt: new Date().toISOString(),
    document: serializeGraphDocument(doc),
    sharedElements: snapshotReferencedSharedElements(doc, elementLibrary),
  }
}

function snapshotReferencedSharedElements(doc: GraphDocument, elementLibrary?: SharedElementLibrary): SharedElementLibrary {
  const library = elementLibrary ?? createEmptySharedElementLibrary()
  const processIds = new Set(Object.values(doc.processInstances).map((instance) => instance.processId))
  const activityIds = new Set(Array.from(doc.nodes.values()).flatMap((node) => node.sharedActivityId ? [node.sharedActivityId] : []))
  const roleIds = new Set(Array.from(doc.nodes.values()).flatMap((node) => getActivityResponsibilities(node)
    .flatMap((responsibility) => responsibility.roleId ? [responsibility.roleId] : [])))
  const workProductIds = new Set(Object.values(doc.processAssets.workProducts)
    .flatMap((asset) => asset.sharedWorkProductId ? [asset.sharedWorkProductId] : []))

  for (const processId of processIds) {
    const process = library.processes[processId]
    if (!process) continue
    for (const placement of process.activities) activityIds.add(placement.activityId)
  }
  for (const activityId of activityIds) {
    const activity = library.activities[activityId]
    if (!activity) continue
    for (const responsibility of activity.responsibilities) roleIds.add(responsibility.roleId)
    for (const link of activity.workProductLinks) workProductIds.add(link.workProductId)
  }

  return {
    roles: pickEntries(library.roles, roleIds),
    workProducts: pickEntries(library.workProducts, workProductIds),
    activities: pickEntries(library.activities, activityIds),
    processes: pickEntries(library.processes, processIds),
  }
}

function pickEntries<T>(entries: Record<string, T>, ids: Set<string>): Record<string, T> {
  return Object.fromEntries(Array.from(ids).flatMap((id) => entries[id] ? [[id, entries[id]]] : []))
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
      color: normalizeEdgeColor(edge.color),
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

type ExportBounds = { minX: number; minY: number; width: number; height: number }

function computeBounds(doc: GraphDocument): ExportBounds {
  if (doc.nodes.size === 0) {
    return { minX: 0, minY: 0, width: 200, height: 80 }
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

  if (doc.meta.layoutProfile === 'swimlane') {
    const rows = deriveSwimlaneRows(doc)
    if (rows.length > 0) {
      minX = Math.min(minX, SWIMLANE_LANES.role.x)
      minY = Math.min(minY, 100)
      maxX = Math.max(maxX, SWIMLANE_LANES.output.x + SWIMLANE_LANES.output.width)
      maxY = Math.max(maxY, ...rows.map((row) => row.y + 188))
    }
  } else {
    for (const node of doc.nodes.values()) {
      if (node.type !== 'activity') continue
      const role = getResponsibleRole(node)
      if (role) minY = Math.min(minY, node.y - 42)
    }
  }

  const padding = 32
  return {
    minX: minX - padding,
    minY: minY - padding,
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
  const bounds = computeBounds(doc)
  const translate = (value: number, axis: 'x' | 'y') => value - (axis === 'x' ? bounds.minX : bounds.minY)
  const swimlaneEls = doc.meta.layoutProfile === 'swimlane' ? exportSwimlanes(doc, translate) : ''
  const edgeEls = Array.from(doc.edges.values()).map((edge) => exportEdge(edge, doc, translate)).join('')
  const nodeEls = Array.from(doc.nodes.values()).map((node) => exportNode(node, doc, translate)).join('')

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" width="${bounds.width}" height="${bounds.height}" viewBox="0 0 ${bounds.width} ${bounds.height}">`,
    `<rect width="${bounds.width}" height="${bounds.height}" fill="#f8fafc" />`,
    swimlaneEls,
    edgeEls,
    nodeEls,
    `</svg>`,
  ].join('')
}

function exportSwimlanes(doc: GraphDocument, translate: (value: number, axis: 'x' | 'y') => number): string {
  const rows = deriveSwimlaneRows(doc)
  if (rows.length === 0) return ''
  const firstX = SWIMLANE_LANES.role.x
  const lastX = SWIMLANE_LANES.output.x + SWIMLANE_LANES.output.width
  const end = doc.nodes.get('end')
  const lastY = Math.max(...rows.map((row) => row.y + 188), end ? end.y + end.height + 18 : 0)
  const x = translate(firstX, 'x')
  const y = translate(100, 'y')
  const width = lastX - firstX
  const height = lastY - 100
  const fills: Record<keyof typeof SWIMLANE_LANES, string> = {
    role: '#e6edf5',
    input: '#e5f0ff',
    activity: '#f5f7fa',
    output: '#e6f5ec',
  }
  const lanes = (Object.entries(SWIMLANE_LANES) as Array<[keyof typeof SWIMLANE_LANES, typeof SWIMLANE_LANES[keyof typeof SWIMLANE_LANES]]>)
    .map(([kind, lane]) => [
      `<rect x="${translate(lane.x, 'x')}" y="${y}" width="${lane.width}" height="${height}" fill="${fills[kind]}" />`,
      `<text x="${translate(lane.x + 16, 'x')}" y="${translate(125, 'y')}" font-family="sans-serif" font-size="12" font-weight="700" fill="#64748b">${lane.title}</text>`,
      lane.x === firstX ? '' : `<path d="M ${translate(lane.x, 'x')} ${y} V ${y + height}" stroke="#cbd5e1" stroke-width="1" />`,
    ].join(''))
    .join('')
  const cards = rows.flatMap((row) => [...row.roleCards, ...row.inputCards, ...row.outputCards])
    .map((card) => exportSwimlaneCard(card, translate)).join('')
  return `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="16" fill="#ffffff" stroke="#cbd5e1" stroke-width="1.2" />${lanes}<path d="M ${x} ${translate(142, 'y')} H ${x + width}" stroke="#cbd5e1" stroke-width="1" />${cards}`
}

function exportSwimlaneCard(card: SwimlaneCard, translate: (value: number, axis: 'x' | 'y') => number): string {
  const isAsset = Boolean(card.workProductId)
  const x = translate(card.x, 'x')
  const y = translate(card.y, 'y')
  const labelX = x + (isAsset ? 12 : 34)
  const icon = isAsset ? '' : `<circle cx="${x + 17}" cy="${y + 16}" r="4" fill="#64748b" /><rect x="${x + 12}" y="${y + 24}" width="10" height="7" rx="3.5" fill="#64748b" />`
  return `<rect x="${x}" y="${y}" width="${card.width}" height="${card.height}" rx="12" fill="#ffffff" stroke="${isAsset ? '#93c5fd' : '#94a3b8'}" stroke-width="1.2" />${icon}<text x="${labelX}" y="${y + 28}" font-family="sans-serif" font-size="11" font-weight="600" fill="#334155">${escapeXml(truncate(card.label, isAsset ? 28 : 20))}</text>`
}

function exportNode(node: GraphNode, doc: GraphDocument, translate: (value: number, axis: 'x' | 'y') => number): string {
  const x = translate(node.x, 'x')
  const y = translate(node.y, 'y')
  const isDecision = node.type === 'decision'
  const shape = isDecision
    ? `<polygon points="${x + node.width / 2},${y} ${x + node.width},${y + node.height / 2} ${x + node.width / 2},${y + node.height} ${x},${y + node.height / 2}" fill="#fff7dd" stroke="${nodeStroke(node.type)}" stroke-width="1.5" />`
    : `<rect x="${x}" y="${y}" width="${node.width}" height="${node.height}" rx="${node.type === 'start' || node.type === 'end' ? node.height / 2 : 10}" fill="${node.type === 'start' ? '#172033' : '#ffffff'}" stroke="${nodeStroke(node.type)}" stroke-width="1.5" />`
  const titleX = isDecision ? x + node.width / 2 : x + 12
  const titleAnchor = isDecision ? ' text-anchor="middle"' : ''
  const titleColor = node.type === 'start' ? '#ffffff' : '#0f172a'
  const titleY = y + (isDecision ? node.height / 2 + 4 : Math.min(24, node.height / 2 + 4))
  const fields = node.type === 'start' || node.type === 'end'
    ? []
    : Object.values(extractNodeFields(node)).filter((value) => value.length > 0)
  const fieldEls = fields.slice(0, 2).map((value, index) => `<text x="${x + 12}" y="${y + 44 + index * 14}" font-family="sans-serif" font-size="10" fill="#475569">${escapeXml(truncate(value, 56))}</text>`).join('')
  const details = doc.meta.layoutProfile === 'swimlane' ? '' : exportFlowNodeDetails(node, doc, translate)
  return `${shape}<text x="${titleX}" y="${titleY}"${titleAnchor} font-family="sans-serif" font-size="13" font-weight="600" fill="${titleColor}">${escapeXml(truncate(node.title, isDecision ? 26 : 40))}</text>${fieldEls}${details}`
}

function exportFlowNodeDetails(node: GraphNode, doc: GraphDocument, translate: (value: number, axis: 'x' | 'y') => number): string {
  if (node.type !== 'activity') return ''
  const role = getResponsibleRole(node)
  const x = translate(node.x, 'x')
  const y = translate(node.y, 'y')
  const roleBadge = role
    ? `<rect x="${x + 8}" y="${y - 34}" width="${Math.min(164, Math.max(76, role.length * 6.5 + 30))}" height="24" rx="12" fill="#e6edf5" stroke="#cbd5e1" /><circle cx="${x + 22}" cy="${y - 22}" r="3" fill="#64748b" /><rect x="${x + 18.5}" y="${y - 18}" width="7" height="5" rx="2.5" fill="#64748b" /><text x="${x + 32}" y="${y - 18}" font-family="sans-serif" font-size="10" font-weight="600" fill="#334155">${escapeXml(truncate(role, 20))}</text>`
    : ''
  const inputs = getWorkProductsForNode(doc, node.id, 'input')
  const outputs = getWorkProductsForNode(doc, node.id, 'output')
  const chipY = y + node.height - 20
  const input = inputs.length > 0
    ? `<rect x="${x + 8}" y="${chipY}" width="${Math.min(node.width / 2 - 12, 82)}" height="14" rx="7" fill="#e5f0ff" /><text x="${x + 14}" y="${chipY + 10}" font-family="sans-serif" font-size="8" font-weight="700" fill="#2563eb">IN ${inputs.length}</text>`
    : ''
  const output = outputs.length > 0
    ? `<rect x="${x + node.width - Math.min(node.width / 2 - 12, 82) - 8}" y="${chipY}" width="${Math.min(node.width / 2 - 12, 82)}" height="14" rx="7" fill="#e6f5ec" /><text x="${x + node.width - Math.min(node.width / 2 - 12, 82) - 2}" y="${chipY + 10}" text-anchor="end" font-family="sans-serif" font-size="8" font-weight="700" fill="#15803d">OUT ${outputs.length}</text>`
    : ''
  return `${roleBadge}${input}${output}`
}

function exportEdge(edge: GraphEdge, doc: GraphDocument, translate: (value: number, axis: 'x' | 'y') => number): string {
  const source = doc.nodes.get(edge.sourceNodeId)
  const target = doc.nodes.get(edge.targetNodeId)
  if (!source || !target) return ''
  const sourceSide = edge.sourceAnchor?.side ?? inferEdgeSide(source, target, true)
  const targetSide = edge.targetAnchor?.side ?? inferEdgeSide(source, target, false)
  const start = edgePoint(source, sourceSide, edge.sourceAnchor?.offset)
  const end = edgePoint(target, targetSide, edge.targetAnchor?.offset)
  const startDirection = directionForSide(sourceSide)
  const endDirection = directionForSide(targetSide)
  const control = 54
  const x1 = translate(start.x, 'x')
  const y1 = translate(start.y, 'y')
  const x2 = translate(end.x, 'x')
  const y2 = translate(end.y, 'y')
  const cp1 = { x: x1 + startDirection.x * control, y: y1 + startDirection.y * control }
  const cp2 = { x: x2 + endDirection.x * control, y: y2 + endDirection.y * control }
  const stroke = normalizeEdgeColor(edge.color)
  const arrow = arrowPolygon(cp2, { x: x2, y: y2 })
  const label = edge.label || edge.expectation || edge.artifact
  const labelEl = label ? `<text x="${(x1 + x2) / 2}" y="${(y1 + y2) / 2 - 6}" text-anchor="middle" font-family="sans-serif" font-size="10" fill="#475569">${escapeXml(truncate(label, 40))}</text>` : ''
  return `<path d="M ${x1} ${y1} C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${x2} ${y2}" stroke="${stroke}" stroke-width="1.5" fill="none" />${arrow ? `<polygon points="${arrow}" fill="${stroke}" />` : ''}${labelEl}`
}

function getResponsibleRole(node: GraphNode): string | null {
  return getActivityResponsibilities(node).find((item) => item.kind === 'responsible')?.roleName ?? node.roleTags[0] ?? null
}

function getWorkProductsForNode(doc: GraphDocument, nodeId: string, relation: 'input' | 'output') {
  return Object.values(doc.processAssets.workProducts).filter((asset) => getWorkProductActivityLinks(asset)
    .some((link) => link.nodeId === nodeId && link.relation === relation))
}

function inferEdgeSide(source: GraphNode, target: GraphNode, isSource: boolean): PortSide {
  const dx = target.x + target.width / 2 - (source.x + source.width / 2)
  const dy = target.y + target.height / 2 - (source.y + source.height / 2)
  if (Math.abs(dx) >= Math.abs(dy)) return isSource ? (dx >= 0 ? 'right' : 'left') : (dx >= 0 ? 'left' : 'right')
  return isSource ? (dy >= 0 ? 'bottom' : 'top') : (dy >= 0 ? 'top' : 'bottom')
}

function edgePoint(node: GraphNode, side: PortSide, offset = 0.5): { x: number; y: number } {
  const safeOffset = Math.min(1, Math.max(0, offset))
  if (side === 'top') return { x: node.x + node.width * safeOffset, y: node.y }
  if (side === 'bottom') return { x: node.x + node.width * safeOffset, y: node.y + node.height }
  if (side === 'left') return { x: node.x, y: node.y + node.height * safeOffset }
  return { x: node.x + node.width, y: node.y + node.height * safeOffset }
}

function directionForSide(side: PortSide): { x: number; y: number } {
  if (side === 'top') return { x: 0, y: -1 }
  if (side === 'bottom') return { x: 0, y: 1 }
  if (side === 'left') return { x: -1, y: 0 }
  return { x: 1, y: 0 }
}

function arrowPolygon(from: { x: number; y: number }, to: { x: number; y: number }): string | null {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const length = Math.hypot(dx, dy)
  if (length < 0.001) return null
  const unit = { x: dx / length, y: dy / length }
  const base = { x: to.x - unit.x * 9, y: to.y - unit.y * 9 }
  const normal = { x: -unit.y * 4.5, y: unit.x * 4.5 }
  return `${to.x},${to.y} ${base.x + normal.x},${base.y + normal.y} ${base.x - normal.x},${base.y - normal.y}`
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
