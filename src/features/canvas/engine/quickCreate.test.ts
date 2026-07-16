import { describe, expect, it } from 'vitest'
import { createEmptyDocument, addNode } from './graphDocument'
import { createGraphNode } from '../processElements'
import { getPortPosition } from '../render/drawEdges'
import { planConnectedNodeFromPort, planQuickCreate } from './quickCreate'

describe('planQuickCreate', () => {
  it('places a new node to the right of the selected source and creates a handoff edge', () => {
    const source = createGraphNode('activity', 'activity-1', { x: 100, y: 200 })
    const doc = addNode(createEmptyDocument('doc'), source)

    const plan = planQuickCreate(doc, {
      sourceNodeId: 'activity-1',
      targetType: 'decision',
      newNodeId: 'decision-1',
      newEdgeId: 'edge-1',
      fallbackPosition: { x: 500, y: 500 },
    })

    expect(plan.node.type).toBe('decision')
    expect(plan.node.x).toBe(source.x + source.width + 180)
    expect(plan.node.y).toBe(source.y)
    expect(plan.edge).toMatchObject({
      id: 'edge-1',
      sourceNodeId: 'activity-1',
      sourcePortId: 'out',
      targetNodeId: 'decision-1',
      targetPortId: 'in',
      kind: 'handoff',
    })
  })

  it('creates only a node when there is no selected source', () => {
    const doc = createEmptyDocument('doc')

    const plan = planQuickCreate(doc, {
      sourceNodeId: null,
      targetType: 'activity',
      newNodeId: 'activity-1',
      newEdgeId: 'edge-1',
      fallbackPosition: { x: 320, y: 180 },
    })

    expect(plan.node).toMatchObject({ id: 'activity-1', x: 320, y: 180 })
    expect(plan.edge).toBeNull()
  })

  it('creates only a node when the selected source is missing from the document', () => {
    const doc = createEmptyDocument('doc')

    const plan = planQuickCreate(doc, {
      sourceNodeId: 'missing',
      targetType: 'bottleneck',
      newNodeId: 'bottleneck-1',
      newEdgeId: 'edge-1',
      fallbackPosition: { x: 320, y: 180 },
    })

    expect(plan.node.type).toBe('bottleneck')
    expect(plan.edge).toBeNull()
  })

  it('creates a connected node with its input port aligned to the drop point', () => {
    const source = createGraphNode('activity', 'activity-1', { x: 100, y: 200 })
    const doc = addNode(createEmptyDocument('doc'), source)
    const dropPoint = { x: 640, y: 260 }

    const plan = planConnectedNodeFromPort(doc, {
      sourceNodeId: 'activity-1',
      sourcePortId: 'out',
      targetType: 'decision',
      newNodeId: 'decision-1',
      newEdgeId: 'edge-1',
      dropPosition: dropPoint,
    })

    expect(plan.node.type).toBe('decision')
    expect(getPortPosition(plan.node, 'in')).toEqual({ ...dropPoint, side: 'left' })
    expect(plan.edge).toMatchObject({
      id: 'edge-1',
      sourceNodeId: 'activity-1',
      sourcePortId: 'out',
      targetNodeId: 'decision-1',
      targetPortId: 'in',
      kind: 'handoff',
    })
  })
})
