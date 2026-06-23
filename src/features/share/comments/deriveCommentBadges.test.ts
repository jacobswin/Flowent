import { describe, expect, it } from 'vitest'
import type { Comment } from './commentTypes'
import { deriveCommentBadges } from './deriveCommentBadges'

function makeComment(partial: Partial<Comment> & Pick<Comment, 'anchor' | 'status'>): Comment {
  return {
    id: partial.id ?? 'c1',
    mapId: 'map-1',
    anchor: partial.anchor,
    author: { name: 'Alex', role: 'PM' },
    body: 'body',
    status: partial.status,
    createdAt: '2026-06-15T00:00:00.000Z',
    ...partial,
  }
}

describe('deriveCommentBadges', () => {
  it('returns empty maps when there are no comments', () => {
    const out = deriveCommentBadges([])

    expect(Array.from(out.nodeBadges.entries())).toEqual([])
    expect(Array.from(out.edgeBadges.entries())).toEqual([])
  })

  it('counts only open comments per element', () => {
    const comments: Comment[] = [
      makeComment({ id: 'c1', anchor: { kind: 'node', nodeId: 'n1' }, status: 'open' }),
      makeComment({ id: 'c2', anchor: { kind: 'node', nodeId: 'n1' }, status: 'open' }),
      makeComment({ id: 'c3', anchor: { kind: 'node', nodeId: 'n1' }, status: 'resolved' }),
      makeComment({ id: 'c4', anchor: { kind: 'edge', edgeId: 'e1' }, status: 'open' }),
      makeComment({ id: 'c5', anchor: { kind: 'map' }, status: 'open' }),
    ]

    const out = deriveCommentBadges(comments)

    expect(out.nodeBadges.get('n1')).toBe(2)
    expect(out.edgeBadges.get('e1')).toBe(1)
    expect(out.nodeBadges.has('missing')).toBe(false)
  })

  it('does not include elements whose open count is zero', () => {
    const comments: Comment[] = [
      makeComment({ id: 'c1', anchor: { kind: 'node', nodeId: 'n1' }, status: 'resolved' }),
    ]

    const out = deriveCommentBadges(comments)

    expect(out.nodeBadges.has('n1')).toBe(false)
  })
})
