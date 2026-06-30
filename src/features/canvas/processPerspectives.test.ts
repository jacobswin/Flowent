import { describe, expect, it } from 'vitest'
import { addEdge, addNode, createEmptyDocument } from './engine/graphDocument'
import { createGraphNode, createHandoffEdge } from './processElements'
import {
  addGuidanceAsset,
  addMilestoneAsset,
  addResponsibility,
  addWorkProductAsset,
  deriveProcessPerspectives,
  linkGuidanceToActivity,
  linkWorkProductToActivity,
  linkWorkProductToHandoff,
} from './processAssets'

describe('deriveProcessPerspectives', () => {
  it('derives What, Who, When, and How views from one graph document', () => {
    let doc = createEmptyDocument('map-1')
    doc = addNode(doc, { ...createGraphNode('stage', 'stage-1', { x: 0, y: 0 }), title: 'Discovery' })
    doc = addNode(doc, { ...createGraphNode('activity', 'a1', { x: 280, y: 0 }), title: 'Validate problem' })
    doc = addNode(doc, { ...createGraphNode('activity', 'a2', { x: 560, y: 0 }), title: 'Handoff to engineering' })
    doc = addEdge(doc, createHandoffEdge('edge-1', 'a1', 'out', 'a2', 'in'))
    doc = addResponsibility(doc, 'a1', { id: 'r1', roleName: 'PM', kind: 'responsible' })
    doc = addResponsibility(doc, 'a1', { id: 'r2', roleName: 'Designer', kind: 'consulted' })
    doc = addWorkProductAsset(doc, { id: 'wp-1', title: 'Research brief', state: 'Ready', description: '' })
    doc = linkWorkProductToActivity(doc, 'wp-1', 'a1', 'output')
    doc = linkWorkProductToActivity(doc, 'wp-1', 'a2', 'input')
    doc = linkWorkProductToHandoff(doc, 'wp-1', 'edge-1')
    doc = addGuidanceAsset(doc, { id: 'guide-1', title: 'Interview checklist', kind: 'checklist', description: '', url: '' })
    doc = linkGuidanceToActivity(doc, 'guide-1', 'a1')
    doc = addMilestoneAsset(doc, {
      id: 'ms-1',
      title: 'Problem validated',
      description: '',
      stageNodeId: 'stage-1',
      workProductStates: [{ workProductId: 'wp-1', state: 'Ready' }],
    })

    const perspectives = deriveProcessPerspectives(doc)

    expect(perspectives.what.workProducts[0]).toMatchObject({
      title: 'Research brief',
      producedBy: ['Validate problem'],
      consumedBy: ['Handoff to engineering'],
      movedBy: ['Validate problem -> Handoff to engineering'],
    })
    expect(perspectives.who.roles).toContainEqual({
      roleName: 'PM',
      activities: [{ activityTitle: 'Validate problem', kind: 'responsible' }],
    })
    expect(perspectives.when.milestones).toContainEqual({
      title: 'Problem validated',
      stageTitle: 'Discovery',
      workProductStates: ['Research brief: Ready'],
    })
    expect(perspectives.how.guidance[0]).toMatchObject({
      title: 'Interview checklist',
      kind: 'checklist',
      appliesTo: ['Validate problem'],
    })
  })

  it('shows work product maturity flow through an activity', () => {
    let doc = createEmptyDocument('map-1')
    doc = addNode(doc, { ...createGraphNode('activity', 'a1', { x: 0, y: 0 }), title: 'Approve brief' })
    doc = addWorkProductAsset(doc, { id: 'wp-1', title: 'Research brief', state: 'Draft', description: '' })
    doc = linkWorkProductToActivity(doc, 'wp-1', 'a1', 'input', 'Draft')
    doc = linkWorkProductToActivity(doc, 'wp-1', 'a1', 'output', 'Approved')

    const perspectives = deriveProcessPerspectives(doc)

    expect(perspectives.what.workProducts[0]).toMatchObject({
      title: 'Research brief',
      producedBy: ['Approve brief'],
      consumedBy: ['Approve brief'],
      maturityFlows: ['Approve brief: Draft -> Approved'],
    })
  })
})
