import type {
  ActivityResponsibility,
  GraphDocument,
  GraphEdge,
  GraphNode,
  GuidanceAsset,
  GuidanceKind,
  MilestoneAsset,
  ProcessAssets,
  ResponsibilityKind,
  WorkProductActivityLink,
  WorkProductActivityRelation,
  WorkProductAsset,
} from './canvasTypes'

export const WORK_PRODUCT_MATURITY_OPTIONS = ['Needed', 'Draft', 'Review ready', 'Approved', 'Released'] as const
export const DEFAULT_WORK_PRODUCT_MATURITY = 'Draft'

export const EMPTY_PROCESS_ASSETS: ProcessAssets = {
  workProducts: {},
  guidanceItems: {},
  milestones: {},
}

type WorkProductDraft = Pick<WorkProductAsset, 'id' | 'title' | 'state' | 'description'>
type GuidanceDraft = Pick<GuidanceAsset, 'id' | 'title' | 'kind' | 'description' | 'url'>
type MilestoneDraft = Pick<MilestoneAsset, 'id' | 'title' | 'description' | 'stageNodeId' | 'workProductStates'>
export type ProcessAssetKind = 'workProduct' | 'guidance' | 'milestone'
export type ProcessAssetUsage = {
  total: number
  references: { kind: string; id: string; label: string }[]
}

export function createEmptyProcessAssets(): ProcessAssets {
  return {
    workProducts: {},
    guidanceItems: {},
    milestones: {},
  }
}

export function normalizeProcessAssets(value: ProcessAssets | undefined): ProcessAssets {
  if (!value) return createEmptyProcessAssets()
  return {
    workProducts: Object.fromEntries(
      Object.entries(value.workProducts ?? {}).map(([id, asset]) => [id, normalizeWorkProductAsset(asset)]),
    ),
    guidanceItems: value.guidanceItems ?? {},
    milestones: value.milestones ?? {},
  }
}

export function getWorkProductActivityLinks(asset: WorkProductAsset): WorkProductActivityLink[] {
  return normalizeWorkProductAsset(asset).activityLinks ?? []
}

export function hasWorkProductActivityMaturityConflict(
  asset: WorkProductAsset,
  nodeId: string,
  relation: WorkProductActivityRelation,
  maturity: string,
): boolean {
  const normalizedMaturity = normalizeMaturity(maturity, asset.state)
  const oppositeRelation: WorkProductActivityRelation = relation === 'input' ? 'output' : 'input'
  return getWorkProductActivityLinks(asset).some((link) =>
    link.nodeId === nodeId &&
    link.relation === oppositeRelation &&
    link.maturity === normalizedMaturity
  )
}

export function getActivityResponsibilities(node: GraphNode): ActivityResponsibility[] {
  if (node.responsibilities && node.responsibilities.length > 0) {
    return normalizeActivityResponsibilities(node.responsibilities, { nodeId: node.id })
  }

  return normalizeActivityResponsibilities(
    node.roleTags.map((roleName, index) => ({
      roleName,
      kind: index === 0 ? 'responsible' : 'supporting',
    })),
    { nodeId: node.id },
  )
}

export function normalizeActivityResponsibilities(
  responsibilities: Array<ActivityResponsibility | { id?: string; roleId?: string; roleName: string; kind: ResponsibilityKind }>,
  options: { nodeId?: string } = {},
): ActivityResponsibility[] {
  const seen = new Set<string>()
  const seenRoleNames = new Set<string>()
  const result: ActivityResponsibility[] = []
  let hasResponsible = false

  for (const responsibility of responsibilities) {
    const roleName = responsibility.roleName.trim()
    if (!roleName) continue
    const roleKey = roleName.toLowerCase()
    if (seenRoleNames.has(roleKey)) continue

    let kind = responsibility.kind
    if (kind === 'responsible') {
      if (hasResponsible) {
        kind = 'supporting'
      } else {
        hasResponsible = true
      }
    }

    const key = `${roleName.toLowerCase()}:${kind}`
    if (seen.has(key)) continue
    seen.add(key)
    seenRoleNames.add(roleKey)

    result.push({
      id: responsibility.id || makeResponsibilityId(roleName, kind, options.nodeId),
      roleName,
      ...(responsibility.roleId ? { roleId: responsibility.roleId } : {}),
      kind,
    })
  }

  return result
}

export function collectResponsibilityRoleTags(responsibilities: ActivityResponsibility[]): string[] {
  return unique(responsibilities.map((responsibility) => responsibility.roleName))
}

export function addResponsibility(
  doc: GraphDocument,
  nodeId: string,
  responsibility: ActivityResponsibility | { roleName: string; kind: ResponsibilityKind },
): GraphDocument {
  const node = doc.nodes.get(nodeId)
  if (!node || node.type !== 'activity') return doc

  const normalized: ActivityResponsibility = {
    id: 'id' in responsibility
      ? responsibility.id
      : `responsibility-${nodeId}-${slug(responsibility.roleName)}-${responsibility.kind}`,
    roleName: responsibility.roleName.trim(),
    ...('roleId' in responsibility && responsibility.roleId ? { roleId: responsibility.roleId } : {}),
    kind: responsibility.kind,
  }
  if (!normalized.roleName) return doc

  const responsibilities = normalizeActivityResponsibilities([
    ...getActivityResponsibilities(node),
    normalized,
  ], { nodeId })
  return updateNode(doc, nodeId, {
    responsibilities,
    roleTags: collectResponsibilityRoleTags(responsibilities),
  })
}

export function removeResponsibility(doc: GraphDocument, nodeId: string, responsibilityId: string): GraphDocument {
  const node = doc.nodes.get(nodeId)
  if (!node || node.type !== 'activity') return doc
  const responsibilities = normalizeActivityResponsibilities(
    getActivityResponsibilities(node).filter((item) => item.id !== responsibilityId),
    { nodeId },
  )
  return updateNode(doc, nodeId, {
    responsibilities,
    roleTags: collectResponsibilityRoleTags(responsibilities),
  })
}

export function addWorkProductAsset(doc: GraphDocument, draft: WorkProductDraft): GraphDocument {
  const processAssets = normalizeProcessAssets(doc.processAssets)
  const workProduct: WorkProductAsset = {
    id: draft.id,
    title: draft.title,
    state: draft.state,
    description: draft.description,
    activityLinks: [],
    producerNodeIds: [],
    consumerNodeIds: [],
    handoffEdgeIds: [],
    guidanceIds: [],
  }
  return updateProcessAssets(doc, {
    ...processAssets,
    workProducts: {
      ...processAssets.workProducts,
      [workProduct.id]: workProduct,
    },
  })
}

export function renameWorkProductAsset(doc: GraphDocument, id: string, title: string): GraphDocument {
  const asset = doc.processAssets.workProducts[id]
  if (!asset) return doc
  return patchWorkProduct(doc, id, { title })
}

export function updateWorkProductAsset(doc: GraphDocument, id: string, patch: Partial<WorkProductAsset>): GraphDocument {
  return patchWorkProduct(doc, id, patch)
}

export function deleteWorkProductAsset(doc: GraphDocument, id: string): GraphDocument {
  if (!doc.processAssets.workProducts[id]) return doc
  const nextAssets = normalizeProcessAssets(doc.processAssets)
  const workProducts = { ...nextAssets.workProducts }
  delete workProducts[id]
  const guidanceItems = Object.fromEntries(
    Object.entries(nextAssets.guidanceItems).map(([guidanceId, guidance]) => [
      guidanceId,
      {
        ...guidance,
        workProductIds: guidance.workProductIds.filter((candidate) => candidate !== id),
      },
    ]),
  )
  const milestones = Object.fromEntries(
    Object.entries(nextAssets.milestones).map(([milestoneId, milestone]) => [
      milestoneId,
      {
        ...milestone,
        workProductStates: milestone.workProductStates.filter((state) => state.workProductId !== id),
      },
    ]),
  )
  const edges = new Map(doc.edges)
  for (const [edgeId, edge] of edges) {
    if (edge.workProductIds?.includes(id)) {
      edges.set(edgeId, {
        ...edge,
        workProductIds: edge.workProductIds.filter((candidate) => candidate !== id),
      })
    }
  }
  return touch({
    ...doc,
    edges,
    processAssets: { ...nextAssets, workProducts, guidanceItems, milestones },
  }, doc)
}

export function linkWorkProductToActivity(
  doc: GraphDocument,
  workProductId: string,
  nodeId: string,
  relation: 'input' | 'output',
  maturity?: string,
): GraphDocument {
  const node = doc.nodes.get(nodeId)
  const asset = doc.processAssets.workProducts[workProductId]
  if (!node || node.type !== 'activity' || !asset) return doc

  const normalized = normalizeWorkProductAsset(asset)
  const nextMaturity = normalizeMaturity(maturity, normalized.state)
  const links = normalized.activityLinks ?? []
  const oppositeRelation: WorkProductActivityRelation = relation === 'input' ? 'output' : 'input'
  if (links.some((link) =>
    link.nodeId === nodeId &&
    link.relation === oppositeRelation &&
    link.maturity === nextMaturity
  )) {
    return doc
  }
  if (links.some((link) =>
    link.nodeId === nodeId &&
    link.relation === relation &&
    link.maturity === nextMaturity
  )) {
    return doc
  }

  return patchWorkProduct(doc, workProductId, {
    activityLinks: [
      ...links,
      createWorkProductActivityLink(workProductId, nodeId, relation, nextMaturity),
    ],
  })
}

export function unlinkWorkProductFromActivity(
  doc: GraphDocument,
  workProductId: string,
  nodeId: string,
  relation: 'input' | 'output',
  maturity?: string,
): GraphDocument {
  const asset = doc.processAssets.workProducts[workProductId]
  if (!asset) return doc
  const normalized = normalizeWorkProductAsset(asset)
  const targetMaturity = maturity?.trim()
  return patchWorkProduct(doc, workProductId, {
    activityLinks: (normalized.activityLinks ?? []).filter((link) => {
      if (link.nodeId !== nodeId || link.relation !== relation) return true
      if (!targetMaturity) return false
      return link.maturity !== targetMaturity
    }),
  })
}

export function linkWorkProductToHandoff(
  doc: GraphDocument,
  workProductId: string,
  edgeId: string,
): GraphDocument {
  const edge = doc.edges.get(edgeId)
  const asset = doc.processAssets.workProducts[workProductId]
  if (!edge || !asset) return doc

  const edges = new Map(doc.edges)
  edges.set(edgeId, {
    ...edge,
    workProductIds: addUnique(edge.workProductIds ?? [], workProductId),
  })

  const next = patchWorkProduct({ ...doc, edges }, workProductId, {
    handoffEdgeIds: addUnique(asset.handoffEdgeIds, edgeId),
  })
  return next
}

export function unlinkWorkProductFromHandoff(
  doc: GraphDocument,
  workProductId: string,
  edgeId: string,
): GraphDocument {
  const edge = doc.edges.get(edgeId)
  const asset = doc.processAssets.workProducts[workProductId]
  if (!edge || !asset) return doc

  const edges = new Map(doc.edges)
  edges.set(edgeId, {
    ...edge,
    workProductIds: (edge.workProductIds ?? []).filter((id) => id !== workProductId),
  })

  return patchWorkProduct({ ...doc, edges }, workProductId, {
    handoffEdgeIds: asset.handoffEdgeIds.filter((id) => id !== edgeId),
  })
}

export function addGuidanceAsset(doc: GraphDocument, draft: GuidanceDraft): GraphDocument {
  const processAssets = normalizeProcessAssets(doc.processAssets)
  const guidance: GuidanceAsset = {
    id: draft.id,
    title: draft.title,
    kind: draft.kind,
    description: draft.description,
    url: draft.url,
    appliesToNodeIds: [],
    appliesToEdgeIds: [],
    workProductIds: [],
  }
  return updateProcessAssets(doc, {
    ...processAssets,
    guidanceItems: {
      ...processAssets.guidanceItems,
      [guidance.id]: guidance,
    },
  })
}

export function renameGuidanceAsset(doc: GraphDocument, id: string, title: string): GraphDocument {
  const guidance = doc.processAssets.guidanceItems[id]
  if (!guidance) return doc
  return patchGuidance(doc, id, { title })
}

export function updateGuidanceAsset(doc: GraphDocument, id: string, patch: Partial<GuidanceAsset>): GraphDocument {
  return patchGuidance(doc, id, patch)
}

export function deleteGuidanceAsset(doc: GraphDocument, id: string): GraphDocument {
  if (!doc.processAssets.guidanceItems[id]) return doc
  const nextAssets = normalizeProcessAssets(doc.processAssets)
  const guidanceItems = { ...nextAssets.guidanceItems }
  delete guidanceItems[id]
  const workProducts = Object.fromEntries(
    Object.entries(nextAssets.workProducts).map(([workProductId, workProduct]) => [
      workProductId,
      {
        ...workProduct,
        guidanceIds: workProduct.guidanceIds.filter((candidate) => candidate !== id),
      },
    ]),
  )
  return updateProcessAssets(doc, { ...nextAssets, guidanceItems, workProducts })
}

export function linkGuidanceToActivity(doc: GraphDocument, guidanceId: string, nodeId: string): GraphDocument {
  const guidance = doc.processAssets.guidanceItems[guidanceId]
  if (!guidance || !doc.nodes.has(nodeId)) return doc
  return patchGuidance(doc, guidanceId, {
    appliesToNodeIds: addUnique(guidance.appliesToNodeIds, nodeId),
  })
}

export function unlinkGuidanceFromActivity(doc: GraphDocument, guidanceId: string, nodeId: string): GraphDocument {
  const guidance = doc.processAssets.guidanceItems[guidanceId]
  if (!guidance) return doc
  return patchGuidance(doc, guidanceId, {
    appliesToNodeIds: guidance.appliesToNodeIds.filter((id) => id !== nodeId),
  })
}

export function linkGuidanceToHandoff(doc: GraphDocument, guidanceId: string, edgeId: string): GraphDocument {
  const guidance = doc.processAssets.guidanceItems[guidanceId]
  if (!guidance || !doc.edges.has(edgeId)) return doc
  return patchGuidance(doc, guidanceId, {
    appliesToEdgeIds: addUnique(guidance.appliesToEdgeIds, edgeId),
  })
}

export function unlinkGuidanceFromHandoff(doc: GraphDocument, guidanceId: string, edgeId: string): GraphDocument {
  const guidance = doc.processAssets.guidanceItems[guidanceId]
  if (!guidance) return doc
  return patchGuidance(doc, guidanceId, {
    appliesToEdgeIds: guidance.appliesToEdgeIds.filter((id) => id !== edgeId),
  })
}

export function linkGuidanceToWorkProduct(doc: GraphDocument, guidanceId: string, workProductId: string): GraphDocument {
  const guidance = doc.processAssets.guidanceItems[guidanceId]
  const workProduct = doc.processAssets.workProducts[workProductId]
  if (!guidance || !workProduct) return doc
  const processAssets = normalizeProcessAssets(doc.processAssets)
  return updateProcessAssets(doc, {
    ...processAssets,
    guidanceItems: {
      ...processAssets.guidanceItems,
      [guidanceId]: {
        ...guidance,
        workProductIds: addUnique(guidance.workProductIds, workProductId),
      },
    },
    workProducts: {
      ...processAssets.workProducts,
      [workProductId]: {
        ...workProduct,
        guidanceIds: addUnique(workProduct.guidanceIds, guidanceId),
      },
    },
  })
}

export function unlinkGuidanceFromWorkProduct(doc: GraphDocument, guidanceId: string, workProductId: string): GraphDocument {
  const guidance = doc.processAssets.guidanceItems[guidanceId]
  const workProduct = doc.processAssets.workProducts[workProductId]
  if (!guidance || !workProduct) return doc
  const processAssets = normalizeProcessAssets(doc.processAssets)
  return updateProcessAssets(doc, {
    ...processAssets,
    guidanceItems: {
      ...processAssets.guidanceItems,
      [guidanceId]: {
        ...guidance,
        workProductIds: guidance.workProductIds.filter((id) => id !== workProductId),
      },
    },
    workProducts: {
      ...processAssets.workProducts,
      [workProductId]: {
        ...workProduct,
        guidanceIds: workProduct.guidanceIds.filter((id) => id !== guidanceId),
      },
    },
  })
}

export function addMilestoneAsset(doc: GraphDocument, draft: MilestoneDraft): GraphDocument {
  const processAssets = normalizeProcessAssets(doc.processAssets)
  const milestone: MilestoneAsset = {
    id: draft.id,
    title: draft.title,
    description: draft.description,
    stageNodeId: draft.stageNodeId,
    workProductStates: [...draft.workProductStates],
  }
  return updateProcessAssets(doc, {
    ...processAssets,
    milestones: {
      ...processAssets.milestones,
      [milestone.id]: milestone,
    },
  })
}

export function renameMilestoneAsset(doc: GraphDocument, id: string, title: string): GraphDocument {
  const milestone = doc.processAssets.milestones[id]
  if (!milestone) return doc
  return patchMilestone(doc, id, { title })
}

export function updateMilestoneAsset(doc: GraphDocument, id: string, patch: Partial<MilestoneAsset>): GraphDocument {
  return patchMilestone(doc, id, patch)
}

export function deleteMilestoneAsset(doc: GraphDocument, id: string): GraphDocument {
  if (!doc.processAssets.milestones[id]) return doc
  const nextAssets = normalizeProcessAssets(doc.processAssets)
  const milestones = { ...nextAssets.milestones }
  delete milestones[id]
  return updateProcessAssets(doc, { ...nextAssets, milestones })
}

export function upsertMilestoneWorkProductState(
  doc: GraphDocument,
  milestoneId: string,
  workProductId: string,
  state: string,
): GraphDocument {
  const milestone = doc.processAssets.milestones[milestoneId]
  if (!milestone || !doc.processAssets.workProducts[workProductId]) return doc
  const withoutExisting = milestone.workProductStates.filter((item) => item.workProductId !== workProductId)
  return patchMilestone(doc, milestoneId, {
    workProductStates: [...withoutExisting, { workProductId, state }],
  })
}

export function updateMilestoneWorkProductState(
  doc: GraphDocument,
  milestoneId: string,
  workProductId: string,
  state: string,
): GraphDocument {
  return upsertMilestoneWorkProductState(doc, milestoneId, workProductId, state)
}

export function removeMilestoneWorkProductState(
  doc: GraphDocument,
  milestoneId: string,
  workProductId: string,
): GraphDocument {
  const milestone = doc.processAssets.milestones[milestoneId]
  if (!milestone) return doc
  return patchMilestone(doc, milestoneId, {
    workProductStates: milestone.workProductStates.filter((state) => state.workProductId !== workProductId),
  })
}

export function getNodeAssetSummary(doc: GraphDocument, nodeId: string) {
  const node = doc.nodes.get(nodeId)
  const responsibilities = node ? getActivityResponsibilities(node) : []
  const assets = normalizeProcessAssets(doc.processAssets)
  return {
    responsibleRoles: responsibilities.filter((item) => item.kind === 'responsible').map((item) => item.roleName),
    accountableRoles: responsibilities.filter((item) => item.kind === 'accountable').map((item) => item.roleName),
    inputCount: Object.values(assets.workProducts).reduce((count, asset) => (
      count + getWorkProductActivityLinks(asset).filter((link) => link.nodeId === nodeId && link.relation === 'input').length
    ), 0),
    outputCount: Object.values(assets.workProducts).reduce((count, asset) => (
      count + getWorkProductActivityLinks(asset).filter((link) => link.nodeId === nodeId && link.relation === 'output').length
    ), 0),
    guidanceCount: Object.values(assets.guidanceItems).filter((asset) => asset.appliesToNodeIds.includes(nodeId)).length,
    milestoneCount: Object.values(assets.milestones).filter((asset) => asset.stageNodeId === nodeId).length,
  }
}

export function getEdgeAssetSummary(doc: GraphDocument, edgeId: string) {
  const assets = normalizeProcessAssets(doc.processAssets)
  return {
    workProductCount: Object.values(assets.workProducts).filter((asset) => asset.handoffEdgeIds.includes(edgeId)).length,
  }
}

export function deriveProcessPerspectives(doc: GraphDocument) {
  const assets = normalizeProcessAssets(doc.processAssets)
  const nodeTitle = (id: string) => doc.nodes.get(id)?.title ?? id
  const edgeTitle = (edge: GraphEdge) => `${nodeTitle(edge.sourceNodeId)} -> ${nodeTitle(edge.targetNodeId)}`

  const what = {
    workProducts: Object.values(assets.workProducts).map((asset) => {
      const activityLinks = getWorkProductActivityLinks(asset)
      return {
        id: asset.id,
        title: asset.title,
        state: asset.state,
        producedBy: unique(activityLinks.filter((link) => link.relation === 'output').map((link) => nodeTitle(link.nodeId))),
        consumedBy: unique(activityLinks.filter((link) => link.relation === 'input').map((link) => nodeTitle(link.nodeId))),
        movedBy: asset.handoffEdgeIds.flatMap((edgeId) => {
          const edge = doc.edges.get(edgeId)
          return edge ? [edgeTitle(edge)] : []
        }),
        maturityFlows: deriveMaturityFlows(activityLinks, nodeTitle),
      }
    }),
  }

  const roleMap = new Map<string, { roleName: string; activities: { activityTitle: string; kind: ResponsibilityKind }[] }>()
  for (const node of doc.nodes.values()) {
    if (node.type !== 'activity') continue
    for (const responsibility of getActivityResponsibilities(node)) {
      const current = roleMap.get(responsibility.roleName) ?? { roleName: responsibility.roleName, activities: [] }
      current.activities.push({ activityTitle: node.title, kind: responsibility.kind })
      roleMap.set(responsibility.roleName, current)
    }
  }

  const when = {
    milestones: Object.values(assets.milestones).map((milestone) => ({
      title: milestone.title,
      stageTitle: milestone.stageNodeId ? nodeTitle(milestone.stageNodeId) : 'Unassigned stage',
      workProductStates: milestone.workProductStates.map((state) => {
        const workProduct = assets.workProducts[state.workProductId]
        return `${workProduct?.title ?? state.workProductId}: ${state.state}`
      }),
    })),
  }

  const how = {
    guidance: Object.values(assets.guidanceItems).map((guidance) => ({
      id: guidance.id,
      title: guidance.title,
      kind: guidance.kind,
      appliesTo: [
        ...guidance.appliesToNodeIds.map(nodeTitle),
        ...guidance.appliesToEdgeIds.flatMap((edgeId) => {
          const edge = doc.edges.get(edgeId)
          return edge ? [edgeTitle(edge)] : []
        }),
        ...guidance.workProductIds.map((workProductId) => assets.workProducts[workProductId]?.title ?? workProductId),
      ],
    })),
  }

  return {
    what,
    who: { roles: Array.from(roleMap.values()) },
    when,
    how,
  }
}

export function getProcessAssetUsage(doc: GraphDocument, kind: ProcessAssetKind, id: string): ProcessAssetUsage {
  const assets = normalizeProcessAssets(doc.processAssets)
  const references: ProcessAssetUsage['references'] = []

  if (kind === 'workProduct') {
    const workProduct = assets.workProducts[id]
    if (!workProduct) return { total: 0, references }
    for (const link of getWorkProductActivityLinks(workProduct)) {
      references.push({
        kind: link.relation === 'output' ? 'producer' : 'consumer',
        id: link.nodeId,
        label: `${nodeLabel(doc, link.nodeId)} · ${link.maturity}`,
      })
    }
    for (const edgeId of workProduct.handoffEdgeIds) {
      references.push({ kind: 'handoff', id: edgeId, label: edgeLabel(doc, edgeId) })
    }
    for (const guidanceId of workProduct.guidanceIds) {
      references.push({ kind: 'guidance', id: guidanceId, label: assets.guidanceItems[guidanceId]?.title ?? guidanceId })
    }
    for (const milestone of Object.values(assets.milestones)) {
      if (milestone.workProductStates.some((state) => state.workProductId === id)) {
        references.push({ kind: 'milestone', id: milestone.id, label: milestone.title })
      }
    }
  } else if (kind === 'guidance') {
    const guidance = assets.guidanceItems[id]
    if (!guidance) return { total: 0, references }
    for (const nodeId of guidance.appliesToNodeIds) {
      references.push({ kind: 'node', id: nodeId, label: nodeLabel(doc, nodeId) })
    }
    for (const edgeId of guidance.appliesToEdgeIds) {
      references.push({ kind: 'handoff', id: edgeId, label: edgeLabel(doc, edgeId) })
    }
    for (const workProductId of guidance.workProductIds) {
      references.push({ kind: 'workProduct', id: workProductId, label: assets.workProducts[workProductId]?.title ?? workProductId })
    }
  } else {
    const milestone = assets.milestones[id]
    if (!milestone) return { total: 0, references }
    if (milestone.stageNodeId) {
      references.push({ kind: 'stage', id: milestone.stageNodeId, label: nodeLabel(doc, milestone.stageNodeId) })
    }
    for (const state of milestone.workProductStates) {
      references.push({
        kind: 'workProductState',
        id: state.workProductId,
        label: `${assets.workProducts[state.workProductId]?.title ?? state.workProductId}: ${state.state}`,
      })
    }
  }

  return { total: references.length, references }
}

export function isGuidanceKind(value: string): value is GuidanceKind {
  return ['template', 'checklist', 'practice', 'tool', 'training', 'link', 'other'].includes(value)
}

function deriveMaturityFlows(
  links: WorkProductActivityLink[],
  nodeTitle: (nodeId: string) => string,
): string[] {
  const grouped = new Map<string, { inputs: string[]; outputs: string[] }>()
  for (const link of links) {
    const current = grouped.get(link.nodeId) ?? { inputs: [], outputs: [] }
    if (link.relation === 'input') {
      current.inputs = addUnique(current.inputs, link.maturity)
    } else {
      current.outputs = addUnique(current.outputs, link.maturity)
    }
    grouped.set(link.nodeId, current)
  }

  const flows: string[] = []
  for (const [nodeId, group] of grouped) {
    for (const input of group.inputs) {
      for (const output of group.outputs) {
        flows.push(`${nodeTitle(nodeId)}: ${input} -> ${output}`)
      }
    }
  }
  return flows
}

function normalizeWorkProductAsset(asset: WorkProductAsset): WorkProductAsset {
  const fallbackMaturity = normalizeMaturity(asset.state, DEFAULT_WORK_PRODUCT_MATURITY)
  const activityLinks = asset.activityLinks
    ? dedupeActivityLinks(asset.id, asset.activityLinks.map((link) => createWorkProductActivityLink(
      asset.id,
      link.nodeId,
      link.relation,
      normalizeMaturity(link.maturity, fallbackMaturity),
    )))
    : dedupeActivityLinks(asset.id, [
      ...asset.producerNodeIds.map((nodeId) => createWorkProductActivityLink(asset.id, nodeId, 'output', fallbackMaturity)),
      ...asset.consumerNodeIds.map((nodeId) => createWorkProductActivityLink(asset.id, nodeId, 'input', fallbackMaturity)),
    ])

  return {
    ...asset,
    activityLinks,
    producerNodeIds: unique(activityLinks.filter((link) => link.relation === 'output').map((link) => link.nodeId)),
    consumerNodeIds: unique(activityLinks.filter((link) => link.relation === 'input').map((link) => link.nodeId)),
  }
}

function createWorkProductActivityLink(
  workProductId: string,
  nodeId: string,
  relation: WorkProductActivityRelation,
  maturity: string,
): WorkProductActivityLink {
  return {
    id: `wp-link-${slug(workProductId)}-${slug(nodeId)}-${relation}-${slug(maturity)}`,
    nodeId,
    relation,
    maturity,
  }
}

function dedupeActivityLinks(workProductId: string, links: WorkProductActivityLink[]): WorkProductActivityLink[] {
  const seen = new Set<string>()
  const result: WorkProductActivityLink[] = []
  for (const link of links) {
    const maturity = normalizeMaturity(link.maturity, DEFAULT_WORK_PRODUCT_MATURITY)
    const key = `${link.nodeId}:${link.relation}:${maturity}`
    if (seen.has(key)) continue
    seen.add(key)
    result.push(createWorkProductActivityLink(workProductId, link.nodeId, link.relation, maturity))
  }
  return result
}

function normalizeMaturity(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim()
  if (trimmed) return trimmed
  return fallback.trim() || DEFAULT_WORK_PRODUCT_MATURITY
}

function patchWorkProduct(doc: GraphDocument, id: string, patch: Partial<WorkProductAsset>): GraphDocument {
  const processAssets = normalizeProcessAssets(doc.processAssets)
  const asset = processAssets.workProducts[id]
  if (!asset) return doc
  const nextAsset = normalizeWorkProductAsset({ ...asset, ...patch })
  return updateProcessAssets(doc, {
    ...processAssets,
    workProducts: {
      ...processAssets.workProducts,
      [id]: nextAsset,
    },
  })
}

function patchGuidance(doc: GraphDocument, id: string, patch: Partial<GuidanceAsset>): GraphDocument {
  const processAssets = normalizeProcessAssets(doc.processAssets)
  const guidance = processAssets.guidanceItems[id]
  if (!guidance) return doc
  return updateProcessAssets(doc, {
    ...processAssets,
    guidanceItems: {
      ...processAssets.guidanceItems,
      [id]: { ...guidance, ...patch },
    },
  })
}

function patchMilestone(doc: GraphDocument, id: string, patch: Partial<MilestoneAsset>): GraphDocument {
  const processAssets = normalizeProcessAssets(doc.processAssets)
  const milestone = processAssets.milestones[id]
  if (!milestone) return doc
  return updateProcessAssets(doc, {
    ...processAssets,
    milestones: {
      ...processAssets.milestones,
      [id]: { ...milestone, ...patch },
    },
  })
}

function updateProcessAssets(doc: GraphDocument, processAssets: ProcessAssets): GraphDocument {
  return touch({ ...doc, processAssets }, doc)
}

function updateNode(doc: GraphDocument, nodeId: string, patch: Partial<GraphNode>): GraphDocument {
  const node = doc.nodes.get(nodeId)
  if (!node) return doc
  const nodes = new Map(doc.nodes)
  nodes.set(nodeId, { ...node, ...patch })
  return touch({ ...doc, nodes }, doc)
}

function touch(next: GraphDocument, previous: GraphDocument): GraphDocument {
  return {
    ...next,
    meta: {
      ...previous.meta,
      dirty: true,
      version: previous.meta.version + 1,
    },
  }
}

function makeResponsibilityId(roleName: string, kind: ResponsibilityKind, nodeId?: string): string {
  const scope = nodeId ? `${nodeId}-` : ''
  return `responsibility-${scope}${slug(roleName)}-${kind}`
}

function addUnique(values: string[], value: string): string[] {
  return values.includes(value) ? values : [...values, value]
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.trim().length > 0))]
}

function slug(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function nodeLabel(doc: GraphDocument, nodeId: string): string {
  return doc.nodes.get(nodeId)?.title ?? nodeId
}

function edgeLabel(doc: GraphDocument, edgeId: string): string {
  const edge = doc.edges.get(edgeId)
  if (!edge) return edgeId
  return `${nodeLabel(doc, edge.sourceNodeId)} -> ${nodeLabel(doc, edge.targetNodeId)}`
}
