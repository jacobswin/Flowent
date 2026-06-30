import { describe, expect, it } from 'vitest'
import { createGraphNode, createHandoffEdge } from './processElements'
import { addEdge, addNode, createEmptyDocument } from './engine/graphDocument'
import {
  EMPTY_PROCESS_ASSETS,
  addGuidanceAsset,
  addMilestoneAsset,
  addResponsibility,
  addWorkProductAsset,
  deleteGuidanceAsset,
  deleteMilestoneAsset,
  deleteWorkProductAsset,
  getProcessAssetUsage,
  getActivityResponsibilities,
  linkGuidanceToHandoff,
  linkGuidanceToActivity,
  linkGuidanceToWorkProduct,
  linkWorkProductToActivity,
  linkWorkProductToHandoff,
  removeMilestoneWorkProductState,
  renameGuidanceAsset,
  renameMilestoneAsset,
  renameWorkProductAsset,
  unlinkGuidanceFromHandoff,
  unlinkGuidanceFromActivity,
  unlinkGuidanceFromWorkProduct,
  unlinkWorkProductFromActivity,
  unlinkWorkProductFromHandoff,
  updateGuidanceAsset,
  updateMilestoneAsset,
  updateMilestoneWorkProductState,
  updateWorkProductAsset,
} from './processAssets'

describe('processAssets', () => {
  it('creates an empty process asset collection for legacy documents', () => {
    expect(EMPTY_PROCESS_ASSETS).toEqual({
      workProducts: {},
      guidanceItems: {},
      milestones: {},
    })
  })

  it('converts legacy role tags to responsible RASIC entries', () => {
    const activity = {
      ...createGraphNode('activity', 'activity-1', { x: 0, y: 0 }),
      roleTags: ['PM', 'Engineer'],
    }

    expect(getActivityResponsibilities(activity)).toEqual([
      { id: 'responsibility-activity-1-pm-responsible', roleName: 'PM', kind: 'responsible' },
      { id: 'responsibility-activity-1-engineer-responsible', roleName: 'Engineer', kind: 'responsible' },
    ])
  })

  it('adds RASIC responsibilities while keeping roleTags compatible', () => {
    const doc = addNode(createEmptyDocument('map-1'), createGraphNode('activity', 'activity-1', { x: 0, y: 0 }))

    const next = addResponsibility(doc, 'activity-1', {
      id: 'r1',
      roleName: 'QA',
      kind: 'accountable',
    })

    expect(next.nodes.get('activity-1')?.responsibilities).toEqual([
      { id: 'r1', roleName: 'QA', kind: 'accountable' },
    ])
    expect(next.nodes.get('activity-1')?.roleTags).toEqual(['QA'])
  })

  it('creates, renames, links, unlinks, and deletes work products', () => {
    const doc = addNode(createEmptyDocument('map-1'), createGraphNode('activity', 'activity-1', { x: 0, y: 0 }))
    const created = addWorkProductAsset(doc, {
      id: 'wp-1',
      title: 'Ready brief',
      state: 'Draft',
      description: 'Context for the delivery handoff',
    })
    const linked = linkWorkProductToActivity(created, 'wp-1', 'activity-1', 'output')
    const renamed = renameWorkProductAsset(linked, 'wp-1', 'Delivery-ready brief')
    const unlinked = unlinkWorkProductFromActivity(renamed, 'wp-1', 'activity-1', 'output')
    const deleted = deleteWorkProductAsset(unlinked, 'wp-1')

    expect(linked.processAssets.workProducts['wp-1']).toMatchObject({
      title: 'Ready brief',
      producerNodeIds: ['activity-1'],
      consumerNodeIds: [],
      handoffEdgeIds: [],
      guidanceIds: [],
    })
    expect(renamed.processAssets.workProducts['wp-1']?.title).toBe('Delivery-ready brief')
    expect(unlinked.processAssets.workProducts['wp-1']?.producerNodeIds).toEqual([])
    expect(deleted.processAssets.workProducts['wp-1']).toBeUndefined()
  })

  it('migrates legacy work product activity references into maturity links', () => {
    let doc = createEmptyDocument('map-1')
    doc = addNode(doc, createGraphNode('activity', 'a1', { x: 0, y: 0 }))
    doc = addNode(doc, createGraphNode('activity', 'a2', { x: 300, y: 0 }))
    doc = addNode(doc, createGraphNode('activity', 'a3', { x: 600, y: 0 }))
    doc = {
      ...doc,
      processAssets: {
        guidanceItems: {},
        milestones: {},
        workProducts: {
          'wp-1': {
            id: 'wp-1',
            title: 'Spec',
            state: 'Ready',
            description: '',
            producerNodeIds: ['a1'],
            consumerNodeIds: ['a2'],
            handoffEdgeIds: [],
            guidanceIds: [],
          },
        },
      },
    }

    const linked = linkWorkProductToActivity(doc, 'wp-1', 'a3', 'input', 'Draft')

    expect(linked.processAssets.workProducts['wp-1']?.activityLinks).toEqual(expect.arrayContaining([
      expect.objectContaining({ nodeId: 'a1', relation: 'output', maturity: 'Ready' }),
      expect.objectContaining({ nodeId: 'a2', relation: 'input', maturity: 'Ready' }),
      expect.objectContaining({ nodeId: 'a3', relation: 'input', maturity: 'Draft' }),
    ]))
  })

  it('allows the same work product through one activity when maturities differ', () => {
    let doc = addNode(createEmptyDocument('map-1'), createGraphNode('activity', 'activity-1', { x: 0, y: 0 }))
    doc = addWorkProductAsset(doc, {
      id: 'wp-1',
      title: 'Spec',
      state: 'Draft',
      description: '',
    })

    doc = linkWorkProductToActivity(doc, 'wp-1', 'activity-1', 'input', 'Draft')
    doc = linkWorkProductToActivity(doc, 'wp-1', 'activity-1', 'output', 'Approved')

    expect(doc.processAssets.workProducts['wp-1']).toMatchObject({
      producerNodeIds: ['activity-1'],
      consumerNodeIds: ['activity-1'],
    })
    expect(doc.processAssets.workProducts['wp-1']?.activityLinks).toEqual(expect.arrayContaining([
      expect.objectContaining({ nodeId: 'activity-1', relation: 'input', maturity: 'Draft' }),
      expect.objectContaining({ nodeId: 'activity-1', relation: 'output', maturity: 'Approved' }),
    ]))
  })

  it('rejects input and output links for the same work product, activity, and maturity', () => {
    let doc = addNode(createEmptyDocument('map-1'), createGraphNode('activity', 'activity-1', { x: 0, y: 0 }))
    doc = addWorkProductAsset(doc, {
      id: 'wp-1',
      title: 'Spec',
      state: 'Draft',
      description: '',
    })

    doc = linkWorkProductToActivity(doc, 'wp-1', 'activity-1', 'input', 'Draft')
    const rejected = linkWorkProductToActivity(doc, 'wp-1', 'activity-1', 'output', 'Draft')

    expect(rejected).toBe(doc)
    expect(rejected.processAssets.workProducts['wp-1']?.producerNodeIds).toEqual([])
    expect(rejected.processAssets.workProducts['wp-1']?.activityLinks).toEqual([
      expect.objectContaining({ nodeId: 'activity-1', relation: 'input', maturity: 'Draft' }),
    ])
  })

  it('unlinks one maturity without removing other links for that activity', () => {
    let doc = addNode(createEmptyDocument('map-1'), createGraphNode('activity', 'activity-1', { x: 0, y: 0 }))
    doc = addWorkProductAsset(doc, {
      id: 'wp-1',
      title: 'Spec',
      state: 'Draft',
      description: '',
    })
    doc = linkWorkProductToActivity(doc, 'wp-1', 'activity-1', 'input', 'Draft')
    doc = linkWorkProductToActivity(doc, 'wp-1', 'activity-1', 'input', 'Review ready')

    const next = unlinkWorkProductFromActivity(doc, 'wp-1', 'activity-1', 'input', 'Draft')

    expect(next.processAssets.workProducts['wp-1']?.activityLinks).toEqual([
      expect.objectContaining({ nodeId: 'activity-1', relation: 'input', maturity: 'Review ready' }),
    ])
    expect(next.processAssets.workProducts['wp-1']?.consumerNodeIds).toEqual(['activity-1'])
  })

  it('links work products to handoffs', () => {
    let doc = createEmptyDocument('map-1')
    doc = addNode(doc, createGraphNode('activity', 'a1', { x: 0, y: 0 }))
    doc = addNode(doc, createGraphNode('activity', 'a2', { x: 300, y: 0 }))
    doc = addEdge(doc, createHandoffEdge('edge-1', 'a1', 'out', 'a2', 'in'))
    doc = addWorkProductAsset(doc, { id: 'wp-1', title: 'Spec', state: 'Ready', description: '' })

    const next = linkWorkProductToHandoff(doc, 'wp-1', 'edge-1')

    expect(next.processAssets.workProducts['wp-1']?.handoffEdgeIds).toEqual(['edge-1'])
    expect(next.edges.get('edge-1')?.workProductIds).toEqual(['wp-1'])
  })

  it('updates work products and unlinks them from handoffs in both directions', () => {
    let doc = createEmptyDocument('map-1')
    doc = addNode(doc, createGraphNode('activity', 'a1', { x: 0, y: 0 }))
    doc = addNode(doc, createGraphNode('activity', 'a2', { x: 300, y: 0 }))
    doc = addEdge(doc, createHandoffEdge('edge-1', 'a1', 'out', 'a2', 'in'))
    doc = addWorkProductAsset(doc, { id: 'wp-1', title: 'Spec', state: 'Draft', description: '' })
    doc = linkWorkProductToHandoff(doc, 'wp-1', 'edge-1')
    doc = updateWorkProductAsset(doc, 'wp-1', {
      title: 'Approved spec',
      state: 'Approved',
      description: 'Ready for delivery',
    })
    doc = unlinkWorkProductFromHandoff(doc, 'wp-1', 'edge-1')

    expect(doc.processAssets.workProducts['wp-1']).toMatchObject({
      title: 'Approved spec',
      state: 'Approved',
      description: 'Ready for delivery',
      handoffEdgeIds: [],
    })
    expect(doc.edges.get('edge-1')?.workProductIds).toEqual([])
  })

  it('creates, renames, links, unlinks, and deletes guidance items', () => {
    let doc = addNode(createEmptyDocument('map-1'), createGraphNode('activity', 'activity-1', { x: 0, y: 0 }))
    doc = addGuidanceAsset(doc, {
      id: 'guide-1',
      title: 'Review checklist',
      kind: 'checklist',
      description: 'Questions to ask before handoff',
      url: '',
    })
    doc = linkGuidanceToActivity(doc, 'guide-1', 'activity-1')
    doc = renameGuidanceAsset(doc, 'guide-1', 'Definition of ready checklist')

    expect(doc.processAssets.guidanceItems['guide-1']).toMatchObject({
      title: 'Definition of ready checklist',
      appliesToNodeIds: ['activity-1'],
      appliesToEdgeIds: [],
      workProductIds: [],
    })

    doc = unlinkGuidanceFromActivity(doc, 'guide-1', 'activity-1')
    expect(doc.processAssets.guidanceItems['guide-1']?.appliesToNodeIds).toEqual([])

    doc = deleteGuidanceAsset(doc, 'guide-1')
    expect(doc.processAssets.guidanceItems['guide-1']).toBeUndefined()
  })

  it('updates guidance and links it to handoffs and work products with mirrored references', () => {
    let doc = createEmptyDocument('map-1')
    doc = addNode(doc, createGraphNode('activity', 'a1', { x: 0, y: 0 }))
    doc = addNode(doc, createGraphNode('activity', 'a2', { x: 300, y: 0 }))
    doc = addEdge(doc, createHandoffEdge('edge-1', 'a1', 'out', 'a2', 'in'))
    doc = addWorkProductAsset(doc, { id: 'wp-1', title: 'Research brief', state: 'Draft', description: '' })
    doc = addGuidanceAsset(doc, {
      id: 'guide-1',
      title: 'Checklist',
      kind: 'checklist',
      description: '',
      url: '',
    })
    doc = updateGuidanceAsset(doc, 'guide-1', {
      title: 'Interview checklist',
      kind: 'template',
      description: 'Use before research handoff',
      url: 'https://example.test/checklist',
    })
    doc = linkGuidanceToHandoff(doc, 'guide-1', 'edge-1')
    doc = linkGuidanceToWorkProduct(doc, 'guide-1', 'wp-1')

    expect(doc.processAssets.guidanceItems['guide-1']).toMatchObject({
      title: 'Interview checklist',
      kind: 'template',
      description: 'Use before research handoff',
      url: 'https://example.test/checklist',
      appliesToEdgeIds: ['edge-1'],
      workProductIds: ['wp-1'],
    })
    expect(doc.processAssets.workProducts['wp-1']?.guidanceIds).toEqual(['guide-1'])

    doc = unlinkGuidanceFromHandoff(doc, 'guide-1', 'edge-1')
    doc = unlinkGuidanceFromWorkProduct(doc, 'guide-1', 'wp-1')

    expect(doc.processAssets.guidanceItems['guide-1']?.appliesToEdgeIds).toEqual([])
    expect(doc.processAssets.guidanceItems['guide-1']?.workProductIds).toEqual([])
    expect(doc.processAssets.workProducts['wp-1']?.guidanceIds).toEqual([])
  })

  it('creates, renames, and deletes milestones linked to stages and work product states', () => {
    let doc = createEmptyDocument('map-1')
    doc = addNode(doc, createGraphNode('stage', 'stage-1', { x: 0, y: 0 }))
    doc = addWorkProductAsset(doc, { id: 'wp-1', title: 'Validation report', state: 'Approved', description: '' })
    doc = addMilestoneAsset(doc, {
      id: 'ms-1',
      title: 'Discovery exit',
      description: 'Evidence is reviewed',
      stageNodeId: 'stage-1',
      workProductStates: [{ workProductId: 'wp-1', state: 'Approved' }],
    })
    doc = renameMilestoneAsset(doc, 'ms-1', 'Discovery complete')

    expect(doc.processAssets.milestones['ms-1']).toMatchObject({
      title: 'Discovery complete',
      stageNodeId: 'stage-1',
      workProductStates: [{ workProductId: 'wp-1', state: 'Approved' }],
    })

    doc = deleteMilestoneAsset(doc, 'ms-1')
    expect(doc.processAssets.milestones['ms-1']).toBeUndefined()
  })

  it('updates milestone fields and edits or removes work product states', () => {
    let doc = createEmptyDocument('map-1')
    doc = addNode(doc, createGraphNode('stage', 'stage-1', { x: 0, y: 0 }))
    doc = addNode(doc, createGraphNode('stage', 'stage-2', { x: 300, y: 0 }))
    doc = addWorkProductAsset(doc, { id: 'wp-1', title: 'Validation report', state: 'Draft', description: '' })
    doc = addMilestoneAsset(doc, {
      id: 'ms-1',
      title: 'Discovery exit',
      description: '',
      stageNodeId: 'stage-1',
      workProductStates: [{ workProductId: 'wp-1', state: 'Draft' }],
    })

    doc = updateMilestoneAsset(doc, 'ms-1', {
      title: 'Discovery complete',
      description: 'Decision evidence is reviewed',
      stageNodeId: 'stage-2',
    })
    doc = updateMilestoneWorkProductState(doc, 'ms-1', 'wp-1', 'Approved')

    expect(doc.processAssets.milestones['ms-1']).toMatchObject({
      title: 'Discovery complete',
      description: 'Decision evidence is reviewed',
      stageNodeId: 'stage-2',
      workProductStates: [{ workProductId: 'wp-1', state: 'Approved' }],
    })

    doc = removeMilestoneWorkProductState(doc, 'ms-1', 'wp-1')
    expect(doc.processAssets.milestones['ms-1']?.workProductStates).toEqual([])
  })

  it('reports process asset usage and cleans every reverse reference when deleting assets', () => {
    let doc = createEmptyDocument('map-1')
    doc = addNode(doc, createGraphNode('activity', 'a1', { x: 0, y: 0 }))
    doc = addNode(doc, createGraphNode('activity', 'a2', { x: 300, y: 0 }))
    doc = addEdge(doc, createHandoffEdge('edge-1', 'a1', 'out', 'a2', 'in'))
    doc = addWorkProductAsset(doc, { id: 'wp-1', title: 'Spec', state: 'Draft', description: '' })
    doc = addGuidanceAsset(doc, { id: 'guide-1', title: 'Checklist', kind: 'checklist', description: '', url: '' })
    doc = addMilestoneAsset(doc, {
      id: 'ms-1',
      title: 'Exit',
      description: '',
      stageNodeId: null,
      workProductStates: [{ workProductId: 'wp-1', state: 'Approved' }],
    })
    doc = linkWorkProductToActivity(doc, 'wp-1', 'a1', 'output')
    doc = linkWorkProductToActivity(doc, 'wp-1', 'a2', 'input')
    doc = linkWorkProductToHandoff(doc, 'wp-1', 'edge-1')
    doc = linkGuidanceToActivity(doc, 'guide-1', 'a1')
    doc = linkGuidanceToHandoff(doc, 'guide-1', 'edge-1')
    doc = linkGuidanceToWorkProduct(doc, 'guide-1', 'wp-1')

    expect(getProcessAssetUsage(doc, 'workProduct', 'wp-1').total).toBe(5)
    expect(getProcessAssetUsage(doc, 'guidance', 'guide-1').total).toBe(3)

    doc = deleteGuidanceAsset(doc, 'guide-1')
    expect(doc.processAssets.workProducts['wp-1']?.guidanceIds).toEqual([])

    doc = deleteWorkProductAsset(doc, 'wp-1')
    expect(doc.edges.get('edge-1')?.workProductIds).toEqual([])
    expect(doc.processAssets.milestones['ms-1']?.workProductStates).toEqual([])
  })
})
