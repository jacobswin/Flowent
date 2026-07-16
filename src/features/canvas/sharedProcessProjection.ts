import type { GraphDocument, GraphEdge, GraphNode, ProcessInstance } from './canvasTypes'
import { createHandoffEdge, createGraphNode } from './processElements'
import { collectResponsibilityRoleTags } from './processAssets'
import {
  getSharedProcessHandoffSourceId,
  getSharedProcessHandoffTargetId,
  type SharedActivity,
  type SharedElementLibrary,
  type SharedProcess,
  type SharedProcessDecision,
  type SharedProcessStage,
} from './sharedElements'

/**
 * Shared Processes are stored once, while Maps retain only an instance
 * position plus stable projected ids. The rendered node and edge records are
 * a cache: this function is the single place that refreshes that cache.
 */
export function insertSharedProcessInstance(
  doc: GraphDocument,
  process: SharedProcess,
  instanceId: string,
  position: { x: number; y: number },
  library: SharedElementLibrary,
): GraphDocument {
  if (doc.processInstances[instanceId]) return doc
  const instance: ProcessInstance = {
    id: instanceId,
    processId: process.id,
    x: position.x,
    y: position.y,
    nodeIdsByPlacement: Object.fromEntries(process.activities.map((placement) => [placement.id, `${instanceId}-node-${placement.id}`])),
    nodeIdsByDecision: Object.fromEntries((process.decisions ?? []).map((decision) => [decision.id, `${instanceId}-decision-${decision.id}`])),
    stageNodeIdsByStage: Object.fromEntries((process.stages ?? []).map((stage) => [stage.id, `${instanceId}-stage-${stage.id}`])),
    edgeIdsByHandoff: Object.fromEntries(process.handoffs.map((handoff) => [handoff.id, `${instanceId}-edge-${handoff.id}`])),
  }
  return syncSharedProcessInstances({
    ...doc,
    processInstances: { ...doc.processInstances, [instanceId]: instance },
  }, library)
}

export function syncSharedProcessInstances(doc: GraphDocument, library: SharedElementLibrary): GraphDocument {
  const nodes = new Map(doc.nodes)
  let edges = new Map(doc.edges)
  const processInstances: Record<string, ProcessInstance> = {}
  const removedNodeIds = new Set<string>()

  for (const rawInstance of Object.values(doc.processInstances ?? {})) {
    const instance: ProcessInstance = {
      ...rawInstance,
      nodeIdsByDecision: rawInstance.nodeIdsByDecision ?? {},
      stageNodeIdsByStage: rawInstance.stageNodeIdsByStage ?? {},
    }
    const process = library.processes[instance.processId]
    if (!process) {
      collectInstanceNodeIds(instance).forEach((nodeId) => removedNodeIds.add(nodeId))
      continue
    }

    const placementIds = new Set(process.activities.map((placement) => placement.id))
    const decisions = process.decisions ?? []
    const stages = process.stages ?? []
    const decisionIds = new Set(decisions.map((decision) => decision.id))
    const stageIds = new Set(stages.map((stage) => stage.id))
    removeMissingProjectedNodes(instance.nodeIdsByPlacement, placementIds, removedNodeIds)
    removeMissingProjectedNodes(instance.nodeIdsByDecision, decisionIds, removedNodeIds)
    removeMissingProjectedNodes(instance.stageNodeIdsByStage, stageIds, removedNodeIds)

    const nodeIdsByPlacement: Record<string, string> = {}
    for (const placement of process.activities) {
      const activity = library.activities[placement.activityId]
      if (!activity) continue
      const nodeId = instance.nodeIdsByPlacement[placement.id] ?? `${instance.id}-node-${placement.id}`
      nodeIdsByPlacement[placement.id] = nodeId
      nodes.set(nodeId, projectActivityNode(activity, placement.id, instance, placement.x, placement.y, library))
    }

    const nodeIdsByDecision: Record<string, string> = {}
    for (const decision of decisions) {
      const nodeId = instance.nodeIdsByDecision[decision.id] ?? `${instance.id}-decision-${decision.id}`
      nodeIdsByDecision[decision.id] = nodeId
      nodes.set(nodeId, projectDecisionNode(decision, instance, library))
    }

    const nodeIdsBySourceId = { ...nodeIdsByPlacement, ...nodeIdsByDecision }
    const stageNodeIdsByStage: Record<string, string> = {}
    for (const stage of stages) {
      const nodeId = instance.stageNodeIdsByStage[stage.id] ?? `${instance.id}-stage-${stage.id}`
      stageNodeIdsByStage[stage.id] = nodeId
      nodes.set(nodeId, projectStageNode(stage, instance, nodeIdsBySourceId, library))
    }

    const handoffIds = new Set(process.handoffs.map((handoff) => handoff.id))
    for (const [handoffId, edgeId] of Object.entries(instance.edgeIdsByHandoff)) {
      if (!handoffIds.has(handoffId)) edges.delete(edgeId)
    }

    const edgeIdsByHandoff: Record<string, string> = {}
    for (const handoff of process.handoffs) {
      const sourceNodeId = nodeIdsBySourceId[getSharedProcessHandoffSourceId(handoff)]
      const targetNodeId = nodeIdsBySourceId[getSharedProcessHandoffTargetId(handoff)]
      if (!sourceNodeId || !targetNodeId) continue
      const edgeId = instance.edgeIdsByHandoff[handoff.id] ?? `${instance.id}-edge-${handoff.id}`
      const edge: GraphEdge = {
        ...createHandoffEdge(edgeId, sourceNodeId, 'out', targetNodeId, 'in', {
          sourceAnchor: { side: 'right', offset: 0.5 },
          targetAnchor: { side: 'left', offset: 0.5 },
        }),
        label: handoff.label,
        ...(handoff.color ? { color: handoff.color } : {}),
        processInstanceId: instance.id,
        sharedProcessHandoffId: handoff.id,
      }
      edges.set(edgeId, edge)
      edgeIdsByHandoff[handoff.id] = edgeId
    }

    processInstances[instance.id] = {
      ...instance,
      nodeIdsByPlacement,
      nodeIdsByDecision,
      stageNodeIdsByStage,
      edgeIdsByHandoff,
    }
  }

  for (const nodeId of removedNodeIds) nodes.delete(nodeId)
  edges = new Map(Array.from(edges.entries()).filter(([, edge]) =>
    !removedNodeIds.has(edge.sourceNodeId) && !removedNodeIds.has(edge.targetNodeId),
  ))

  const processAssets = projectSharedProcessAssets({ processAssets: doc.processAssets, nodes, processInstances }, library)

  return {
    ...doc,
    nodes,
    edges,
    processInstances,
    processAssets,
    selectedNodeIds: new Set(Array.from(doc.selectedNodeIds).filter((id) => nodes.has(id))),
    selectedEdgeIds: new Set(Array.from(doc.selectedEdgeIds).filter((id) => edges.has(id))),
    meta: { ...doc.meta, dirty: true, version: doc.meta.version + 1 },
  }
}

function collectInstanceNodeIds(instance: ProcessInstance): string[] {
  return [
    ...Object.values(instance.nodeIdsByPlacement),
    ...Object.values(instance.nodeIdsByDecision ?? {}),
    ...Object.values(instance.stageNodeIdsByStage ?? {}),
  ]
}

function removeMissingProjectedNodes(
  idsBySource: Record<string, string>,
  sourceIds: Set<string>,
  removedNodeIds: Set<string>,
): void {
  for (const [sourceId, nodeId] of Object.entries(idsBySource)) {
    if (!sourceIds.has(sourceId)) removedNodeIds.add(nodeId)
  }
}

function projectSharedProcessAssets(
  doc: Pick<GraphDocument, 'processAssets' | 'processInstances' | 'nodes'>,
  library: SharedElementLibrary,
): GraphDocument['processAssets'] {
  const workProducts = projectSharedWorkProducts(doc, library)
  const milestones = Object.fromEntries(
    Object.entries(doc.processAssets.milestones).filter(([, milestone]) => !milestone.sharedProcessMilestoneId),
  )

  for (const instance of Object.values(doc.processInstances)) {
    const process = library.processes[instance.processId]
    if (!process) continue
    for (const stage of process.stages ?? []) {
      const stageNodeId = instance.stageNodeIdsByStage[stage.id]
      if (!stageNodeId || !doc.nodes.has(stageNodeId)) continue
      for (const milestone of stage.milestones) {
        const id = `shared-milestone-${instance.id}-${stage.id}-${milestone.id}`
        milestones[id] = {
          id,
          title: milestone.title,
          description: milestone.description,
          stageNodeId,
          sharedProcessStageId: stage.id,
          sharedProcessMilestoneId: milestone.id,
          workProductStates: milestone.workProductStates.map((state) => ({
            workProductId: `shared-work-product-${state.workProductId}`,
            state: state.state,
          })),
        }
      }
    }
  }

  return { ...doc.processAssets, workProducts, milestones }
}

function projectSharedWorkProducts(
  doc: Pick<GraphDocument, 'processAssets' | 'processInstances' | 'nodes'>,
  library: SharedElementLibrary,
): GraphDocument['processAssets']['workProducts'] {
  const workProducts = Object.fromEntries(
    Object.entries(doc.processAssets.workProducts).filter(([, asset]) => !asset.sharedWorkProductId),
  )

  for (const shared of Object.values(library.workProducts)) {
    const assetId = `shared-work-product-${shared.id}`
    workProducts[assetId] = {
      id: assetId,
      title: shared.title,
      state: shared.state,
      description: shared.description,
      sharedWorkProductId: shared.id,
      activityLinks: [],
      producerNodeIds: [],
      consumerNodeIds: [],
      handoffEdgeIds: [],
      guidanceIds: [],
    }
  }

  for (const instance of Object.values(doc.processInstances)) {
    const process = library.processes[instance.processId]
    if (!process) continue
    for (const placement of process.activities) {
      const activity = library.activities[placement.activityId]
      const nodeId = instance.nodeIdsByPlacement[placement.id]
      if (!activity || !nodeId || !doc.nodes.has(nodeId)) continue
      for (const sharedLink of activity.workProductLinks) {
        const shared = library.workProducts[sharedLink.workProductId]
        if (!shared) continue
        const assetId = `shared-work-product-${shared.id}`
        const previous = workProducts[assetId]
        const activityLinks = [
          ...(previous?.activityLinks ?? []),
          {
            id: `shared-wp-link-${instance.id}-${placement.id}-${sharedLink.id}`,
            nodeId,
            relation: sharedLink.relation,
            maturity: sharedLink.maturity || shared.state,
          },
        ]
        workProducts[assetId] = {
          id: assetId,
          title: shared.title,
          state: shared.state,
          description: shared.description,
          sharedWorkProductId: shared.id,
          activityLinks,
          producerNodeIds: Array.from(new Set(activityLinks.filter((link) => link.relation === 'output').map((link) => link.nodeId))),
          consumerNodeIds: Array.from(new Set(activityLinks.filter((link) => link.relation === 'input').map((link) => link.nodeId))),
          handoffEdgeIds: [],
          guidanceIds: [],
        }
      }
    }
  }
  return workProducts
}

function projectActivityNode(
  activity: SharedActivity,
  placementId: string,
  instance: ProcessInstance,
  x: number,
  y: number,
  library: SharedElementLibrary,
): GraphNode {
  const nodeId = instance.nodeIdsByPlacement[placementId] ?? `${instance.id}-node-${placementId}`
  const responsibilities = activity.responsibilities.flatMap((responsibility) => {
    const roleName = library.roles[responsibility.roleId]?.name
    if (!roleName) return []
    return [{
      id: responsibility.id,
      roleId: responsibility.roleId,
      roleName,
      kind: responsibility.kind,
    }]
  })
  return {
    ...createGraphNode('activity', nodeId, { x: instance.x + x, y: instance.y + y }),
    title: activity.title,
    summary: activity.summary,
    expectations: activity.expectations,
    responsibilities,
    roleTags: collectResponsibilityRoleTags(responsibilities),
    sharedActivityId: activity.id,
    processInstanceId: instance.id,
    sharedProcessPlacementId: placementId,
  }
}

function projectDecisionNode(
  decision: SharedProcessDecision,
  instance: ProcessInstance,
  library: SharedElementLibrary,
): GraphNode {
  const nodeId = instance.nodeIdsByDecision[decision.id] ?? `${instance.id}-decision-${decision.id}`
  return {
    ...createGraphNode('decision', nodeId, { x: instance.x + decision.x, y: instance.y + decision.y }),
    title: decision.title,
    criteria: decision.criteria,
    decisionOutcomes: decision.decisionOutcomes,
    owner: decision.ownerRoleId ? library.roles[decision.ownerRoleId]?.name ?? '' : '',
    ownerRoleId: decision.ownerRoleId,
    processInstanceId: instance.id,
    sharedProcessDecisionId: decision.id,
  }
}

function projectStageNode(
  stage: SharedProcessStage,
  instance: ProcessInstance,
  nodeIdsBySourceId: Record<string, string>,
  library: SharedElementLibrary,
): GraphNode {
  const nodeId = instance.stageNodeIdsByStage[stage.id] ?? `${instance.id}-stage-${stage.id}`
  return {
    ...createGraphNode('stage', nodeId, { x: instance.x + stage.x, y: instance.y + stage.y }),
    width: stage.width,
    height: stage.height,
    title: stage.title,
    summary: stage.description,
    goal: stage.goal,
    entryCondition: stage.entryCondition,
    exitCondition: stage.exitCondition,
    owner: stage.ownerRoleId ? library.roles[stage.ownerRoleId]?.name ?? '' : '',
    ownerRoleId: stage.ownerRoleId,
    memberNodeIds: stage.memberIds.flatMap((memberId) => nodeIdsBySourceId[memberId] ? [nodeIdsBySourceId[memberId]!] : []),
    processInstanceId: instance.id,
    sharedProcessStageId: stage.id,
    ports: [],
  }
}
