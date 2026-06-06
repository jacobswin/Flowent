import { describe, expect, it } from 'vitest'
import { createEmptyDocument, addNode, addEdge } from '../engine/graphDocument'
import { createGraphNode, createHandoffEdge } from '../processElements'
import {
  buildActivationSnapshot,
  DEFAULT_ACTIVATION,
  deriveActivationStatus,
  isActivationEligible,
  isReviewApproved,
} from './processActivation'

describe('deriveActivationStatus', () => {
  it('returns default unactivated when no snapshot exists', () => {
    const doc = createEmptyDocument('doc')
    const state = deriveActivationStatus(doc, null)
    expect(state).toEqual(DEFAULT_ACTIVATION)
  })

  it('marks the map stale when the doc is dirty after activation', () => {
    const doc = createEmptyDocument('doc')
    const saved = {
      status: 'activated' as const,
      activatedAt: '2026-06-04T10:00:00.000Z',
      lastEditedAt: null,
      baselineDiagnosticCount: 0,
    }
    const dirty = { ...doc, meta: { dirty: true, version: 2 } }
    expect(deriveActivationStatus(dirty, saved).status).toBe('stale')
  })

  it('keeps the activated status when the doc is clean', () => {
    const doc = createEmptyDocument('doc')
    const saved = {
      status: 'activated' as const,
      activatedAt: '2026-06-04T10:00:00.000Z',
      lastEditedAt: null,
      baselineDiagnosticCount: 0,
    }
    expect(deriveActivationStatus(doc, saved).status).toBe('activated')
  })
})

describe('isActivationEligible', () => {
  it('rejects a map with activities missing roles', () => {
    let doc = createEmptyDocument('doc')
    doc = addNode(doc, createGraphNode('activity', 'a', { x: 0, y: 0 }))
    const result = isActivationEligible(doc)
    expect(result.eligible).toBe(false)
    expect(result.reasons.join(' ')).toMatch(/roles/i)
  })

  it('rejects a map with a handoff missing expectation', () => {
    let doc = createEmptyDocument('doc')
    doc = addNode(doc, {
      ...createGraphNode('activity', 'a', { x: 0, y: 0 }),
      roleTags: ['PM'],
      expectations: 'Clear next step.',
    })
    doc = addNode(doc, {
      ...createGraphNode('activity', 'b', { x: 300, y: 0 }),
      roleTags: ['Engineer'],
      expectations: 'Can implement.',
    })
    doc = addEdge(doc, createHandoffEdge('edge-1', 'a', 'out', 'b', 'in'))
    const result = isActivationEligible(doc)
    expect(result.eligible).toBe(false)
    expect(result.reasons.join(' ')).toMatch(/expectation/i)
  })

  it('accepts a complete map', () => {
    let doc = createEmptyDocument('doc')
    doc = addNode(doc, {
      ...createGraphNode('activity', 'a', { x: 0, y: 0 }),
      roleTags: ['PM'],
      expectations: 'Clear next step.',
    })
    doc = addNode(doc, {
      ...createGraphNode('activity', 'b', { x: 300, y: 0 }),
      roleTags: ['Engineer'],
      expectations: 'Can implement.',
    })
    doc = addEdge(doc, {
      ...createHandoffEdge('edge-1', 'a', 'out', 'b', 'in'),
      expectation: 'Ready work moves with context and owner.',
    })
    expect(isActivationEligible(doc)).toEqual({ eligible: true, reasons: [] })
  })
})

describe('buildActivationSnapshot', () => {
  it('produces an activated snapshot with a current ISO timestamp and the diagnostic count', () => {
    let doc = createEmptyDocument('doc')
    doc = addNode(doc, {
      ...createGraphNode('activity', 'a', { x: 0, y: 0 }),
      roleTags: ['PM'],
      expectations: 'Clear next step.',
    })

    const snapshot = buildActivationSnapshot(doc, DEFAULT_ACTIVATION)
    expect(snapshot.status).toBe('activated')
    expect(snapshot.baselineDiagnosticCount).toBe(0)
    expect(snapshot.activatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })
})

describe('isReviewApproved', () => {
  it('returns true only for approved', () => {
    expect(isReviewApproved('approved')).toBe(true)
    expect(isReviewApproved('unclear')).toBe(false)
    expect(isReviewApproved(undefined)).toBe(false)
  })
})
