import { describe, expect, it } from 'vitest'
import { createEmptyDocument, addNode, addEdge } from './graphDocument'

describe('graphDocument', () => {
  it('creates empty document with deterministic defaults', () => {
    const doc = createEmptyDocument('test-doc')

    expect(doc.id).toBe('test-doc')
    expect(doc.nodes.size).toBe(0)
    expect(doc.edges.size).toBe(0)
    expect(doc.selection.size).toBe(0)
    expect(doc.viewport).toEqual({ x: 0, y: 0, zoom: 1 })
    expect(doc.meta).toEqual({ dirty: false, version: 1 })
  })

  it('adds node immutably and keeps previous doc untouched', () => {
    const doc = createEmptyDocument('d1')
    const next = addNode(doc, {
      id: 'n1',
      type: 'activity',
      x: 100,
      y: 100,
      width: 220,
      height: 96,
      title: 'Activity 1',
      summary: 'desc',
      roleTags: ['PM'],
      ports: [{ id: 'out', side: 'bottom' }],
    })

    expect(doc.nodes.size).toBe(0)
    expect(next.nodes.size).toBe(1)
    expect(next.nodes.get('n1')?.title).toBe('Activity 1')
    expect(next.meta.dirty).toBe(true)
    expect(next.meta.version).toBe(2)
  })

  it('rejects edge creation when endpoint ids are missing', () => {
    const doc = createEmptyDocument('d1')

    expect(() =>
      addEdge(doc, {
        id: 'e1',
        sourceNodeId: 'a',
        sourcePortId: 'out',
        targetNodeId: 'b',
        targetPortId: 'in',
        label: '',
      }),
    ).toThrow(/missing endpoint/i)
  })

  it('adds edge when endpoints exist', () => {
    const doc0 = createEmptyDocument('d1')
    const doc1 = addNode(doc0, {
      id: 'n1',
      type: 'activity',
      x: 0,
      y: 0,
      width: 220,
      height: 96,
      title: 'A',
      summary: '',
      roleTags: [],
      ports: [{ id: 'out', side: 'bottom' }],
    })
    const doc2 = addNode(doc1, {
      id: 'n2',
      type: 'decision',
      x: 400,
      y: 0,
      width: 180,
      height: 108,
      title: 'D',
      criteria: '',
      roleTags: [],
      ports: [{ id: 'in', side: 'top' }],
    })

    const next = addEdge(doc2, {
      id: 'e1',
      sourceNodeId: 'n1',
      sourcePortId: 'out',
      targetNodeId: 'n2',
      targetPortId: 'in',
      label: 'handoff',
    })

    expect(next.edges.size).toBe(1)
    expect(next.edges.get('e1')?.sourceNodeId).toBe('n1')
    expect(next.meta.version).toBe(4)
  })
})
