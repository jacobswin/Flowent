import { describe, expect, it } from 'vitest'
import type { ProcessMap, Confirmation, Approval } from './types'
import {
  activateMap,
  approveMap,
  computeImpactAnalysis,
  confirmForRole,
  createVersionSnapshot,
  markReadyForConfirmation,
  rejectMap,
  removeConfirmation,
} from './consensusOperations'

const sampleMap: ProcessMap = {
  id: 'test-map',
  title: 'Test map',
  status: 'draft',
  scenario: 'Test scenario',
  roles: [
    { id: 'pm', name: 'Product Manager', kind: 'role', focus: 'Clarifies outcomes' },
    { id: 'eng', name: 'Engineer', kind: 'role', focus: 'Implements features' },
  ],
  stakeholders: [{ id: 'design-lead', name: 'Design Lead', kind: 'stakeholder' }],
  upstreamActors: [],
  downstreamActors: [],
  inputs: [],
  outputs: [],
  workProducts: [],
  expectations: [],
  decisions: [],
  handoffs: [],
  activities: [
    {
      id: 'plan',
      title: 'Plan work',
      summary: 'PM plans.',
      responsibilities: [{ actorId: 'pm', kind: 'responsible' }],
      inputIds: [],
      outputIds: [],
      decisionIds: [],
      handoffIds: [],
      expectationIds: [],
      workProductIds: [],
    },
  ],
}

describe('consensus operations', () => {
  it('confirms for a role', () => {
    const result = confirmForRole(sampleMap, [], 'pm', 'Product Manager', 'role')

    expect(result.confirmations).toHaveLength(1)
    expect(result.confirmations[0].actorId).toBe('pm')
    expect(result.confirmations[0].actorName).toBe('Product Manager')
    expect(result.confirmations[0].actorKind).toBe('role')
    expect(result.confirmations[0].confirmedAt).toBeTruthy()
  })

  it('does not duplicate confirmation for the same actor', () => {
    const confirmations = confirmForRole(sampleMap, [], 'pm', 'Product Manager', 'role').confirmations
    const result = confirmForRole(sampleMap, confirmations, 'pm', 'Product Manager', 'role')

    expect(result.confirmations).toHaveLength(1)
  })

  it('removes a confirmation', () => {
    const confirmations: Confirmation[] = [
      { actorId: 'pm', actorName: 'Product Manager', actorKind: 'role', confirmedAt: '2026-05-29T00:00:00Z' },
    ]
    const result = removeConfirmation(confirmations, 'pm')

    expect(result).toHaveLength(0)
  })

  it('marks map ready for confirmation', () => {
    const result = markReadyForConfirmation(sampleMap, 'in-discussion')

    expect(result.draftState).toBe('ready-for-confirmation')
  })

  it('approves the map', () => {
    const result = approveMap(sampleMap, 'Process Owner', 'Looks good.')

    expect(result.approval?.state).toBe('approved')
    expect(result.approval?.approverName).toBe('Process Owner')
    expect(result.approval?.comment).toBe('Looks good.')
  })

  it('rejects the map', () => {
    const result = rejectMap(sampleMap, 'Process Owner', 'Missing QA involvement.')

    expect(result.approval?.state).toBe('rejected')
    expect(result.approval?.comment).toBe('Missing QA involvement.')
  })

  it('activates the map', () => {
    const result = activateMap(sampleMap)

    expect(result.status).toBe('active')
  })

  it('creates a version snapshot', () => {
    const confirmations: Confirmation[] = [
      { actorId: 'pm', actorName: 'Product Manager', actorKind: 'role', confirmedAt: '2026-05-29T00:00:00Z' },
    ]
    const approval: Approval = {
      approverName: 'Process Owner',
      state: 'approved',
      decidedAt: '2026-05-29T00:00:00Z',
    }
    const impact = computeImpactAnalysis(sampleMap, null)
    const version = createVersionSnapshot(sampleMap, confirmations, approval, impact)

    expect(version.mapId).toBe('test-map')
    expect(version.title).toBe('Test map')
    expect(version.confirmations).toHaveLength(1)
    expect(version.approval?.state).toBe('approved')
    expect(version.activatedAt).toBeTruthy()
  })

  it('computes impact analysis with no previous map', () => {
    const impact = computeImpactAnalysis(sampleMap, null)

    expect(impact.affectedRoles).toEqual(['Product Manager', 'Engineer'])
    expect(impact.changes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'added', category: 'activity', id: 'plan' }),
      ]),
    )
    expect(impact.replacedVersionId).toBeUndefined()
  })

  it('computes impact analysis comparing to previous map', () => {
    const previousMap: ProcessMap = {
      ...sampleMap,
      activities: [
        {
          id: 'plan',
          title: 'Plan',
          summary: 'Old plan.',
          responsibilities: [],
          inputIds: [],
          outputIds: [],
          decisionIds: [],
          handoffIds: [],
          expectationIds: [],
          workProductIds: [],
        },
        {
          id: 'review',
          title: 'Review',
          summary: 'Old review.',
          responsibilities: [],
          inputIds: [],
          outputIds: [],
          decisionIds: [],
          handoffIds: [],
          expectationIds: [],
          workProductIds: [],
        },
      ],
    }
    const impact = computeImpactAnalysis(sampleMap, previousMap)

    expect(impact.changes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'removed', category: 'activity', id: 'review' }),
        expect.objectContaining({ kind: 'changed', category: 'activity', id: 'plan' }),
      ]),
    )
    expect(impact.replacedVersionId).toBe('test-map')
  })
})
