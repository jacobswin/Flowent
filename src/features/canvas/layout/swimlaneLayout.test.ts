import { describe, expect, it } from 'vitest'
import type { GraphDocument } from '../canvasTypes'
import { createEmptyDocument } from '../engine/graphDocument'
import { createGraphNode, createHandoffEdge } from '../processElements'
import { deriveSwimlaneRows, layoutSwimlaneGraph, SWIMLANE_LANES } from './swimlaneLayout'

function makeDocument(): GraphDocument {
  let doc = createEmptyDocument('swimlane-map')
  const activityOne = {
    ...createGraphNode('activity', 'a1', { x: 0, y: 0 }),
    title: 'Prepare deviation report',
    responsibilities: [{ id: 'r1', roleName: 'DRE', kind: 'responsible' as const }],
    roleTags: ['DRE'],
  }
  const activityTwo = {
    ...createGraphNode('activity', 'a2', { x: 0, y: 0 }),
    title: 'Review and archive',
    responsibilities: [{ id: 'r2', roleName: 'SVE', kind: 'responsible' as const }],
    roleTags: ['SVE'],
  }

  doc = {
    ...doc,
    nodes: new Map([
      ['start', createGraphNode('start', 'start', { x: 0, y: 0 })],
      ['a1', activityOne],
      ['a2', activityTwo],
      ['end', createGraphNode('end', 'end', { x: 0, y: 0 })],
    ]),
    edges: new Map([
      ['start-a1', createHandoffEdge('start-a1', 'start', 'out', 'a1', 'in')],
      ['a1-a2', createHandoffEdge('a1-a2', 'a1', 'out', 'a2', 'in')],
      ['a2-end', createHandoffEdge('a2-end', 'a2', 'out', 'end', 'in')],
    ]),
    processAssets: {
      guidanceItems: {},
      milestones: {},
      workProducts: {
        'wp-input': {
          id: 'wp-input',
          title: 'Deviation record',
          state: 'Draft',
          description: '',
          producerNodeIds: [],
          consumerNodeIds: ['a1'],
          handoffEdgeIds: [],
          guidanceIds: [],
          activityLinks: [{ id: 'link-input', nodeId: 'a1', relation: 'input', maturity: 'Draft' }],
        },
        'wp-output': {
          id: 'wp-output',
          title: 'Reviewed report',
          state: 'Approved',
          description: '',
          producerNodeIds: ['a2'],
          consumerNodeIds: [],
          handoffEdgeIds: [],
          guidanceIds: [],
          activityLinks: [{ id: 'link-output', nodeId: 'a2', relation: 'output', maturity: 'Approved' }],
        },
      },
    },
    meta: { dirty: false, version: 1, layoutNodeOrder: ['a1', 'a2'] },
  }
  return doc
}

describe('layoutSwimlaneGraph', () => {
  it('places activities in vertical rows with Role, Input, Activity, Output lanes', () => {
    const result = layoutSwimlaneGraph(makeDocument())
    const rows = deriveSwimlaneRows(result)
    const first = rows[0]
    const second = rows[1]

    expect(result.meta.layoutProfile).toBe('swimlane')
    expect(first.activityNodeId).toBe('a1')
    expect(second.activityNodeId).toBe('a2')
    expect(first.lanes.role.x).toBeLessThan(first.lanes.input.x)
    expect(first.lanes.input.x).toBeLessThan(first.lanes.activity.x)
    expect(first.lanes.activity.x).toBeLessThan(first.lanes.output.x)
    expect(result.nodes.get('a1')?.x).toBe(
      first.lanes.activity.x + (first.lanes.activity.width - result.nodes.get('a1')!.width) / 2,
    )
    expect(result.nodes.get('a2')?.y).toBeGreaterThan(result.nodes.get('a1')!.y)
    expect(first.roleCards).toEqual([expect.objectContaining({ label: 'DRE' })])
    expect(first.inputCards).toEqual([expect.objectContaining({ label: 'Deviation record · Draft' })])
    expect(second.outputCards).toEqual([expect.objectContaining({ label: 'Reviewed report · Approved' })])
  })

  it('uses top-to-bottom anchors for the activity mainline in swimlane view', () => {
    const result = layoutSwimlaneGraph(makeDocument())

    expect(result.edges.get('a1-a2')).toMatchObject({
      sourcePortId: 'bottom',
      targetPortId: 'top',
      sourceAnchor: { side: 'bottom', offset: 0.5 },
      targetAnchor: { side: 'top', offset: 0.5 },
    })
  })

  it('uses one continuous four-column surface and keeps terminals close to the activity path', () => {
    const result = layoutSwimlaneGraph(makeDocument())
    const lanes = Object.values(SWIMLANE_LANES)
    const firstActivity = result.nodes.get('a1')!
    const lastActivity = result.nodes.get('a2')!
    const start = result.nodes.get('start')!
    const end = result.nodes.get('end')!

    expect(lanes[1].x).toBe(lanes[0].x + lanes[0].width)
    expect(lanes[2].x).toBe(lanes[1].x + lanes[1].width)
    expect(lanes[3].x).toBe(lanes[2].x + lanes[2].width)
    expect(start.x + start.width / 2).toBeCloseTo(firstActivity.x + firstActivity.width / 2, 0)
    expect(start.y).toBe(firstActivity.y - start.height - 18)
    expect(end.y).toBe(lastActivity.y + lastActivity.height + 18)
  })

  it('places a user-added End terminal by node type instead of assuming the reserved end id', () => {
    const document = makeDocument()
    const customEnd = {
      ...document.nodes.get('end')!,
      id: 'end-1730000000000',
      x: 1640,
      y: 40,
    }
    const nodes = new Map(document.nodes)
    nodes.delete('end')
    nodes.set(customEnd.id, customEnd)
    const edges = new Map(document.edges)
    const finalEdge = edges.get('a2-end')!
    edges.set(finalEdge.id, { ...finalEdge, targetNodeId: customEnd.id })

    const result = layoutSwimlaneGraph({ ...document, nodes, edges })
    const lastActivity = result.nodes.get('a2')!
    const end = result.nodes.get(customEnd.id)!

    expect(end.x + end.width / 2).toBeCloseTo(lastActivity.x + lastActivity.width / 2, 0)
    expect(end.y).toBe(lastActivity.y + lastActivity.height + 18)
    expect(result.edges.get('a2-end')).toMatchObject({
      sourceAnchor: { side: 'bottom', offset: 0.5 },
      targetAnchor: { side: 'top', offset: 0.5 },
    })
  })

  it('renders a Stage as a segment spanning all Swimlane columns', () => {
    const document = makeDocument()
    const stage = {
      ...createGraphNode('stage', 'stage-1', { x: 0, y: 0 }),
      memberNodeIds: ['a1', 'a2'],
    }
    const result = layoutSwimlaneGraph({ ...document, nodes: new Map([...document.nodes, [stage.id, stage]]) })
    const container = result.nodes.get('stage-1')!

    expect(container.x).toBe(SWIMLANE_LANES.role.x)
    expect(container.width).toBe(SWIMLANE_LANES.output.x + SWIMLANE_LANES.output.width - SWIMLANE_LANES.role.x)
    expect(container.y).toBeLessThan(result.nodes.get('a1')!.y)
    expect(container.y + container.height).toBeGreaterThan(result.nodes.get('a2')!.y + result.nodes.get('a2')!.height)
  })
})
