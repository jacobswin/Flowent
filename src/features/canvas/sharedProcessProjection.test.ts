import { describe, expect, it } from 'vitest'
import { createEmptyDocument } from './engine/graphDocument'
import { createEmptySharedElementLibrary, type SharedElementLibrary } from './sharedElements'
import { insertSharedProcessInstance, syncSharedProcessInstances } from './sharedProcessProjection'

function makeLibrary(): SharedElementLibrary {
  return {
    ...createEmptySharedElementLibrary(),
    roles: { 'role-dre': { id: 'role-dre', name: 'DRE', description: '' } },
    workProducts: { 'wp-report': { id: 'wp-report', title: 'Review report', state: 'Draft', description: '' } },
    activities: {
      'activity-review': {
        id: 'activity-review',
        title: 'Review DVP report',
        summary: 'Review the submitted report.',
        expectations: '',
        responsibilities: [{ id: 'r1', roleId: 'role-dre', kind: 'responsible' }],
        workProductLinks: [{ id: 'wp-link', workProductId: 'wp-report', relation: 'output', maturity: 'Draft' }],
      },
      'activity-close': {
        id: 'activity-close', title: 'Close review', summary: '', expectations: '', responsibilities: [], workProductLinks: [],
      },
    },
    processes: {
      'process-review': {
        id: 'process-review', title: 'DVP review', description: '',
        activities: [
          { id: 'p1', activityId: 'activity-review', x: 0, y: 0 },
          { id: 'p2', activityId: 'activity-close', x: 300, y: 0 },
        ],
        decisions: [],
        stages: [],
        handoffs: [{ id: 'h1', sourcePlacementId: 'p1', targetPlacementId: 'p2', label: 'review complete' }],
      },
    },
  }
}

describe('shared Process projection', () => {
  it('projects reusable activities, roles, work products, and handoffs into a map instance', () => {
    const library = makeLibrary()
    const document = insertSharedProcessInstance(
      createEmptyDocument('map-1'),
      library.processes['process-review']!,
      'instance-1',
      { x: 100, y: 200 },
      library,
    )

    expect(document.processInstances['instance-1']).toBeDefined()
    const reviewNode = Array.from(document.nodes.values()).find((node) => node.sharedActivityId === 'activity-review')
    expect(reviewNode).toEqual(expect.objectContaining({ title: 'Review DVP report', x: 100, y: 200, roleTags: ['DRE'] }))
    expect(document.edges.size).toBe(1)
    expect(document.processAssets.workProducts['shared-work-product-wp-report']).toEqual(expect.objectContaining({
      sharedWorkProductId: 'wp-report',
      title: 'Review report',
    }))
  })

  it('refreshes all projected nodes when the source Activity changes and removes deleted Processes', () => {
    const library = makeLibrary()
    const inserted = insertSharedProcessInstance(createEmptyDocument('map-1'), library.processes['process-review']!, 'instance-1', { x: 0, y: 0 }, library)
    const renamed = {
      ...library,
      activities: { ...library.activities, 'activity-review': { ...library.activities['activity-review']!, title: 'Approve DVP report' } },
    }
    const refreshed = syncSharedProcessInstances(inserted, renamed)
    expect(Array.from(refreshed.nodes.values()).some((node) => node.title === 'Approve DVP report')).toBe(true)

    const removed = syncSharedProcessInstances(refreshed, { ...renamed, processes: {} })
    expect(removed.processInstances).toEqual({})
    expect(removed.nodes.size).toBe(0)
    expect(removed.edges.size).toBe(0)
  })

  it('projects shared Stage containers and Process-internal Decisions with stable ids', () => {
    const base = makeLibrary()
    const library = {
      ...base,
      processes: {
        'process-review': {
          ...base.processes['process-review']!,
          decisions: [
            {
              id: 'decision-approve',
              title: 'Approval complete?',
              criteria: 'All review findings resolved.',
              ownerRoleId: 'role-dre',
              decisionOutcomes: ['Yes', 'No'],
              x: 300,
              y: 0,
            },
          ],
          stages: [
            {
              id: 'stage-review',
              title: 'Review',
              description: '',
              goal: 'Complete technical review.',
              entryCondition: 'Report submitted.',
              exitCondition: 'Decision recorded.',
              ownerRoleId: 'role-dre',
              x: -32,
              y: -72,
              width: 620,
              height: 260,
              memberIds: ['p1', 'decision-approve'],
              milestones: [],
            },
          ],
        },
      },
    } as unknown as SharedElementLibrary

    const document = insertSharedProcessInstance(
      createEmptyDocument('map-1'),
      library.processes['process-review']!,
      'instance-1',
      { x: 100, y: 200 },
      library,
    )

    const instance = document.processInstances['instance-1']!
    const stageId = instance.stageNodeIdsByStage['stage-review']
    expect(stageId).toBe('instance-1-stage-stage-review')
    expect(document.nodes.get(stageId)).toMatchObject({
      type: 'stage',
      title: 'Review',
      memberNodeIds: [instance.nodeIdsByPlacement.p1, 'instance-1-decision-decision-approve'],
      ports: [],
    })
    expect(document.nodes.get('instance-1-decision-decision-approve')).toMatchObject({
      type: 'decision',
      title: 'Approval complete?',
      owner: 'DRE',
      processInstanceId: 'instance-1',
    })
  })
})
