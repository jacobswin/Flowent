import { describe, expect, it } from 'vitest'
import { createEmptyDocument, addEdge, addNode } from '../engine/graphDocument'
import { createGraphNode, createHandoffEdge } from '../processElements'
import { exportProcessMap, exportProcessMapAsSvg } from './processMapExporter'

describe('exportProcessMap', () => {
  it('returns a no-node map with default bounds for an empty doc', () => {
    const doc = createEmptyDocument('doc')
    const map = exportProcessMap(doc)
    expect(map.nodes).toEqual([])
    expect(map.edges).toEqual([])
    expect(map.width).toBe(200)
    expect(map.height).toBe(80)
    expect(map.exportedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('flattens node semantic fields into the exported payload', () => {
    let doc = createEmptyDocument('doc')
    doc = addNode(doc, {
      ...createGraphNode('activity', 'a', { x: 100, y: 200 }),
      roleTags: ['PM', 'Designer'],
      expectations: 'Ready when scope is clear',
    })
    doc = addNode(doc, {
      ...createGraphNode('decision', 'b', { x: 400, y: 200 }),
      criteria: 'Evidence quality',
      owner: 'Tech Lead',
    })
    doc = addEdge(doc, {
      ...createHandoffEdge('edge-1', 'a', 'out', 'b', 'in'),
      fromRole: 'PM',
      toRole: 'Engineer',
      artifact: 'Ready brief',
      expectation: 'Context and owner are present',
    })

    const map = exportProcessMap(doc)
    expect(map.nodes).toHaveLength(2)
    expect(map.nodes[0]?.fields).toMatchObject({
      expectations: 'Ready when scope is clear',
    })
    expect(map.nodes[0]?.roleTags).toEqual(['PM', 'Designer'])
    expect(map.nodes[1]?.fields.owner).toBe('Tech Lead')
    expect(map.edges[0]?.fields).toMatchObject({
      fromRole: 'PM',
      toRole: 'Engineer',
      artifact: 'Ready brief',
      expectation: 'Context and owner are present',
    })
  })
})

describe('exportProcessMapAsSvg', () => {
  it('produces a self-contained SVG with header and edges', () => {
    let doc = createEmptyDocument('doc')
    doc = addNode(doc, createGraphNode('activity', 'a', { x: 100, y: 200 }))
    doc = addNode(doc, createGraphNode('decision', 'b', { x: 400, y: 200 }))
    doc = addEdge(doc, createHandoffEdge('edge-1', 'a', 'out', 'b', 'in'))

    const svg = exportProcessMapAsSvg(doc)
    expect(svg).toMatch(/^<\?xml version="1\.0" encoding="UTF-8"\?>/)
    expect(svg).toMatch(/<svg [^>]+>/)
    expect(svg).toMatch(/<rect [^>]+fill="#ffffff"/)
    expect(svg).toMatch(/<path d="M /)
    expect(svg).toMatch(/<polygon /)
    expect(svg).toMatch(/<\/svg>$/)
  })

  it('escapes special characters in titles and labels', () => {
    let doc = createEmptyDocument('doc')
    doc = addNode(doc, {
      ...createGraphNode('activity', 'a', { x: 0, y: 0 }),
      title: 'A & B <x>',
    })
    const svg = exportProcessMapAsSvg(doc)
    expect(svg).toContain('A &amp; B &lt;x&gt;')
  })
})
