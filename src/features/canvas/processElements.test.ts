import { describe, expect, it } from 'vitest'
import {
  PROCESS_ELEMENTS,
  createGraphNode,
  createHandoffEdge,
  getPortsForNodeType,
} from './processElements'

describe('processElements', () => {
  const fourSidePorts = [
    { id: 'top', side: 'top' },
    { id: 'in', side: 'left' },
    { id: 'out', side: 'right' },
    { id: 'bottom', side: 'bottom' },
  ]

  it('defines Flowent process elements instead of generic diagram shapes', () => {
    expect(PROCESS_ELEMENTS.map((item) => item.type)).toEqual([
      'stage',
      'activity',
      'decision',
      'bottleneck',
      'end',
    ])
  })

  it('creates an activity node with role and expectation fields', () => {
    const node = createGraphNode('activity', 'activity-1', { x: 120, y: 240 })

    expect(node).toMatchObject({
      id: 'activity-1',
      type: 'activity',
      x: 120,
      y: 240,
      width: 220,
      height: 112,
      title: 'New activity',
      summary: '',
      roleTags: [],
      expectations: '',
    })
    expect(node.ports).toEqual(fourSidePorts)
  })

  it('creates stage and bottleneck nodes with process-specific fields', () => {
    const stage = createGraphNode('stage', 'stage-1', { x: 40, y: 80 })
    const bottleneck = createGraphNode('bottleneck', 'bottleneck-1', { x: 520, y: 140 })

    expect(stage).toMatchObject({
      type: 'stage',
      title: 'New stage',
      goal: '',
      entryCondition: '',
      exitCondition: '',
      owner: '',
    })
    expect(bottleneck).toMatchObject({
      type: 'bottleneck',
      title: 'Potential bottleneck',
      symptom: '',
      impact: '',
      suspectedCause: '',
      reviewStatus: 'unclear',
    })
  })

  it('creates a semantic handoff edge between process nodes', () => {
    const edge = createHandoffEdge('edge-1', 'source', 'out', 'target', 'in')

    expect(edge).toMatchObject({
      id: 'edge-1',
      sourceNodeId: 'source',
      sourcePortId: 'out',
      targetNodeId: 'target',
      targetPortId: 'in',
      label: '',
      kind: 'handoff',
      fromRole: '',
      toRole: '',
      artifact: '',
      expectation: '',
      readinessSignal: '',
      reviewStatus: 'unclear',
    })
  })

  it('returns stable ports for every node type', () => {
    expect(getPortsForNodeType('start')).toEqual(fourSidePorts)
    expect(getPortsForNodeType('end')).toEqual(fourSidePorts)
    expect(getPortsForNodeType('decision')).toEqual(fourSidePorts)
  })
})
