import { describe, expect, it } from 'vitest'
import {
  appendComment,
  applyCommentPatch,
  deleteComment,
  type CommentRecord,
} from './commentStore'

const sampleComment: CommentRecord = {
  id: 'c1',
  mapId: 'map-1',
  anchor: { kind: 'node', nodeId: 'n1' },
  author: { name: 'Alex', role: 'PM' },
  body: 'Unclear owner',
  status: 'open',
  createdAt: '2026-06-15T00:00:00.000Z',
}

describe('commentStore', () => {
  it('appendComment appends to the per-map bucket', () => {
    const lib = appendComment({}, 'map-1', sampleComment)

    expect(lib['map-1']).toEqual([sampleComment])
  })

  it('appendComment is additive across maps', () => {
    const second = { ...sampleComment, id: 'c2', mapId: 'map-2' }
    let lib: Record<string, CommentRecord[]> = {}

    lib = appendComment(lib, 'map-1', sampleComment)
    lib = appendComment(lib, 'map-2', second)

    expect(lib['map-1']).toEqual([sampleComment])
    expect(lib['map-2']).toEqual([second])
  })

  it('applyCommentPatch resolve sets status and resolved fields', () => {
    const lib: Record<string, CommentRecord[]> = { 'map-1': [sampleComment] }
    const out = applyCommentPatch(lib, 'map-1', 'c1', {
      status: 'resolved',
      resolvedAt: '2026-06-16T00:00:00.000Z',
      resolvedBy: 'Alex',
    })

    expect(out['map-1']?.[0]?.status).toBe('resolved')
    expect(out['map-1']?.[0]?.resolvedAt).toBe('2026-06-16T00:00:00.000Z')
    expect(out['map-1']?.[0]?.resolvedBy).toBe('Alex')
  })

  it('applyCommentPatch reopen clears resolved fields', () => {
    const resolved: CommentRecord = {
      ...sampleComment,
      status: 'resolved',
      resolvedAt: '2026-06-16T00:00:00.000Z',
      resolvedBy: 'Alex',
    }
    const lib: Record<string, CommentRecord[]> = { 'map-1': [resolved] }
    const out = applyCommentPatch(lib, 'map-1', 'c1', { status: 'open' })

    expect(out['map-1']?.[0]?.status).toBe('open')
    expect(out['map-1']?.[0]?.resolvedAt).toBeUndefined()
    expect(out['map-1']?.[0]?.resolvedBy).toBeUndefined()
  })

  it('applyCommentPatch throws when the comment id is missing', () => {
    const lib: Record<string, CommentRecord[]> = { 'map-1': [sampleComment] }

    expect(() => applyCommentPatch(lib, 'map-1', 'missing', { status: 'resolved' })).toThrow(/not found/)
  })

  it('deleteComment removes the comment and leaves an empty bucket', () => {
    const lib: Record<string, CommentRecord[]> = { 'map-1': [sampleComment] }
    const out = deleteComment(lib, 'map-1', 'c1')

    expect(out['map-1']).toEqual([])
  })

  it('deleteComment is a no-op for a missing comment id', () => {
    const lib: Record<string, CommentRecord[]> = { 'map-1': [sampleComment] }
    const out = deleteComment(lib, 'map-1', 'missing')

    expect(out['map-1']).toEqual([sampleComment])
  })
})
