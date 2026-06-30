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
})
