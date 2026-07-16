import { describe, expect, it } from 'vitest'
import { addEdge, addNode, createEmptyDocument } from './graphDocument'
import { createGraphNode, createHandoffEdge } from '../processElements'
import { deserializeGraphDocument, serializeGraphDocument } from './graphSerialization'

describe('graphSerialization', () => {
  it('serializes Maps and Sets to JSON-safe records and arrays', () => {
    let doc = createEmptyDocument('map-1')
    doc = addNode(doc, createGraphNode('activity', 'activity-1', { x: 120, y: 240 }))
    doc = addNode(doc, createGraphNode('decision', 'decision-1', { x: 420, y: 240 }))
    doc = addEdge(doc, createHandoffEdge('edge-1', 'activity-1', 'out', 'decision-1', 'in'))

    const serialized = serializeGraphDocument(doc)

    expect(serialized.nodes['activity-1']).toMatchObject({ type: 'activity' })
    expect(serialized.edges['edge-1']).toMatchObject({ kind: 'handoff' })
    expect(serialized.selectedNodeIds).toEqual([])
    expect(JSON.stringify(serialized)).toContain('activity-1')
  })

  it('deserializes records and arrays back into GraphDocument Maps and Sets', () => {
    const doc = deserializeGraphDocument({
      id: 'map-1',
      nodes: {
        start: createGraphNode('start', 'start', { x: 360, y: 200 }),
      },
      edges: {},
      selectedNodeIds: ['start'],
      selectedEdgeIds: [],
      viewport: { x: 0, y: 0, zoom: 1 },
      meta: { dirty: false, version: 1 },
    })

    expect(doc.nodes).toBeInstanceOf(Map)
    expect(doc.nodes.get('start')?.type).toBe('start')
    expect(doc.selectedNodeIds).toEqual(new Set(['start']))
  })

  it('adds empty process assets when deserializing an older document', () => {
    const doc = deserializeGraphDocument({
      id: 'legacy-map',
      nodes: {},
      edges: {},
      selectedNodeIds: [],
      selectedEdgeIds: [],
      viewport: { x: 0, y: 0, zoom: 1 },
      meta: { dirty: false, version: 1 },
    })

    expect(doc.processAssets).toEqual({
      workProducts: {},
      guidanceItems: {},
      milestones: {},
    })
  })

  it('migrates old Stages into empty no-port containers while retaining direct legacy edges', () => {
    const legacyStage = {
      ...createGraphNode('stage', 'stage-1', { x: 80, y: 80 }),
      ports: [{ id: 'out', side: 'right' as const }],
    }
    const activity = createGraphNode('activity', 'activity-1', { x: 420, y: 120 })
    const doc = deserializeGraphDocument({
      id: 'legacy-stage-map',
      nodes: { [legacyStage.id]: legacyStage, [activity.id]: activity },
      edges: {
        'legacy-edge': createHandoffEdge('legacy-edge', 'stage-1', 'out', 'activity-1', 'in'),
      },
      selectedNodeIds: [],
      selectedEdgeIds: [],
      viewport: { x: 0, y: 0, zoom: 1 },
      meta: { dirty: false, version: 1 },
    })

    expect(doc.nodes.get('stage-1')).toMatchObject({ memberNodeIds: [], ports: [] })
    expect(doc.edges.get('legacy-edge')?.legacyStageConnection).toBe(true)
  })

  it('persists process assets through serialization', () => {
    const doc = {
      ...createEmptyDocument('map-1'),
      processAssets: {
        workProducts: {
          'wp-1': {
            id: 'wp-1',
            title: 'Ready brief',
            state: 'Ready',
            description: '',
            producerNodeIds: ['activity-1'],
            consumerNodeIds: [],
            handoffEdgeIds: [],
            guidanceIds: [],
          },
        },
        guidanceItems: {},
        milestones: {},
      },
    }

    const serialized = serializeGraphDocument(doc)
    const hydrated = deserializeGraphDocument(serialized)

    expect(hydrated.processAssets.workProducts['wp-1']?.title).toBe('Ready brief')
    expect(hydrated.processAssets.workProducts['wp-1']?.activityLinks).toEqual([
      {
        id: 'wp-link-wp-1-activity-1-output-ready',
        nodeId: 'activity-1',
        relation: 'output',
        maturity: 'Ready',
      },
    ])
    expect(serialized.processAssets?.workProducts['wp-1']?.producerNodeIds).toEqual(['activity-1'])
  })

  it('preserves generated layout metadata and edge anchors through serialization', () => {
    let doc = createEmptyDocument('generated-map')
    doc = addNode(doc, createGraphNode('activity', 'activity-1', { x: 240, y: 160 }))
    doc = addNode(doc, createGraphNode('decision', 'decision-1', { x: 240, y: 360 }))
    doc = addEdge(doc, {
      ...createHandoffEdge('edge-1', 'activity-1', 'bottom', 'decision-1', 'top'),
      sourceAnchor: { side: 'bottom', offset: 0.5 },
      targetAnchor: { side: 'top', offset: 0.5 },
    })
    doc = {
      ...doc,
      meta: {
        dirty: true,
        version: 7,
        layoutProfile: 'generated-flow',
        layoutNodeOrder: ['activity-1', 'decision-1'],
      },
    }

    const serialized = serializeGraphDocument(doc)
    const hydrated = deserializeGraphDocument(serialized)

    expect(serialized.meta).toEqual({
      dirty: false,
      version: 7,
      layoutProfile: 'generated-flow',
      layoutNodeOrder: ['activity-1', 'decision-1'],
    })
    expect(hydrated.meta.layoutProfile).toBe('generated-flow')
    expect(hydrated.meta.layoutNodeOrder).toEqual(['activity-1', 'decision-1'])
    expect(hydrated.edges.get('edge-1')).toMatchObject({
      sourceAnchor: { side: 'bottom', offset: 0.5 },
      targetAnchor: { side: 'top', offset: 0.5 },
    })
  })

  it('preserves per-activity process intelligence and map analysis settings', () => {
    let doc = createEmptyDocument('measured-map')
    doc = addNode(doc, {
      ...createGraphNode('activity', 'review-brief', { x: 240, y: 160 }),
      processStage: {
        kind: 'wait',
        durationMinutesP50: 45,
        durationMinutesP90: 120,
        classificationSource: 'explicit',
      },
    })
    doc = {
      ...doc,
      meta: {
        ...doc.meta,
        processAnalysis: { profile: 'manufacturing', wip: 6 },
      },
    }

    const hydrated = deserializeGraphDocument(serializeGraphDocument(doc))

    expect(hydrated.nodes.get('review-brief')?.processStage).toEqual({
      kind: 'wait',
      durationMinutesP50: 45,
      durationMinutesP90: 120,
      classificationSource: 'explicit',
    })
    expect(hydrated.meta.processAnalysis).toEqual({ profile: 'manufacturing', wip: 6 })
  })
})
