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

  it('rejects AddEdge commands that self-connect or reference missing ports', () => {
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
      ports: [
        { id: 'in', side: 'left' as const },
        { id: 'out', side: 'right' as const },
      ],
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
      ports: [{ id: 'in', side: 'left' as const }],
    }

    const doc = [n1, n2].reduce(
      (current, node) => runCommand(current, { type: 'AddNode', payload: node }),
      createEmptyDocument('d1'),
    )

    const selfLoop = runCommand(doc, {
      type: 'AddEdge',
      payload: {
        id: 'self',
        sourceNodeId: 'n1',
        sourcePortId: 'out',
        targetNodeId: 'n1',
        targetPortId: 'in',
        label: '',
      },
    })
    const badSourcePort = runCommand(doc, {
      type: 'AddEdge',
      payload: {
        id: 'bad-source',
        sourceNodeId: 'n1',
        sourcePortId: 'missing',
        targetNodeId: 'n2',
        targetPortId: 'in',
        label: '',
      },
    })
    const badTargetPort = runCommand(doc, {
      type: 'AddEdge',
      payload: {
        id: 'bad-target',
        sourceNodeId: 'n1',
        sourcePortId: 'out',
        targetNodeId: 'n2',
        targetPortId: 'missing',
        label: '',
      },
    })

    expect(selfLoop).toBe(doc)
    expect(badSourcePort).toBe(doc)
    expect(badTargetPort).toBe(doc)
  })

  it('does not add a duplicate edge between the same ports', () => {
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
      ports: [{ id: 'out', side: 'right' as const }],
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
      ports: [{ id: 'in', side: 'left' as const }],
    }

    const doc = [n1, n2].reduce(
      (current, node) => runCommand(current, { type: 'AddNode', payload: node }),
      createEmptyDocument('d1'),
    )
    const withEdge = runCommand(doc, {
      type: 'AddEdge',
      payload: {
        id: 'e1',
        sourceNodeId: 'n1',
        sourcePortId: 'out',
        targetNodeId: 'n2',
        targetPortId: 'in',
        label: '',
      },
    })

    const duplicate = runCommand(withEdge, {
      type: 'AddEdge',
      payload: {
        id: 'e2',
        sourceNodeId: 'n1',
        sourcePortId: 'out',
        targetNodeId: 'n2',
        targetPortId: 'in',
        label: '',
      },
    })

    expect(duplicate).toBe(withEdge)
    expect(duplicate.edges).toHaveLength(1)
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

  it('updates an edge endpoint when the replacement node and port exist', () => {
    const n1 = {
      id: 'n1',
      type: 'activity' as const,
      x: 0,
      y: 0,
      width: 220,
      height: 96,
      title: 'A1',
      summary: '',
      roleTags: [],
      ports: [{ id: 'out', side: 'right' as const }],
    }
    const n2 = {
      id: 'n2',
      type: 'activity' as const,
      x: 300,
      y: 0,
      width: 220,
      height: 96,
      title: 'A2',
      summary: '',
      roleTags: [],
      ports: [{ id: 'in', side: 'left' as const }],
    }
    const n3 = {
      id: 'n3',
      type: 'activity' as const,
      x: 600,
      y: 0,
      width: 220,
      height: 96,
      title: 'A3',
      summary: '',
      roleTags: [],
      ports: [{ id: 'in', side: 'left' as const }],
    }

    const withNodes = [n1, n2, n3].reduce(
      (doc, node) => runCommand(doc, { type: 'AddNode', payload: node }),
      createEmptyDocument('d1'),
    )
    const doc = runCommand(withNodes, {
      type: 'AddEdge',
      payload: {
        id: 'e1',
        sourceNodeId: 'n1',
        sourcePortId: 'out',
        targetNodeId: 'n2',
        targetPortId: 'in',
        label: '',
      },
    })

    const next = runCommand(doc, {
      type: 'UpdateEdge',
      payload: {
        id: 'e1',
        patch: { targetNodeId: 'n3', targetPortId: 'in' },
      },
    })

    expect(next.edges.get('e1')?.targetNodeId).toBe('n3')
  })

  it('updates edge color without changing its endpoints', () => {
    const n1 = {
      id: 'n1',
      type: 'activity' as const,
      x: 0,
      y: 0,
      width: 220,
      height: 96,
      title: 'A1',
      summary: '',
      roleTags: [],
      ports: [{ id: 'out', side: 'right' as const }],
    }
    const n2 = {
      id: 'n2',
      type: 'activity' as const,
      x: 300,
      y: 0,
      width: 220,
      height: 96,
      title: 'A2',
      summary: '',
      roleTags: [],
      ports: [{ id: 'in', side: 'left' as const }],
    }
    const withNodes = [n1, n2].reduce(
      (doc, node) => runCommand(doc, { type: 'AddNode', payload: node }),
      createEmptyDocument('d1'),
    )
    const doc = runCommand(withNodes, {
      type: 'AddEdge',
      payload: {
        id: 'e1',
        sourceNodeId: 'n1',
        sourcePortId: 'out',
        targetNodeId: 'n2',
        targetPortId: 'in',
        label: '',
      },
    })

    const next = runCommand(doc, {
      type: 'UpdateEdge',
      payload: {
        id: 'e1',
        patch: { color: '#2563eb' },
      },
    })

    expect(next.edges.get('e1')?.color).toBe('#2563eb')
    expect(next.edges.get('e1')?.sourceNodeId).toBe('n1')
    expect(next.edges.get('e1')?.targetNodeId).toBe('n2')
  })

  it('rejects edge endpoint updates that would point to the same node or a missing port', () => {
    const n1 = {
      id: 'n1',
      type: 'activity' as const,
      x: 0,
      y: 0,
      width: 220,
      height: 96,
      title: 'A1',
      summary: '',
      roleTags: [],
      ports: [{ id: 'out', side: 'right' as const }],
    }
    const n2 = {
      id: 'n2',
      type: 'activity' as const,
      x: 300,
      y: 0,
      width: 220,
      height: 96,
      title: 'A2',
      summary: '',
      roleTags: [],
      ports: [{ id: 'in', side: 'left' as const }],
    }
    const withNodes = [n1, n2].reduce(
      (doc, node) => runCommand(doc, { type: 'AddNode', payload: node }),
      createEmptyDocument('d1'),
    )
    const doc = runCommand(withNodes, {
      type: 'AddEdge',
      payload: {
        id: 'e1',
        sourceNodeId: 'n1',
        sourcePortId: 'out',
        targetNodeId: 'n2',
        targetPortId: 'in',
        label: '',
      },
    })

    const selfLoop = runCommand(doc, {
      type: 'UpdateEdge',
      payload: {
        id: 'e1',
        patch: { targetNodeId: 'n1', targetPortId: 'out' },
      },
    })
    const badPort = runCommand(doc, {
      type: 'UpdateEdge',
      payload: {
        id: 'e1',
        patch: { targetPortId: 'missing' },
      },
    })

    expect(selfLoop).toBe(doc)
    expect(badPort).toBe(doc)
  })
})
