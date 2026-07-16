import { describe, expect, it } from 'vitest'
import { createEmptyDocument } from '../engine/graphDocument'
import { createGraphNode, createHandoffEdge } from '../processElements'
import type { GraphDocument, GraphEdge, GraphNode } from '../canvasTypes'
import { layoutGeneratedFlowGraph, shouldUseGeneratedFlowLayout } from './generatedFlowLayout'

function makeDocument(): GraphDocument {
  let doc = createEmptyDocument('generated-flow')
  const nodes = [
    createGraphNode('start', 'start', { x: 0, y: 0 }),
    { ...createGraphNode('activity', 'trigger', { x: 0, y: 0 }), title: 'DVP试验偏差产生' },
    { ...createGraphNode('decision', 'risk', { x: 0, y: 0 }), title: '步骤0：风险评估' },
    { ...createGraphNode('activity', 'blocked', { x: 0, y: 0 }), title: '禁止偏差，必须整改' },
    { ...createGraphNode('decision', 'temporary', { x: 0, y: 0 }), title: '是否临时偏差' },
    { ...createGraphNode('activity', 'formal-report', { x: 0, y: 0 }), title: '步骤1：DRE编制评审报告' },
    { ...createGraphNode('activity', 'temporary-report', { x: 0, y: 0 }), title: '步骤1：DRE编制评审报告' },
    { ...createGraphNode('decision', 'expiry', { x: 0, y: 0 }), title: '到期问题是否解决' },
    { ...createGraphNode('activity', 'archive', { x: 0, y: 0 }), title: '步骤6：归档' },
    createGraphNode('end', 'end', { x: 0, y: 0 }),
  ]
  doc = { ...doc, nodes: new Map(nodes.map((node) => [node.id, node])) }
  const edges = [
    createHandoffEdge('start-trigger', 'start', 'out', 'trigger', 'in'),
    createHandoffEdge('trigger-risk', 'trigger', 'out', 'risk', 'in'),
    { ...createHandoffEdge('risk-blocked', 'risk', 'out', 'blocked', 'in'), label: '高风险/法规类/中风险' },
    { ...createHandoffEdge('risk-temporary', 'risk', 'out', 'temporary', 'in'), label: '低风险' },
    { ...createHandoffEdge('temporary-formal', 'temporary', 'out', 'formal-report', 'in'), label: '否' },
    { ...createHandoffEdge('temporary-temp', 'temporary', 'out', 'temporary-report', 'in'), label: '是' },
    createHandoffEdge('formal-archive', 'formal-report', 'out', 'archive', 'in'),
    createHandoffEdge('temporary-expiry', 'temporary-report', 'out', 'expiry', 'in'),
    { ...createHandoffEdge('expiry-archive', 'expiry', 'out', 'archive', 'in'), label: '到期问题解决' },
    { ...createHandoffEdge('expiry-risk', 'expiry', 'out', 'risk', 'in'), label: '到期仍存在问题' },
    createHandoffEdge('archive-end', 'archive', 'out', 'end', 'in'),
  ]
  doc = { ...doc, edges: new Map(edges.map((edge) => [edge.id, edge])) }
  return doc
}

function node(doc: GraphDocument, id: string): GraphNode {
  return doc.nodes.get(id)!
}

function edge(doc: GraphDocument, id: string): GraphEdge {
  return doc.edges.get(id)!
}

function centerX(node: GraphNode): number {
  return node.x + node.width / 2
}

function overlaps(a: GraphNode, b: GraphNode): boolean {
  return a.x < b.x + b.width
    && a.x + a.width > b.x
    && a.y < b.y + b.height
    && a.y + a.height > b.y
}

describe('layoutGeneratedFlowGraph', () => {
  it('lays out generated AI flows as a vertical mainline with left and right branch lanes', () => {
    const result = layoutGeneratedFlowGraph(makeDocument(), [
      'trigger',
      'risk',
      'temporary',
      'formal-report',
      'archive',
      'blocked',
      'temporary-report',
      'expiry',
    ])

    expect(centerX(node(result, 'trigger'))).toBeCloseTo(centerX(node(result, 'risk')), 0)
    expect(centerX(node(result, 'temporary'))).toBeCloseTo(centerX(node(result, 'risk')), 0)
    expect(centerX(node(result, 'formal-report'))).toBeCloseTo(centerX(node(result, 'risk')), 0)
    expect(node(result, 'risk').y).toBeGreaterThan(node(result, 'trigger').y)
    expect(node(result, 'temporary').y).toBeGreaterThan(node(result, 'risk').y)
    expect(node(result, 'formal-report').y).toBeGreaterThan(node(result, 'temporary').y)
    expect(node(result, 'archive').y).toBeGreaterThan(node(result, 'formal-report').y)

    expect(centerX(node(result, 'blocked'))).toBeLessThan(centerX(node(result, 'risk')))
    expect(centerX(node(result, 'temporary-report'))).toBeGreaterThan(centerX(node(result, 'temporary')))
    expect(centerX(node(result, 'expiry'))).toBeGreaterThan(centerX(node(result, 'temporary')))

    const placedNodes = Array.from(result.nodes.values())
    for (let i = 0; i < placedNodes.length; i += 1) {
      for (let j = i + 1; j < placedNodes.length; j += 1) {
        expect(overlaps(placedNodes[i], placedNodes[j])).toBe(false)
      }
    }
  })

  it('sets edge anchors to match mainline, branch, and loop directions', () => {
    const result = layoutGeneratedFlowGraph(makeDocument(), [
      'trigger',
      'risk',
      'temporary',
      'formal-report',
      'archive',
      'blocked',
      'temporary-report',
      'expiry',
    ])

    expect(edge(result, 'trigger-risk')).toMatchObject({
      sourcePortId: 'bottom',
      targetPortId: 'top',
      sourceAnchor: { side: 'bottom', offset: 0.5 },
      targetAnchor: { side: 'top', offset: 0.5 },
    })
    expect(edge(result, 'risk-blocked')).toMatchObject({
      sourceAnchor: { side: 'left', offset: 0.5 },
      targetAnchor: { side: 'right', offset: 0.5 },
    })
    expect(edge(result, 'temporary-temp')).toMatchObject({
      sourceAnchor: { side: 'right', offset: 0.5 },
      targetAnchor: { side: 'left', offset: 0.5 },
    })
    expect(edge(result, 'expiry-risk')).toMatchObject({
      sourceAnchor: { side: 'right', offset: 0.5 },
      targetAnchor: { side: 'right', offset: 0.5 },
    })
  })

  it('keeps simple generated chains vertical instead of converting them to a horizontal row', () => {
    let doc = createEmptyDocument('simple-ai')
    const nodes = [
      createGraphNode('start', 'start', { x: 0, y: 0 }),
      { ...createGraphNode('activity', 'a', { x: 0, y: 0 }), title: 'Collect report' },
      { ...createGraphNode('activity', 'b', { x: 0, y: 0 }), title: 'Assess risk' },
      { ...createGraphNode('activity', 'c', { x: 0, y: 0 }), title: 'Archive' },
      createGraphNode('end', 'end', { x: 0, y: 0 }),
    ]
    doc = { ...doc, nodes: new Map(nodes.map((n) => [n.id, n])) }
    const edges = [
      createHandoffEdge('start-a', 'start', 'out', 'a', 'in'),
      createHandoffEdge('a-b', 'a', 'out', 'b', 'in'),
      createHandoffEdge('b-c', 'b', 'out', 'c', 'in'),
      createHandoffEdge('c-end', 'c', 'out', 'end', 'in'),
    ]
    doc = { ...doc, edges: new Map(edges.map((e) => [e.id, e])) }

    const result = layoutGeneratedFlowGraph(doc, ['a', 'b', 'c'])

    expect(centerX(node(result, 'a'))).toBeCloseTo(centerX(node(result, 'b')), 0)
    expect(centerX(node(result, 'b'))).toBeCloseTo(centerX(node(result, 'c')), 0)
    expect(node(result, 'b').y).toBeGreaterThan(node(result, 'a').y)
    expect(node(result, 'c').y).toBeGreaterThan(node(result, 'b').y)
  })

  it('uses persisted generated node order from document metadata', () => {
    const doc = {
      ...makeDocument(),
      meta: {
        dirty: false,
        version: 1,
        layoutProfile: 'generated-flow' as const,
        layoutNodeOrder: [
          'trigger',
          'risk',
          'temporary',
          'formal-report',
          'archive',
          'blocked',
          'temporary-report',
          'expiry',
        ],
      },
    }

    const result = layoutGeneratedFlowGraph(doc)

    expect(shouldUseGeneratedFlowLayout(result)).toBe(true)
    expect(centerX(node(result, 'trigger'))).toBeCloseTo(centerX(node(result, 'risk')), 0)
    expect(centerX(node(result, 'formal-report'))).toBeCloseTo(centerX(node(result, 'risk')), 0)
    expect(centerX(node(result, 'blocked'))).toBeLessThan(centerX(node(result, 'risk')))
  })

  it('does not treat an ordinary unmarked one-decision map as generated flow', () => {
    let doc = createEmptyDocument('manual-map')
    const nodes = [
      createGraphNode('activity', 'a', { x: 100, y: 100 }),
      createGraphNode('decision', 'd', { x: 360, y: 100 }),
      createGraphNode('activity', 'yes', { x: 620, y: 40 }),
      createGraphNode('activity', 'no', { x: 620, y: 180 }),
    ]
    doc = { ...doc, nodes: new Map(nodes.map((n) => [n.id, n])) }
    const edges = [
      createHandoffEdge('a-d', 'a', 'out', 'd', 'in'),
      { ...createHandoffEdge('d-yes', 'd', 'out', 'yes', 'in'), label: 'Yes' },
      { ...createHandoffEdge('d-no', 'd', 'out', 'no', 'in'), label: 'No' },
    ]
    doc = { ...doc, edges: new Map(edges.map((e) => [e.id, e])) }

    expect(shouldUseGeneratedFlowLayout(doc)).toBe(false)
  })
})
