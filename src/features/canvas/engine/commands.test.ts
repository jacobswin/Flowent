import { describe, expect, it } from 'vitest'
import { createEmptyDocument } from './graphDocument'
import { runCommand } from './commands'

describe('commands', () => {
  it('applies AddNode command', () => {
    const doc = createEmptyDocument('d1')

    const next = runCommand(doc, {
      type: 'AddNode',
      payload: {
        id: 'n1',
        type: 'activity',
        x: 80,
        y: 120,
        width: 220,
        height: 96,
        title: 'A1',
        summary: '',
        roleTags: [],
        ports: [{ id: 'out', side: 'bottom' }],
      },
    })

    expect(next.nodes.has('n1')).toBe(true)
  })

  it('applies AddEdge command when both endpoints exist', () => {
    const n1 = {
      id: 'n1',
      type: 'activity' as const,
      x: 80,
      y: 120,
      width: 220,
      height: 96,
      title: 'A1',
      summary: '',
      roleTags: [],
      ports: [{ id: 'out', side: 'bottom' as const }],
    }
    const n2 = {
      id: 'n2',
      type: 'decision' as const,
      x: 380,
      y: 120,
      width: 180,
      height: 108,
      title: 'D1',
      criteria: '',
      roleTags: [],
      ports: [{ id: 'in', side: 'top' as const }],
    }

    const doc1 = runCommand(createEmptyDocument('d1'), { type: 'AddNode', payload: n1 })
    const doc2 = runCommand(doc1, { type: 'AddNode', payload: n2 })

    const next = runCommand(doc2, {
      type: 'AddEdge',
      payload: {
        id: 'e1',
        sourceNodeId: 'n1',
        sourcePortId: 'out',
        targetNodeId: 'n2',
        targetPortId: 'in',
        label: 'handoff',
      },
    })

    expect(next.edges.has('e1')).toBe(true)
  })

  it('applies UpdateNode command to title/summary/roleTags', () => {
    const doc = runCommand(createEmptyDocument('d1'), {
      type: 'AddNode',
      payload: {
        id: 'n1',
        type: 'activity',
        x: 0,
        y: 0,
        width: 220,
        height: 96,
        title: 'Old',
        summary: 's',
        roleTags: [],
        ports: [{ id: 'out', side: 'bottom' }],
      },
    })

    const next = runCommand(doc, {
      type: 'UpdateNode',
      payload: {
        id: 'n1',
        patch: {
          title: 'New',
          summary: 'Updated',
          roleTags: ['PM'],
        },
      },
    })

    expect(next.nodes.get('n1')?.title).toBe('New')
    expect(next.nodes.get('n1')?.summary).toBe('Updated')
    expect(next.nodes.get('n1')?.roleTags).toEqual(['PM'])
  })

  it('returns unchanged doc for unknown node in UpdateNode', () => {
    const doc = createEmptyDocument('d1')

    const next = runCommand(doc, {
      type: 'UpdateNode',
      payload: {
        id: 'missing',
        patch: { title: 'Nope' },
      },
    })

    expect(next).toBe(doc)
  })
})
