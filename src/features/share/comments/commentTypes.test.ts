import { describe, expect, it } from 'vitest'
import {
  createComment,
  isComment,
  isCommentAnchor,
  type Comment,
  type CommentAnchor,
} from './commentTypes'

describe('commentTypes', () => {
  it('creates a valid open comment with a generated id and timestamp', () => {
    const comment = createComment({
      mapId: 'map-1',
      anchor: { kind: 'node', nodeId: 'n1' },
      author: { name: 'Alex', role: 'PM' },
      body: 'Unclear owner',
    })

    expect(comment.id).toMatch(/^c-[a-z0-9-]+$/)
    expect(comment.status).toBe('open')
    expect(comment.mapId).toBe('map-1')
    expect(comment.body).toBe('Unclear owner')
    expect(typeof comment.createdAt).toBe('string')
    expect(new Date(comment.createdAt).toString()).not.toBe('Invalid Date')
    expect(comment.resolvedAt).toBeUndefined()
    expect(comment.resolvedBy).toBeUndefined()
  })

  it('trims whitespace from name, role, and body', () => {
    const comment = createComment({
      mapId: 'map-1',
      anchor: { kind: 'map' },
      author: { name: '  Sam  ', role: '  Eng  ' },
      body: '  missing feedback loop  ',
    })

    expect(comment.author).toEqual({ name: 'Sam', role: 'Eng' })
    expect(comment.body).toBe('missing feedback loop')
  })

  it('rejects empty or oversized fields', () => {
    expect(() =>
      createComment({
        mapId: 'map-1',
        anchor: { kind: 'node', nodeId: 'n1' },
        author: { name: '', role: 'PM' },
        body: 'x',
      }),
    ).toThrow(/name/)

    expect(() =>
      createComment({
        mapId: 'map-1',
        anchor: { kind: 'node', nodeId: 'n1' },
        author: { name: 'A'.repeat(41), role: 'PM' },
        body: 'x',
      }),
    ).toThrow(/name/)

    expect(() =>
      createComment({
        mapId: 'map-1',
        anchor: { kind: 'node', nodeId: 'n1' },
        author: { name: 'Alex', role: '' },
        body: 'x',
      }),
    ).toThrow(/role/)

    expect(() =>
      createComment({
        mapId: 'map-1',
        anchor: { kind: 'node', nodeId: 'n1' },
        author: { name: 'Alex', role: 'PM' },
        body: '',
      }),
    ).toThrow(/body/)

    expect(() =>
      createComment({
        mapId: 'map-1',
        anchor: { kind: 'node', nodeId: 'n1' },
        author: { name: 'Alex', role: 'PM' },
        body: 'a'.repeat(2001),
      }),
    ).toThrow(/body/)
  })

  it('type-guards CommentAnchor shapes', () => {
    const node: CommentAnchor = { kind: 'node', nodeId: 'n1' }
    const edge: CommentAnchor = { kind: 'edge', edgeId: 'e1' }
    const map: CommentAnchor = { kind: 'map' }

    expect(isCommentAnchor(node)).toBe(true)
    expect(isCommentAnchor(edge)).toBe(true)
    expect(isCommentAnchor(map)).toBe(true)
    expect(isCommentAnchor({ kind: 'other' })).toBe(false)
    expect(isCommentAnchor(null)).toBe(false)
  })

  it('type-guards Comment records', () => {
    const valid: Comment = createComment({
      mapId: 'map-1',
      anchor: { kind: 'map' },
      author: { name: 'Alex', role: 'PM' },
      body: 'hi',
    })

    expect(isComment(valid)).toBe(true)
    expect(isComment({ ...valid, body: '' })).toBe(false)
    expect(isComment({ ...valid, anchor: { kind: 'nope' } })).toBe(false)
    expect(isComment(null)).toBe(false)
  })
})
