import { describe, expect, it } from 'vitest'
import type { Comment } from './commentTypes'
import { groupCommentsByAnchor } from './groupCommentsByAnchor'

function makeComment(partial: Partial<Comment> & Pick<Comment, 'anchor'>): Comment {
  return {
    id: partial.id ?? 'c1',
    mapId: 'map-1',
    anchor: partial.anchor,
    author: { name: 'Alex', role: 'PM' },
    body: 'body',
    status: partial.status ?? 'open',
    createdAt: '2026-06-15T00:00:00.000Z',
    ...partial,
  }
}

describe('groupCommentsByAnchor', () => {
  it('returns empty groups for no comments', () => {
    const out = groupCommentsByAnchor([], new Map(), new Map())

    expect(out.elementGroups).toEqual([])
    expect(out.mapWide).toEqual([])
  })

  it('groups node-anchored comments by nodeId and resolves title from the map', () => {
    const nodes = new Map([
      ['n1', { id: 'n1', title: 'Triage' }],
      ['n2', { id: 'n2', title: 'Spec review' }],
    ])
    const comments: Comment[] = [
      makeComment({ id: 'c1', anchor: { kind: 'node', nodeId: 'n1' } }),
      makeComment({ id: 'c2', anchor: { kind: 'node', nodeId: 'n1' }, status: 'resolved' }),
      makeComment({ id: 'c3', anchor: { kind: 'node', nodeId: 'n2' } }),
    ]

    const out = groupCommentsByAnchor(comments, nodes, new Map())

    expect(out.elementGroups).toHaveLength(2)
    expect(out.elementGroups[0]?.id).toBe('n1')
    expect(out.elementGroups[0]?.title).toBe('Triage')
    expect(out.elementGroups[0]?.comments).toHaveLength(2)
    expect(out.elementGroups[1]?.id).toBe('n2')
    expect(out.elementGroups[1]?.title).toBe('Spec review')
    expect(out.mapWide).toEqual([])
  })

  it('sorts element groups by open count descending', () => {
    const nodes = new Map([
      ['a', { id: 'a', title: 'Alpha' }],
      ['b', { id: 'b', title: 'Bravo' }],
    ])
    const comments: Comment[] = [
      makeComment({ id: 'c1', anchor: { kind: 'node', nodeId: 'a' } }),
      makeComment({ id: 'c2', anchor: { kind: 'node', nodeId: 'b' } }),
      makeComment({ id: 'c3', anchor: { kind: 'node', nodeId: 'b' } }),
    ]

    const out = groupCommentsByAnchor(comments, nodes, new Map())

    expect(out.elementGroups[0]?.id).toBe('b')
    expect(out.elementGroups[0]?.comments).toHaveLength(2)
    expect(out.elementGroups[1]?.id).toBe('a')
  })

  it('groups edge-anchored comments by edgeId and resolves title from the map', () => {
    const edges = new Map([['e1', { id: 'e1', label: 'PM review' }]])
    const comments: Comment[] = [
      makeComment({ id: 'c1', anchor: { kind: 'edge', edgeId: 'e1' } }),
    ]

    const out = groupCommentsByAnchor(comments, new Map(), edges)

    expect(out.elementGroups).toEqual([
      { id: 'e1', title: 'PM review', comments: [comments[0]] },
    ])
  })

  it('separates map-wide comments into the mapWide bucket in chronological order', () => {
    const comments: Comment[] = [
      makeComment({ id: 'c2', anchor: { kind: 'map' }, createdAt: '2026-06-15T02:00:00.000Z' }),
      makeComment({ id: 'c1', anchor: { kind: 'map' }, createdAt: '2026-06-15T01:00:00.000Z' }),
    ]

    const out = groupCommentsByAnchor(comments, new Map(), new Map())

    expect(out.mapWide.map((comment) => comment.id)).toEqual(['c1', 'c2'])
  })

  it('falls back to "Untitled element" when the anchor id is not in the maps', () => {
    const comments: Comment[] = [
      makeComment({ id: 'c1', anchor: { kind: 'node', nodeId: 'missing' } }),
    ]

    const out = groupCommentsByAnchor(comments, new Map(), new Map())

    expect(out.elementGroups[0]?.title).toBe('Untitled element')
  })
})
