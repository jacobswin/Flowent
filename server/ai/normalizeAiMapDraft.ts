import type { GraphDocument, GraphEdge, GuidanceAsset, MilestoneAsset, ProcessAssets, WorkProductAsset } from '../../src/features/canvas/canvasTypes'
import { createEmptyDocument } from '../../src/features/canvas/engine/graphDocument'
import { serializeGraphDocument, type SerializedGraphDocument } from '../../src/features/canvas/engine/graphSerialization'
import { layoutFlowGraph } from '../../src/features/canvas/layout/flowLayout'
import { createGraphNode, createHandoffEdge } from '../../src/features/canvas/processElements'
import {
  collectResponsibilityRoleTags,
  linkGuidanceToActivity,
  linkGuidanceToHandoff,
  linkGuidanceToWorkProduct,
  linkWorkProductToActivity,
  linkWorkProductToHandoff,
  normalizeActivityResponsibilities,
} from '../../src/features/canvas/processAssets'
import { aiMapDraftSchema, type AiMapDraft } from './aiDraftSchemas'
import type { ZodIssue } from 'zod'

export type AiGeneratedFinding = {
  kind: 'assumption' | 'risk' | 'missing-information'
  message: string
}

export type NormalizeAiMapDraftResult =
  | { success: true; title: string; summary: string; document: SerializedGraphDocument; findings: AiGeneratedFinding[] }
  | { success: false; error: string }

export async function normalizeAiMapDraft(rawDraft: unknown): Promise<NormalizeAiMapDraftResult> {
  const parsed = aiMapDraftSchema.safeParse(repairAiMapDraftShape(rawDraft))
  if (!parsed.success) {
    return { success: false, error: `Generated draft did not match Flowent map schema: ${formatSchemaIssues(parsed.error.issues)}.` }
  }

  const draft = parsed.data
  const activityMainlineMode = draft.generationMode === 'activity-mainline'
  const documentId = `ai-${slug(draft.title) || 'generated-map'}`
  let doc = createEmptyDocument(documentId)

  doc = {
    ...doc,
    nodes: new Map([
      ['start', createGraphNode('start', 'start', { x: 0, y: 0 })],
      ['end', createGraphNode('end', 'end', { x: 0, y: 0 })],
    ]),
    processAssets: createProcessAssets(draft),
    meta: {
      dirty: true,
      version: 1,
      ...(draft.processAnalysis ? { processAnalysis: draft.processAnalysis } : {}),
    },
  }

  for (const nodeDraft of draft.nodes) {
    const id = safeId(nodeDraft.id)
    if (id === 'start' || id === 'end' || doc.nodes.has(id)) {
      return { success: false, error: `Generated node id ${nodeDraft.id} is duplicated or reserved.` }
    }
    const nodeType = activityMainlineMode ? nodeDraft.type : repairDecisionLikeActivityType(nodeDraft)
    const node = createGraphNode(nodeType, id, { x: 0, y: 0 })
    const responsibilities = normalizeActivityResponsibilities(nodeDraft.responsibilities.map((responsibility) => ({
      id: `responsibility-${id}-${slug(responsibility.roleName)}-${responsibility.kind}`,
      roleName: responsibility.roleName,
      kind: responsibility.kind,
    })), { nodeId: id })
    doc.nodes.set(id, {
      ...node,
      title: nodeDraft.title,
      summary: nodeDraft.summary ?? node.summary,
      expectations: nodeDraft.expectations ?? node.expectations,
      criteria: nodeDraft.criteria ?? node.criteria,
      decisionOutcomes: nodeDraft.decisionOutcomes,
      owner: nodeDraft.owner ?? node.owner,
      goal: nodeDraft.goal ?? node.goal,
      entryCondition: nodeDraft.entryCondition ?? node.entryCondition,
      exitCondition: nodeDraft.exitCondition ?? node.exitCondition,
      symptom: nodeDraft.symptom ?? node.symptom,
      impact: nodeDraft.impact ?? node.impact,
      suspectedCause: nodeDraft.suspectedCause ?? node.suspectedCause,
      ...(nodeDraft.processStage ? { processStage: nodeDraft.processStage } : {}),
      responsibilities,
      roleTags: collectResponsibilityRoleTags(responsibilities),
    })
  }

  let generatedNodeIds = draft.nodes.map((node) => safeId(node.id))
  doc = {
    ...doc,
    meta: {
      ...doc.meta,
      layoutProfile: 'left-to-right',
      layoutNodeOrder: generatedNodeIds,
    },
  }
  const nodeIds = new Set([...doc.nodes.keys()])
  for (const edgeDraft of draft.edges) {
    if (!nodeIds.has(edgeDraft.sourceNodeId) || !nodeIds.has(edgeDraft.targetNodeId)) {
      return { success: false, error: `Generated edge ${edgeDraft.id} references an unknown node.` }
    }
    const edge = createHandoffEdge(
      safeId(edgeDraft.id),
      edgeDraft.sourceNodeId,
      'out',
      edgeDraft.targetNodeId,
      'in',
    )
    doc.edges.set(edge.id, {
      ...edge,
      label: edgeDraft.label,
      fromRole: edgeDraft.fromRole ?? '',
      toRole: edgeDraft.toRole ?? '',
      artifact: edgeDraft.artifact ?? '',
      expectation: edgeDraft.expectation ?? '',
      readinessSignal: edgeDraft.readinessSignal ?? '',
      workProductIds: edgeDraft.workProductIds,
    })
  }

  repairGeneratedMainline(doc, generatedNodeIds)
  generatedNodeIds = repairActivityLoopBacksWithDecisionGates(doc, generatedNodeIds)
  doc = {
    ...doc,
    meta: {
      ...doc.meta,
      layoutNodeOrder: generatedNodeIds,
    },
  }
  if (generatedNodeIds.length > 0) {
    const hasStartEdge = Array.from(doc.edges.values()).some((edge) => edge.sourceNodeId === 'start')
    const hasEndEdge = Array.from(doc.edges.values()).some((edge) => edge.targetNodeId === 'end')
    if (!hasStartEdge) addGeneratedEdge(doc, 'start', generatedNodeIds[0], 'handoff-start')
    if (!hasEndEdge) addGeneratedEdge(doc, generatedNodeIds[generatedNodeIds.length - 1], 'end', 'handoff-end')
  }

  doc = repairDecisionBranchLabels(doc)
  doc = linkAssetsFromDraft(doc, draft)
  doc = await layoutFlowGraph(doc)

  return {
    success: true,
    title: draft.title,
    summary: draft.summary,
    document: serializeGraphDocument(doc),
    findings: [
      ...draft.assumptions.map((message) => ({ kind: 'assumption' as const, message })),
      ...draft.risks.map((message) => ({ kind: 'risk' as const, message })),
      ...draft.missingInformation.map((message) => ({ kind: 'missing-information' as const, message })),
    ],
  }
}

function repairDecisionLikeActivityType(nodeDraft: AiMapDraft['nodes'][number]): AiMapDraft['nodes'][number]['type'] {
  if (nodeDraft.type !== 'activity') return nodeDraft.type
  const title = nodeDraft.title.trim()
  const criteria = nodeDraft.criteria?.trim() ?? ''
  if (nodeDraft.decisionOutcomes.length >= 2) return 'decision'
  if (/(是否|判断|评估|批准|审批|决策|选择|到期.*解决|风险评估|risk|approve|approval|whether|if|resolved\?)/i.test(`${title} ${criteria}`)) {
    return 'decision'
  }
  return nodeDraft.type
}

function repairDecisionBranchLabels(doc: GraphDocument): GraphDocument {
  const edges = new Map(doc.edges)
  for (const node of doc.nodes.values()) {
    if (node.type !== 'decision') continue
    const outgoing = Array.from(edges.values()).filter((edge) => edge.sourceNodeId === node.id)
    if (outgoing.length === 0) continue

    outgoing.forEach((edge, index) => {
      if (edge.label.trim()) return
      const label = node.decisionOutcomes?.[index]?.trim() || inferDecisionBranchLabel(node.title, index, outgoing.length)
      if (label) edges.set(edge.id, { ...edge, label })
    })
  }
  return { ...doc, edges }
}

function inferDecisionBranchLabel(title: string, index: number, outgoingCount: number): string {
  if (outgoingCount <= 1) return ''
  if (/(是否|解决|批准|审批|whether|if|approve|resolved)/i.test(title)) {
    return index === 0 ? '是' : '否'
  }
  if (/(风险|risk)/i.test(title)) {
    return index === 0 ? '低风险' : '高风险'
  }
  return index === 0 ? 'Yes' : 'No'
}

function repairActivityLoopBacksWithDecisionGates(doc: GraphDocument, generatedNodeIds: string[]): string[] {
  const order = new Map(generatedNodeIds.map((id, index) => [id, index]))
  const loopEdgesBySource = new Map<string, GraphEdge[]>()

  for (const edge of doc.edges.values()) {
    const sourceIndex = order.get(edge.sourceNodeId)
    const targetIndex = order.get(edge.targetNodeId)
    if (sourceIndex == null || targetIndex == null) continue
    if (targetIndex >= sourceIndex) continue
    if (!hasDirectedPath(doc, edge.targetNodeId, edge.sourceNodeId)) continue

    const source = doc.nodes.get(edge.sourceNodeId)
    if (!source || source.type === 'decision') {
      if (!edge.label.trim()) {
        doc.edges.set(edge.id, { ...edge, label: '需要返回' })
      }
      continue
    }

    const sourceLoopEdges = loopEdgesBySource.get(edge.sourceNodeId) ?? []
    sourceLoopEdges.push(edge)
    loopEdgesBySource.set(edge.sourceNodeId, sourceLoopEdges)
  }

  if (loopEdgesBySource.size === 0) return generatedNodeIds

  const nextOrder = [...generatedNodeIds]
  for (const [sourceNodeId, loopEdges] of loopEdgesBySource) {
    const source = doc.nodes.get(sourceNodeId)
    if (!source) continue

    const sourceIndex = nextOrder.indexOf(sourceNodeId)
    const decisionId = uniqueNodeId(doc, `loop-decision-${sourceNodeId}`)
    const firstLoopTarget = doc.nodes.get(loopEdges[0].targetNodeId)
    const decisionTitle = firstLoopTarget
      ? `是否需要返回${firstLoopTarget.title}?`
      : '是否需要返回前序步骤?'
    const decision = createGraphNode('decision', decisionId, { x: source.x, y: source.y })
    doc.nodes.set(decisionId, {
      ...decision,
      title: decisionTitle,
      criteria: '根据复评、整改或未解决问题判断是否需要返回前序步骤。',
      decisionOutcomes: unique([
        ...loopEdges.map((edge) => edge.label.trim()).filter(Boolean),
        '需要返回',
        '继续',
      ]),
    })
    if (sourceIndex >= 0) nextOrder.splice(sourceIndex + 1, 0, decisionId)
    else nextOrder.push(decisionId)

    const loopEdgeIds = new Set(loopEdges.map((edge) => edge.id))
    const outgoing = Array.from(doc.edges.values()).filter((edge) => edge.sourceNodeId === sourceNodeId)
    let hasForwardContinuation = false
    for (const edge of outgoing) {
      if (loopEdgeIds.has(edge.id)) {
        doc.edges.set(edge.id, {
          ...edge,
          sourceNodeId: decisionId,
          sourcePortId: 'out',
          label: edge.label.trim() || '需要返回',
        })
        continue
      }

      doc.edges.set(edge.id, {
        ...edge,
        sourceNodeId: decisionId,
        sourcePortId: 'out',
        label: edge.label.trim() || '继续',
      })
      hasForwardContinuation = true
    }

    if (!hasForwardContinuation) {
      const nextNodeId = nextOrder[nextOrder.indexOf(decisionId) + 1]
      if (nextNodeId && nextNodeId !== decisionId) {
        addGeneratedEdge(doc, decisionId, nextNodeId, uniqueEdgeId(doc, `handoff-continue-${sourceNodeId}`), '继续')
      }
    }

    addGeneratedEdge(doc, sourceNodeId, decisionId, uniqueEdgeId(doc, `handoff-loop-gate-${sourceNodeId}`))
  }

  return nextOrder
}

type DraftRecord = Record<string, unknown>

function repairAiMapDraftShape(rawDraft: unknown): unknown {
  if (!isRecord(rawDraft)) return rawDraft

  const document = isRecord(rawDraft.document) ? rawDraft.document : null
  const source: DraftRecord = document
    ? {
        ...rawDraft,
        nodes: rawDraft.nodes ?? document.nodes,
        edges: rawDraft.edges ?? document.edges,
        processAssets: rawDraft.processAssets ?? document.processAssets,
      }
    : rawDraft
  const processAssets = isRecord(source.processAssets) ? source.processAssets : null
  const nodeIdByRef = new Map<string, string>([
    ['start', 'start'],
    ['end', 'end'],
  ])
  const workProductIdByRef = new Map<string, string>()

  const workProducts = normalizeWorkProductDrafts(
    source.workProducts ?? processAssets?.workProducts,
    workProductIdByRef,
  )
  const nodes = normalizeNodeDrafts(collectNodeDrafts(source), nodeIdByRef, workProductIdByRef)
  ensureWorkProductsFromNodeRefs(workProducts, nodes, workProductIdByRef)

  const edgeIdByRef = new Map<string, string>()
  const edges = normalizeEdgeDrafts(source.edges ?? source.handoffs ?? source.connections, nodeIdByRef, edgeIdByRef)
  applyProcessAssetLinks(nodes, edges, processAssets, nodeIdByRef, edgeIdByRef, workProductIdByRef)

  const guidanceItems = normalizeGuidanceDrafts(
    source.guidanceItems ?? source.guidance ?? source.guides ?? processAssets?.guidanceItems,
    nodeIdByRef,
    workProductIdByRef,
  )
  const milestones = normalizeMilestoneDrafts(
    source.milestones ?? processAssets?.milestones,
    nodeIdByRef,
    workProductIdByRef,
  )

  return {
    ...source,
    title: firstString(source.title, document?.title, document?.name) ?? 'AI generated process map',
    summary: firstString(source.summary, source.description, document?.summary, document?.description) ?? '',
    nodes,
    edges,
    workProducts,
    guidanceItems,
    milestones,
    assumptions: normalizeStringArray(source.assumptions),
    risks: normalizeStringArray(source.risks),
    missingInformation: normalizeStringArray(source.missingInformation ?? source.missing_information ?? source.gaps),
  }
}

function collectNodeDrafts(source: DraftRecord): unknown {
  if (source.nodes != null) return source.nodes

  const typedCollections: Array<[string, string]> = [
    ['stages', 'stage'],
    ['activities', 'activity'],
    ['decisions', 'decision'],
    ['bottlenecks', 'bottleneck'],
  ]
  const nodes: unknown[] = []
  for (const [key, type] of typedCollections) {
    for (const entry of collectionEntries(source[key])) {
      if (isRecord(entry.value)) {
        nodes.push({ type, ...entry.value })
      } else if (typeof entry.value === 'string') {
        nodes.push({ type, title: entry.value })
      }
    }
  }
  return nodes
}

function normalizeNodeDrafts(
  value: unknown,
  nodeIdByRef: Map<string, string>,
  workProductIdByRef: Map<string, string>,
): DraftRecord[] {
  const nodes: DraftRecord[] = []
  const usedIds = new Set<string>(['start', 'end'])
  let index = 1

  for (const entry of collectionEntries(value)) {
    const item = isRecord(entry.value) ? entry.value : { title: entry.value }
    const rawType = normalizeNodeType(item.type)
    if (rawType === 'start' || rawType === 'end') {
      const fixedId = rawType
      addRef(nodeIdByRef, fixedId, fixedId)
      addRef(nodeIdByRef, firstString(item.title, entry.key), fixedId)
      continue
    }

    const type = rawType ?? 'activity'
    const title = firstString(item.title, item.label, item.name) ?? `${capitalize(type)} ${index}`
    const id = uniqueDraftId(firstString(item.id, item.nodeId, entry.key), title, `node-${index}`, usedIds)
    addRef(nodeIdByRef, id, id)
    addRef(nodeIdByRef, title, id)

    nodes.push({
      ...item,
      id,
      type,
      title,
      summary: firstString(item.summary, item.description),
      expectations: firstString(item.expectations, item.expectation),
      criteria: firstString(item.criteria, item.decisionCriteria),
      decisionOutcomes: normalizeStringArray(item.decisionOutcomes ?? item.outcomes ?? item.branches),
      owner: firstString(item.owner, item.accountable, item.responsibleOwner),
      goal: firstString(item.goal, item.objective),
      entryCondition: firstString(item.entryCondition, item.entry, item.entryCriteria),
      exitCondition: firstString(item.exitCondition, item.exit, item.exitCriteria),
      symptom: firstString(item.symptom),
      impact: firstString(item.impact),
      suspectedCause: firstString(item.suspectedCause, item.cause),
      responsibilities: normalizeResponsibilities(item.responsibilities ?? item.rasic ?? item.rasicRoles ?? item.roles, item.roleTags),
      inputs: normalizeWorkProductRefs(item.inputs ?? item.inputWorkProducts ?? item.consumes, workProductIdByRef),
      outputs: normalizeWorkProductRefs(item.outputs ?? item.outputWorkProducts ?? item.produces, workProductIdByRef),
      guidanceIds: normalizeRefArray(item.guidanceIds ?? item.guidance ?? item.guidanceItems),
    })
    index += 1
  }

  return nodes
}

function normalizeEdgeDrafts(
  value: unknown,
  nodeIdByRef: Map<string, string>,
  edgeIdByRef: Map<string, string>,
): DraftRecord[] {
  const edges: DraftRecord[] = []
  const usedIds = new Set<string>()
  let index = 1

  for (const entry of collectionEntries(value)) {
    const item = isRecord(entry.value) ? entry.value : {}
    const sourceNodeId = resolveRef(firstString(item.sourceNodeId, item.source, item.sourceId, item.from, item.fromNodeId), nodeIdByRef)
    const targetNodeId = resolveRef(firstString(item.targetNodeId, item.target, item.targetId, item.to, item.toNodeId), nodeIdByRef)
    const id = uniqueDraftId(
      firstString(item.id, item.edgeId, entry.key),
      sourceNodeId && targetNodeId ? `handoff-${sourceNodeId}-${targetNodeId}-${index}` : `handoff-${index}`,
      `handoff-${index}`,
      usedIds,
    )
    addRef(edgeIdByRef, id, id)
    addRef(edgeIdByRef, firstString(item.label, item.title, item.name), id)

    edges.push({
      ...item,
      id,
      sourceNodeId,
      targetNodeId,
      label: firstString(item.label, item.title, item.name) ?? '',
      fromRole: firstString(item.fromRole, item.from),
      toRole: firstString(item.toRole, item.to),
      artifact: firstString(item.artifact, item.workProduct, item.deliverable),
      expectation: firstString(item.expectation, item.expectedOutcome),
      readinessSignal: firstString(item.readinessSignal, item.readiness, item.signal),
      workProductIds: normalizeRefArray(item.workProductIds ?? item.workProducts ?? item.artifacts),
    })
    index += 1
  }

  return edges
}

function normalizeWorkProductDrafts(value: unknown, workProductIdByRef: Map<string, string>): DraftRecord[] {
  const assets: DraftRecord[] = []
  const usedIds = new Set<string>()
  let index = 1

  for (const entry of collectionEntries(value)) {
    const item = isRecord(entry.value) ? entry.value : { title: entry.value }
    const title = firstString(item.title, item.name, item.label, entry.key) ?? `Work product ${index}`
    const id = uniqueDraftId(firstString(item.id, item.workProductId, entry.key), title, `work-product-${index}`, usedIds)
    addRef(workProductIdByRef, id, id)
    addRef(workProductIdByRef, title, id)

    assets.push({
      ...item,
      id,
      title,
      state: firstString(item.state, item.defaultMaturity, item.maturity, item.status) ?? 'Draft',
      description: firstString(item.description, item.summary) ?? '',
    })
    index += 1
  }

  return assets
}

function normalizeGuidanceDrafts(
  value: unknown,
  nodeIdByRef: Map<string, string>,
  workProductIdByRef: Map<string, string>,
): DraftRecord[] {
  const assets: DraftRecord[] = []
  const usedIds = new Set<string>()
  let index = 1

  for (const entry of collectionEntries(value)) {
    const item = isRecord(entry.value) ? entry.value : { title: entry.value }
    const title = firstString(item.title, item.name, item.label, entry.key) ?? `Guidance ${index}`
    const id = uniqueDraftId(firstString(item.id, item.guidanceId, entry.key), title, `guidance-${index}`, usedIds)
    assets.push({
      ...item,
      id,
      title,
      kind: normalizeGuidanceKind(item.kind ?? item.type) ?? 'checklist',
      description: firstString(item.description, item.summary) ?? '',
      url: firstString(item.url, item.href, item.link) ?? '',
      appliesToNodeIds: normalizeRefArray(item.appliesToNodeIds ?? item.nodeIds ?? item.activities).map((ref) => resolveRef(ref, nodeIdByRef)),
      appliesToEdgeIds: normalizeRefArray(item.appliesToEdgeIds ?? item.edgeIds ?? item.handoffs),
      workProductIds: normalizeRefArray(item.workProductIds ?? item.workProducts).map((ref) => resolveRef(ref, workProductIdByRef)),
    })
    index += 1
  }

  return assets
}

function normalizeMilestoneDrafts(
  value: unknown,
  nodeIdByRef: Map<string, string>,
  workProductIdByRef: Map<string, string>,
): DraftRecord[] {
  const assets: DraftRecord[] = []
  const usedIds = new Set<string>()
  let index = 1

  for (const entry of collectionEntries(value)) {
    const item = isRecord(entry.value) ? entry.value : { title: entry.value }
    const title = firstString(item.title, item.name, item.label, entry.key) ?? `Milestone ${index}`
    const id = uniqueDraftId(firstString(item.id, item.milestoneId, entry.key), title, `milestone-${index}`, usedIds)
    assets.push({
      ...item,
      id,
      title,
      description: firstString(item.description, item.summary) ?? '',
      stageNodeId: nullableRef(item.stageNodeId ?? item.stage ?? item.stageId, nodeIdByRef),
      workProductStates: normalizeWorkProductStates(item.workProductStates ?? item.workProducts, workProductIdByRef),
    })
    index += 1
  }

  return assets
}

function normalizeWorkProductRefs(value: unknown, workProductIdByRef: Map<string, string>): Array<{ workProductId: string; maturity: string }> {
  return collectionEntries(value)
    .map((entry) => {
      const item = isRecord(entry.value) ? entry.value : { title: entry.value }
      const ref = firstString(item.workProductId, item.id, item.title, item.name, item.label, entry.key)
      if (!ref) return null
      return {
        workProductId: resolveRef(ref, workProductIdByRef),
        maturity: firstString(item.maturity, item.state, item.defaultMaturity, item.status) ?? 'Draft',
      }
    })
    .filter((item): item is { workProductId: string; maturity: string } => Boolean(item))
}

function normalizeWorkProductStates(value: unknown, workProductIdByRef: Map<string, string>): Array<{ workProductId: string; state: string }> {
  return collectionEntries(value)
    .map((entry) => {
      const item = isRecord(entry.value) ? entry.value : { title: entry.value }
      const ref = firstString(item.workProductId, item.id, item.title, item.name, item.label, entry.key)
      if (!ref) return null
      return {
        workProductId: resolveRef(ref, workProductIdByRef),
        state: firstString(item.state, item.maturity, item.defaultMaturity, item.status) ?? 'Draft',
      }
    })
    .filter((item): item is { workProductId: string; state: string } => Boolean(item))
}

function normalizeResponsibilities(value: unknown, roleTags: unknown): Array<{ roleName: string; kind: string }> {
  const responsibilities: Array<{ roleName: string; kind: string }> = []

  for (const entry of collectionEntries(value)) {
    if (typeof entry.value === 'string') {
      responsibilities.push({ roleName: entry.value.trim(), kind: 'responsible' })
      continue
    }
    if (!isRecord(entry.value)) continue

    const roleName = firstString(entry.value.roleName, entry.value.role, entry.value.name, entry.value.title)
    const kind = normalizeResponsibilityKind(entry.value.kind ?? entry.value.responsibility ?? entry.value.type) ?? 'responsible'
    if (roleName) responsibilities.push({ roleName, kind })

    for (const [key, nestedValue] of Object.entries(entry.value)) {
      const nestedKind = normalizeResponsibilityKind(key)
      if (!nestedKind) continue
      for (const nestedRole of normalizeStringArray(nestedValue)) {
        responsibilities.push({ roleName: nestedRole, kind: nestedKind })
      }
    }
  }

  if (responsibilities.length === 0) {
    for (const roleName of normalizeStringArray(roleTags)) {
      responsibilities.push({ roleName, kind: 'responsible' })
    }
  }

  const seen = new Set<string>()
  return responsibilities.filter((responsibility) => {
    const roleName = responsibility.roleName.trim()
    const key = `${roleName.toLowerCase()}-${responsibility.kind}`
    if (!roleName || seen.has(key)) return false
    seen.add(key)
    responsibility.roleName = roleName
    return true
  })
}

function applyProcessAssetLinks(
  nodes: DraftRecord[],
  edges: DraftRecord[],
  processAssets: DraftRecord | null,
  nodeIdByRef: Map<string, string>,
  edgeIdByRef: Map<string, string>,
  workProductIdByRef: Map<string, string>,
): void {
  if (!processAssets || !isRecord(processAssets.workProducts)) return

  const nodesById = new Map(nodes.map((node) => [String(node.id), node]))
  const edgesById = new Map(edges.map((edge) => [String(edge.id), edge]))
  for (const entry of collectionEntries(processAssets.workProducts)) {
    const item = isRecord(entry.value) ? entry.value : { title: entry.value }
    const workProductRef = firstString(item.id, item.workProductId, item.title, item.name, entry.key)
    if (!workProductRef) continue
    const workProductId = resolveRef(workProductRef, workProductIdByRef)
    const defaultMaturity = firstString(item.state, item.defaultMaturity, item.maturity) ?? 'Draft'

    for (const linkEntry of collectionEntries(item.activityLinks)) {
      if (!isRecord(linkEntry.value)) continue
      const nodeId = resolveRef(firstString(linkEntry.value.nodeId, linkEntry.value.activityId, linkEntry.value.activity, linkEntry.value.node), nodeIdByRef)
      const relation = normalizeWorkProductRelation(linkEntry.value.relation)
      if (!nodeId || !relation) continue
      addWorkProductRefToNode(nodesById.get(nodeId), relation, {
        workProductId,
        maturity: firstString(linkEntry.value.maturity, linkEntry.value.state) ?? defaultMaturity,
      })
    }

    for (const nodeRef of normalizeRefArray(item.producerNodeIds ?? item.producers)) {
      addWorkProductRefToNode(nodesById.get(resolveRef(nodeRef, nodeIdByRef)), 'output', { workProductId, maturity: defaultMaturity })
    }
    for (const nodeRef of normalizeRefArray(item.consumerNodeIds ?? item.consumers)) {
      addWorkProductRefToNode(nodesById.get(resolveRef(nodeRef, nodeIdByRef)), 'input', { workProductId, maturity: defaultMaturity })
    }
    for (const edgeRef of normalizeRefArray(item.handoffEdgeIds ?? item.handoffs ?? item.edges)) {
      const edge = edgesById.get(resolveRef(edgeRef, edgeIdByRef))
      if (!edge) continue
      edge.workProductIds = unique([...normalizeRefArray(edge.workProductIds), workProductId])
    }
  }
}

function addWorkProductRefToNode(
  node: DraftRecord | undefined,
  relation: 'input' | 'output',
  ref: { workProductId: string; maturity: string },
): void {
  if (!node) return
  const key = relation === 'input' ? 'inputs' : 'outputs'
  const refs = normalizeWorkProductRefs(node[key], new Map())
  if (!refs.some((item) => item.workProductId === ref.workProductId && item.maturity === ref.maturity)) {
    refs.push(ref)
  }
  node[key] = refs
}

function ensureWorkProductsFromNodeRefs(
  workProducts: DraftRecord[],
  nodes: DraftRecord[],
  workProductIdByRef: Map<string, string>,
): void {
  const existingIds = new Set(workProducts.map((asset) => String(asset.id)))
  for (const node of nodes) {
    for (const ref of [...normalizeWorkProductRefs(node.inputs, workProductIdByRef), ...normalizeWorkProductRefs(node.outputs, workProductIdByRef)]) {
      if (existingIds.has(ref.workProductId)) continue
      existingIds.add(ref.workProductId)
      const title = titleFromId(ref.workProductId)
      workProducts.push({ id: ref.workProductId, title, state: ref.maturity, description: '' })
      addRef(workProductIdByRef, ref.workProductId, ref.workProductId)
      addRef(workProductIdByRef, title, ref.workProductId)
    }
  }
}

function collectionEntries(value: unknown): Array<{ key?: string; value: unknown }> {
  if (value == null) return []
  if (Array.isArray(value)) return value.map((entry) => ({ value: entry }))
  if (isRecord(value)) return Object.entries(value).map(([key, entry]) => ({ key, value: entry }))
  return [{ value }]
}

function normalizeStringArray(value: unknown): string[] {
  return collectionEntries(value)
    .map((entry) => {
      if (typeof entry.value === 'string') return entry.value.trim()
      if (isRecord(entry.value)) return firstString(entry.value.message, entry.value.title, entry.value.name, entry.value.label)
      return null
    })
    .filter((item): item is string => Boolean(item))
}

function normalizeRefArray(value: unknown): string[] {
  return collectionEntries(value)
    .map((entry) => {
      if (typeof entry.value === 'string') return entry.value.trim()
      if (isRecord(entry.value)) return firstString(entry.value.id, entry.value.nodeId, entry.value.edgeId, entry.value.workProductId, entry.value.title, entry.value.name, entry.key)
      return null
    })
    .filter((item): item is string => Boolean(item))
}

function nullableRef(value: unknown, refs: Map<string, string>): string | null {
  const ref = firstString(value)
  return ref ? resolveRef(ref, refs) : null
}

function resolveRef(value: string | undefined, refs: Map<string, string>): string {
  if (!value) return ''
  return refs.get(normalizeLookup(value)) ?? slug(value) ?? value.trim()
}

function addRef(refs: Map<string, string>, value: string | undefined, id: string): void {
  if (!value) return
  refs.set(normalizeLookup(value), id)
}

function uniqueDraftId(rawId: string | undefined, title: string, fallback: string, usedIds: Set<string>): string {
  const base = slug(rawId ?? title) || slug(fallback) || fallback
  let candidate = base
  let suffix = 2
  while (usedIds.has(candidate)) {
    candidate = `${base}-${suffix}`
    suffix += 1
  }
  usedIds.add(candidate)
  return candidate
}

function normalizeLookup(value: string): string {
  return slug(value) || value.trim().toLowerCase()
}

function normalizeNodeType(value: unknown): 'activity' | 'decision' | 'stage' | 'bottleneck' | 'start' | 'end' | null {
  const compact = compactToken(value)
  if (!compact) return null
  if (['activity', 'task', 'step', 'work'].includes(compact)) return 'activity'
  if (['decision', 'decisionpoint', 'gateway', 'choice'].includes(compact)) return 'decision'
  if (['stage', 'phase', 'milestonephase'].includes(compact)) return 'stage'
  if (['bottleneck', 'blocker', 'riskpoint'].includes(compact)) return 'bottleneck'
  if (compact === 'start') return 'start'
  if (compact === 'end') return 'end'
  return null
}

function normalizeResponsibilityKind(value: unknown): string | null {
  const compact = compactToken(value)
  if (!compact) return null
  if (['r', 'responsible', 'responsibility', 'doer'].includes(compact)) return 'responsible'
  if (['a', 'accountable', 'approver', 'owner'].includes(compact)) return 'accountable'
  if (['s', 'supporting', 'support', 'supports'].includes(compact)) return 'supporting'
  if (['c', 'consulted', 'consult', 'consults'].includes(compact)) return 'consulted'
  if (['i', 'informed', 'inform', 'notified'].includes(compact)) return 'informed'
  return null
}

function normalizeGuidanceKind(value: unknown): string | null {
  const compact = compactToken(value)
  if (!compact) return null
  if (['template', 'checklist', 'practice', 'tool', 'training', 'link', 'other'].includes(compact)) return compact
  if (['guide', 'guidance', 'document', 'doc'].includes(compact)) return 'other'
  return null
}

function normalizeWorkProductRelation(value: unknown): 'input' | 'output' | null {
  const compact = compactToken(value)
  if (['input', 'consume', 'consumer', 'consumed'].includes(compact)) return 'input'
  if (['output', 'produce', 'producer', 'produced'].includes(compact)) return 'output'
  return null
}

function compactToken(value: unknown): string {
  return firstString(value)?.toLowerCase().replace(/[^a-z]/g, '') ?? ''
}

function firstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value !== 'string') continue
    const trimmed = value.trim()
    if (trimmed) return trimmed
  }
  return undefined
}

function isRecord(value: unknown): value is DraftRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function titleFromId(value: string): string {
  return value.split(/[-_]+/g).filter(Boolean).map(capitalize).join(' ') || value
}

function formatSchemaIssues(issues: ZodIssue[]): string {
  const details = issues.slice(0, 4).map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join('.') : 'draft'
    return `${path} ${issue.message}`
  })
  if (issues.length > details.length) details.push(`${issues.length - details.length} more issue(s)`)
  return details.join('; ')
}

function createProcessAssets(draft: AiMapDraft): ProcessAssets {
  const workProducts: Record<string, WorkProductAsset> = Object.fromEntries(draft.workProducts.map((asset) => [
    safeId(asset.id),
    {
      id: safeId(asset.id),
      title: asset.title,
      state: asset.state,
      description: asset.description,
      activityLinks: [],
      producerNodeIds: [],
      consumerNodeIds: [],
      handoffEdgeIds: [],
      guidanceIds: [],
    },
  ]))

  const guidanceItems: Record<string, GuidanceAsset> = Object.fromEntries(draft.guidanceItems.map((asset) => [
    safeId(asset.id),
    {
      id: safeId(asset.id),
      title: asset.title,
      kind: asset.kind,
      description: asset.description,
      url: asset.url,
      appliesToNodeIds: [],
      appliesToEdgeIds: [],
      workProductIds: [],
    },
  ]))

  const milestones: Record<string, MilestoneAsset> = Object.fromEntries(draft.milestones.map((asset) => [
    safeId(asset.id),
    {
      id: safeId(asset.id),
      title: asset.title,
      description: asset.description,
      stageNodeId: asset.stageNodeId,
      workProductStates: asset.workProductStates,
    },
  ]))

  return { workProducts, guidanceItems, milestones }
}

function linkAssetsFromDraft(doc: GraphDocument, draft: AiMapDraft): GraphDocument {
  let next = doc
  for (const node of draft.nodes) {
    const nodeId = safeId(node.id)
    for (const input of node.inputs) {
      next = linkWorkProductToActivity(next, safeId(input.workProductId), nodeId, 'input', input.maturity)
    }
    for (const output of node.outputs) {
      next = linkWorkProductToActivity(next, safeId(output.workProductId), nodeId, 'output', output.maturity)
    }
    for (const guidanceId of node.guidanceIds) {
      next = linkGuidanceToActivity(next, safeId(guidanceId), nodeId)
    }
  }

  for (const edge of draft.edges) {
    const edgeId = safeId(edge.id)
    for (const workProductId of edge.workProductIds) {
      next = linkWorkProductToHandoff(next, safeId(workProductId), edgeId)
    }
  }

  for (const guidance of draft.guidanceItems) {
    const guidanceId = safeId(guidance.id)
    for (const nodeId of guidance.appliesToNodeIds) {
      next = linkGuidanceToActivity(next, guidanceId, safeId(nodeId))
    }
    for (const edgeId of guidance.appliesToEdgeIds) {
      next = linkGuidanceToHandoff(next, guidanceId, safeId(edgeId))
    }
    for (const workProductId of guidance.workProductIds) {
      next = linkGuidanceToWorkProduct(next, guidanceId, safeId(workProductId))
    }
  }

  return next
}

function repairGeneratedMainline(doc: GraphDocument, generatedNodeIds: string[]): void {
  for (let index = 0; index < generatedNodeIds.length - 1; index += 1) {
    const sourceNodeId = generatedNodeIds[index]
    const targetNodeId = generatedNodeIds[index + 1]
    if (hasDirectedPath(doc, sourceNodeId, targetNodeId)) continue
    if (hasIncomingEdge(doc, targetNodeId)) continue
    addGeneratedEdge(doc, sourceNodeId, targetNodeId, uniqueEdgeId(doc, `handoff-mainline-${index + 1}`))
  }
}

function hasIncomingEdge(doc: GraphDocument, targetNodeId: string): boolean {
  return Array.from(doc.edges.values()).some((edge) => edge.targetNodeId === targetNodeId)
}

function hasDirectedPath(doc: GraphDocument, sourceNodeId: string, targetNodeId: string): boolean {
  if (sourceNodeId === targetNodeId) return true
  const adjacency = new Map<string, string[]>()
  for (const edge of doc.edges.values()) {
    const targets = adjacency.get(edge.sourceNodeId) ?? []
    targets.push(edge.targetNodeId)
    adjacency.set(edge.sourceNodeId, targets)
  }

  const visited = new Set<string>()
  const queue = [sourceNodeId]
  while (queue.length > 0) {
    const current = queue.shift()!
    if (current === targetNodeId) return true
    if (visited.has(current)) continue
    visited.add(current)
    queue.push(...(adjacency.get(current) ?? []))
  }
  return false
}

function addGeneratedEdge(doc: GraphDocument, sourceNodeId: string, targetNodeId: string, id: string, label = ''): void {
  doc.edges.set(id, {
    ...createHandoffEdge(id, sourceNodeId, 'out', targetNodeId, 'in'),
    label,
  })
}

function uniqueEdgeId(doc: GraphDocument, baseId: string): string {
  let candidate = baseId
  let suffix = 2
  while (doc.edges.has(candidate)) {
    candidate = `${baseId}-${suffix}`
    suffix += 1
  }
  return candidate
}

function uniqueNodeId(doc: GraphDocument, baseId: string): string {
  let candidate = baseId
  let suffix = 2
  while (doc.nodes.has(candidate)) {
    candidate = `${baseId}-${suffix}`
    suffix += 1
  }
  return candidate
}

function safeId(value: string): string {
  return value.trim()
}

function slug(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.trim().length > 0))]
}
