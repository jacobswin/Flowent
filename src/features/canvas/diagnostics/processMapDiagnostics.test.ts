import { describe, expect, it } from 'vitest'
import { createEmptyDocument, addEdge, addNode } from '../engine/graphDocument'
import { createGraphNode, createHandoffEdge } from '../processElements'
import { getProcessMapDiagnostics } from './processMapDiagnostics'

describe('getProcessMapDiagnostics', () => {
  it('flags activities without responsible roles', () => {
    let doc = createEmptyDocument('doc')
    doc = addNode(doc, createGraphNode('activity', 'activity-1', { x: 0, y: 0 }))

    const diagnostics = getProcessMapDiagnostics(doc)

    expect(diagnostics).toContainEqual(expect.objectContaining({
      targetType: 'node',
      targetId: 'activity-1',
      severity: 'warning',
      title: 'Activity needs responsible roles',
    }))
  })

  it('flags handoffs without expectations', () => {
    let doc = createEmptyDocument('doc')
    doc = addNode(doc, createGraphNode('activity', 'a', { x: 0, y: 0 }))
    doc = addNode(doc, createGraphNode('activity', 'b', { x: 300, y: 0 }))
    doc = addEdge(doc, createHandoffEdge('edge-1', 'a', 'out', 'b', 'in'))

    const diagnostics = getProcessMapDiagnostics(doc)

    expect(diagnostics).toContainEqual(expect.objectContaining({
      targetType: 'edge',
      targetId: 'edge-1',
      title: 'Handoff expectation is missing',
    }))
  })

  it('does not flag a complete activity and handoff', () => {
    let doc = createEmptyDocument('doc')
    const a = {
      ...createGraphNode('activity', 'a', { x: 0, y: 0 }),
      roleTags: ['PM'],
      expectations: 'Problem, owner, and next step are clear.',
    }
    const b = {
      ...createGraphNode('activity', 'b', { x: 300, y: 0 }),
      roleTags: ['Engineer'],
      expectations: 'Implementation can start without another clarification loop.',
    }
    doc = addNode(addNode(doc, a), b)
    doc = addEdge(doc, {
      ...createHandoffEdge('edge-1', 'a', 'out', 'b', 'in'),
      expectation: 'Ready work includes context and owner.',
    })

    const diagnostics = getProcessMapDiagnostics(doc)

    expect(diagnostics.find((item) => item.targetId === 'a')).toBeUndefined()
    expect(diagnostics.find((item) => item.targetId === 'edge-1')).toBeUndefined()
  })
})
