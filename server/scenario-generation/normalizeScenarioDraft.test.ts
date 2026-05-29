import { describe, expect, it } from 'vitest'
import { normalizeScenarioDraft } from './normalizeScenarioDraft'
import type { ClaudeScenarioDraft } from './scenarioDraftSchemas'

const claudeDraft: ClaudeScenarioDraft = {
  title: 'Role navigation improvement draft',
  scenario: 'Customer feedback needs to become a release-ready navigation improvement.',
  actors: [
    { id: 'product-manager', name: 'Product Manager', kind: 'role', focus: 'Clarifies outcomes' },
    { id: 'qa-engineer', name: 'QA Engineer', kind: 'role', focus: 'Validates release readiness' },
    { id: 'design-lead', name: 'Design Lead', kind: 'stakeholder' },
    { id: 'feedback-group', name: 'Customer Feedback Group', kind: 'upstream' },
    { id: 'release-team', name: 'Release Team', kind: 'downstream' },
  ],
  inputs: [{ id: 'approved-change-request', title: 'Approved change request', sourceActorIds: ['feedback-group'] }],
  outputs: [
    {
      id: 'validated-role-navigation-update',
      title: 'Validated role navigation update',
      producerActorIds: ['qa-engineer'],
      recipientActorIds: ['release-team'],
    },
  ],
  workProducts: [
    { id: 'role-navigation-update-work-product', title: 'Role navigation update', state: 'draft for discussion' },
  ],
  expectations: [
    {
      id: 'validation-expectation',
      title: 'Release readiness is explicit',
      detail: 'QA can explain what must be true before release.',
      roleIds: ['qa-engineer'],
    },
  ],
  decisions: [
    {
      id: 'release-risk-acceptable',
      title: 'Is release risk acceptable?',
      affectedActorIds: ['product-manager', 'design-lead'],
      criteria: 'Risk has mitigation and a release owner.',
    },
  ],
  handoffs: [
    {
      id: 'qa-to-release',
      title: 'QA hands validated update to Release Team',
      fromActorIds: ['qa-engineer'],
      toActorIds: ['release-team'],
      inputIds: ['approved-change-request'],
      outputIds: ['validated-role-navigation-update'],
      expectationIds: ['validation-expectation'],
    },
  ],
  activities: [
    {
      id: 'validate-release',
      title: 'Validate release',
      summary: 'QA validates behavior and release risk.',
      responsibilities: [{ actorId: 'qa-engineer', kind: 'responsible' }],
      inputIds: ['approved-change-request'],
      outputIds: ['validated-role-navigation-update'],
      decisionIds: ['release-risk-acceptable'],
      handoffIds: ['qa-to-release'],
      expectationIds: ['validation-expectation'],
      workProductIds: ['role-navigation-update-work-product'],
    },
  ],
  sourcesById: {
    'validate-release': 'user-provided',
    'qa-to-release': 'model-inferred',
    'role-navigation-update-work-product': 'system-derived',
  },
  missingInformation: ['Confirm who signs off release readiness.'],
  assumptions: ['QA validates before Release Team schedules rollout.'],
  riskPoints: ['Design Lead may be informed too late.'],
  requiredConfirmations: ['Product Manager confirms release criteria.'],
}

describe('normalizeScenarioDraft', () => {
  it('normalizes a validated Claude draft into a draft ProcessMap with sidecar findings', () => {
    const result = normalizeScenarioDraft(claudeDraft)

    expect(result.success).toBe(true)
    if (!result.success) throw new Error(result.error)

    expect(result.data.processMap.status).toBe('draft')
    expect(result.data.processMap.roles.map((role) => role.name)).toEqual(['Product Manager', 'QA Engineer'])
    expect(result.data.processMap.stakeholders.map((actor) => actor.name)).toEqual(['Design Lead'])
    expect(result.data.processMap.upstreamActors.map((actor) => actor.name)).toEqual(['Customer Feedback Group'])
    expect(result.data.processMap.downstreamActors.map((actor) => actor.name)).toEqual(['Release Team'])
    expect(result.data.processMap.decisions[0].affectedActorIds).toEqual(['product-manager', 'design-lead'])
    expect(result.data.sourcesById['qa-to-release']).toBe('model-inferred')
    expect(result.data.findings).toEqual(
      expect.arrayContaining([
        { kind: 'missing-information', message: 'Confirm who signs off release readiness.' },
        { kind: 'assumption', message: 'QA validates before Release Team schedules rollout.' },
        { kind: 'risk-point', message: 'Design Lead may be informed too late.' },
      ]),
    )
  })

  it('returns a safe failure when Claude output references an unknown actor', () => {
    const result = normalizeScenarioDraft({
      ...claudeDraft,
      activities: [
        {
          ...claudeDraft.activities[0],
          responsibilities: [{ actorId: 'missing-role', kind: 'responsible' }],
        },
      ],
    })

    expect(result.success).toBe(false)
    if (result.success) throw new Error('Expected normalization to fail')

    expect(result.error).toContain('unknown actor')
  })
})
