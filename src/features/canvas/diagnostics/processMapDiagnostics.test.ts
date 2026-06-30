import { describe, expect, it } from 'vitest'
import { createEmptyDocument, addEdge, addNode } from '../engine/graphDocument'
import { createGraphNode, createHandoffEdge } from '../processElements'
import { getProcessMapDiagnostics } from './processMapDiagnostics'
import { addGuidanceAsset, addMilestoneAsset, addResponsibility, addWorkProductAsset } from '../processAssets'

describe('getProcessMapDiagnostics', () => {
  it('flags activities without responsible roles', () => {
    let doc = createEmptyDocument('doc')
    doc = addNode(doc, createGraphNode('activity', 'activity-1', { x: 0, y: 0 }))

    const diagnostics = getProcessMapDiagnostics(doc)

    expect(diagnostics).toContainEqual(expect.objectContaining({
      targetType: 'node',
      targetId: 'activity-1',
      severity: 'warning',
      title: 'Activity needs responsible roles',
    }))
  })

  it('flags handoffs without expectations', () => {
    let doc = createEmptyDocument('doc')
    doc = addNode(doc, createGraphNode('activity', 'a', { x: 0, y: 0 }))
    doc = addNode(doc, createGraphNode('activity', 'b', { x: 300, y: 0 }))
    doc = addEdge(doc, createHandoffEdge('edge-1', 'a', 'out', 'b', 'in'))

    const diagnostics = getProcessMapDiagnostics(doc)

    expect(diagnostics).toContainEqual(expect.objectContaining({
      targetType: 'edge',
      targetId: 'edge-1',
      title: 'Handoff expectation is missing',
    }))
  })

  it('does not flag a complete activity and handoff', () => {
    let doc = createEmptyDocument('doc')
    const a = {
      ...createGraphNode('activity', 'a', { x: 0, y: 0 }),
      roleTags: ['PM'],
      expectations: 'Problem, owner, and next step are clear.',
    }
    const b = {
      ...createGraphNode('activity', 'b', { x: 300, y: 0 }),
      roleTags: ['Engineer'],
      expectations: 'Implementation can start without another clarification loop.',
    }
    doc = addNode(addNode(doc, a), b)
    doc = addEdge(doc, {
      ...createHandoffEdge('edge-1', 'a', 'out', 'b', 'in'),
      expectation: 'Ready work includes context and owner.',
    })

    const diagnostics = getProcessMapDiagnostics(doc)

    expect(diagnostics.find((item) => item.targetId === 'a')).toBeUndefined()
    expect(diagnostics.find((item) => item.targetId === 'edge-1')).toBeUndefined()
  })

  it('warns when an activity lacks responsible or accountable RASIC ownership', () => {
    const doc = addNode(createEmptyDocument('doc'), {
      ...createGraphNode('activity', 'activity-1', { x: 0, y: 0 }),
      roleTags: ['Designer'],
      responsibilities: [{ id: 'r1', roleName: 'Designer', kind: 'consulted' }],
    })

    expect(getProcessMapDiagnostics(doc)).toContainEqual(expect.objectContaining({
      targetType: 'node',
      targetId: 'activity-1',
      title: 'Activity needs a responsible or accountable role',
      severity: 'warning',
    }))
  })

  it('does not warn about RASIC ownership when responsible is present', () => {
    let doc = addNode(createEmptyDocument('doc'), createGraphNode('activity', 'activity-1', { x: 0, y: 0 }))
    doc = addResponsibility(doc, 'activity-1', { id: 'r1', roleName: 'PM', kind: 'responsible' })

    expect(getProcessMapDiagnostics(doc).some((diagnostic) => diagnostic.title === 'Activity needs a responsible or accountable role')).toBe(false)
  })

  it('reports unanchored work products, guidance, and milestones', () => {
    let doc = createEmptyDocument('doc')
    doc = addWorkProductAsset(doc, { id: 'wp-1', title: 'Spec', state: 'Draft', description: '' })
    doc = addGuidanceAsset(doc, { id: 'guide-1', title: 'Checklist', kind: 'checklist', description: '', url: '' })
    doc = addMilestoneAsset(doc, {
      id: 'ms-1',
      title: 'Exit',
      description: '',
      stageNodeId: null,
      workProductStates: [],
    })

    expect(getProcessMapDiagnostics(doc)).toEqual(expect.arrayContaining([
      expect.objectContaining({
        targetType: 'asset',
        targetId: 'wp-1',
        title: 'Work product is not connected to the process',
        severity: 'warning',
      }),
      expect.objectContaining({
        targetType: 'asset',
        targetId: 'guide-1',
        title: 'Guidance is not linked to process work',
        severity: 'info',
      }),
      expect.objectContaining({
        targetType: 'asset',
        targetId: 'ms-1',
        title: 'Milestone needs timing evidence',
        severity: 'info',
      }),
    ]))
  })

  it('warns when one work product is input and output at the same activity maturity', () => {
    let doc = createEmptyDocument('doc')
    doc = addNode(doc, createGraphNode('activity', 'activity-1', { x: 0, y: 0 }))
    doc = addWorkProductAsset(doc, { id: 'wp-1', title: 'Spec', state: 'Draft', description: '' })
    doc = {
      ...doc,
      processAssets: {
        ...doc.processAssets,
        workProducts: {
          ...doc.processAssets.workProducts,
          'wp-1': {
            ...doc.processAssets.workProducts['wp-1'],
            activityLinks: [
              { id: 'input-draft', nodeId: 'activity-1', relation: 'input', maturity: 'Draft' },
              { id: 'output-draft', nodeId: 'activity-1', relation: 'output', maturity: 'Draft' },
            ],
            consumerNodeIds: ['activity-1'],
            producerNodeIds: ['activity-1'],
          },
        },
      },
    }

    expect(getProcessMapDiagnostics(doc)).toContainEqual(expect.objectContaining({
      targetType: 'asset',
      targetId: 'wp-1',
      title: 'Work product has conflicting maturity links',
      severity: 'warning',
    }))
  })
})
