import { describe, expect, it } from 'vitest'
import { createEmptyDocument, addEdge, addNode } from '../engine/graphDocument'
import { createGraphNode, createHandoffEdge } from '../processElements'
import { deriveProcessFocus } from './processFocus'

describe('deriveProcessFocus', () => {
  it('focuses nodes owned by a selected role and their connected handoffs', () => {
    let doc = createEmptyDocument('doc')
    const activity = { ...createGraphNode('activity', 'activity-1', { x: 0, y: 0 }), roleTags: ['PM'] }
    const decision = { ...createGraphNode('decision', 'decision-1', { x: 300, y: 0 }), roleTags: ['Engineer'] }
    doc = addNode(addNode(doc, activity), decision)
    doc = addEdge(doc, createHandoffEdge('edge-1', 'activity-1', 'out', 'decision-1', 'in'))

    const focus = deriveProcessFocus(doc, { mode: 'role', role: 'PM' })

    expect(focus.focusedNodeIds).toEqual(new Set(['activity-1']))
    expect(focus.dimmedNodeIds).toEqual(new Set(['decision-1']))
    expect(focus.focusedEdgeIds).toEqual(new Set(['edge-1']))
  })

  it('focuses decision nodes in decision mode', () => {
    let doc = createEmptyDocument('doc')
    doc = addNode(doc, createGraphNode('activity', 'activity-1', { x: 0, y: 0 }))
    doc = addNode(doc, createGraphNode('decision', 'decision-1', { x: 300, y: 0 }))

    const focus = deriveProcessFocus(doc, { mode: 'decisions' })

    expect(focus.focusedNodeIds).toEqual(new Set(['decision-1']))
    expect(focus.dimmedNodeIds).toEqual(new Set(['activity-1']))
  })

  it('focuses bottleneck nodes in bottleneck mode', () => {
    let doc = createEmptyDocument('doc')
    doc = addNode(doc, createGraphNode('bottleneck', 'bottleneck-1', { x: 0, y: 0 }))
    doc = addNode(doc, createGraphNode('activity', 'activity-1', { x: 300, y: 0 }))

    const focus = deriveProcessFocus(doc, { mode: 'bottlenecks' })

    expect(focus.focusedNodeIds).toEqual(new Set(['bottleneck-1']))
    expect(focus.dimmedNodeIds).toEqual(new Set(['activity-1']))
  })
})
