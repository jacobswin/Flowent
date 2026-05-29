import { describe, expect, it } from 'vitest'
import { claudeScenarioDraftSchema, scenarioDraftRequestSchema } from './scenarioDraftSchemas'

const validRequest = {
  scenario: 'A product team needs to turn customer feedback into a release-ready role navigation improvement.',
  problemGoal: 'Align discovery and delivery responsibilities.',
  trigger: 'Customer feedback shows confusion about ownership.',
  roles: ['Product Manager', 'Frontend Engineer', 'QA Engineer'],
  stakeholders: ['Design Lead'],
  upstreamActors: ['Customer Feedback Group'],
  downstreamActors: ['Release Team'],
  inputs: ['Approved change request'],
  outputs: ['Role navigation update'],
  activities: ['Clarify outcome', 'Implement experience', 'Validate release'],
  decisions: ['Is release risk acceptable?'],
}

const validClaudeDraft = {
  title: 'Role navigation improvement draft',
  scenario: validRequest.scenario,
  actors: [
    { id: 'product-manager', name: 'Product Manager', kind: 'role', focus: 'Clarifies outcomes' },
    { id: 'design-lead', name: 'Design Lead', kind: 'stakeholder' },
    { id: 'feedback-group', name: 'Customer Feedback Group', kind: 'upstream' },
    { id: 'release-team', name: 'Release Team', kind: 'downstream' },
  ],
  inputs: [{ id: 'approved-change-request', title: 'Approved change request', sourceActorIds: ['feedback-group'] }],
  outputs: [
    {
      id: 'role-navigation-update',
      title: 'Role navigation update',
      producerActorIds: ['product-manager'],
      recipientActorIds: ['release-team'],
    },
  ],
  workProducts: [{ id: 'role-navigation-update-work-product', title: 'Role navigation update', state: 'draft' }],
  expectations: [
    {
      id: 'release-readiness-expectation',
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
      criteria: 'Known release risk has an owner and mitigation.',
    },
  ],
  handoffs: [
    {
      id: 'implementation-to-validation',
      title: 'Implementation hands draft to QA',
      fromActorIds: ['product-manager'],
      toActorIds: ['release-team'],
      inputIds: ['approved-change-request'],
      outputIds: ['role-navigation-update'],
      expectationIds: ['release-readiness-expectation'],
    },
  ],
  activities: [
    {
      id: 'clarify-outcome',
      title: 'Clarify outcome',
      summary: 'Product clarifies the expected process outcome.',
      responsibilities: [{ actorId: 'product-manager', kind: 'responsible' }],
      inputIds: ['approved-change-request'],
      outputIds: ['role-navigation-update'],
      decisionIds: ['release-risk-acceptable'],
      handoffIds: ['implementation-to-validation'],
      expectationIds: ['release-readiness-expectation'],
      workProductIds: ['role-navigation-update-work-product'],
    },
  ],
  sourcesById: {
    'clarify-outcome': 'user-provided',
    'implementation-to-validation': 'model-inferred',
    'role-navigation-update-work-product': 'system-derived',
  },
  missingInformation: ['Confirm release owner.'],
  assumptions: ['QA validates before Release Team schedules rollout.'],
  riskPoints: ['Release risk may be accepted without Design Lead input.'],
  requiredConfirmations: ['Product Manager confirms release criteria.'],
}

describe('scenario draft schemas', () => {
  it('validates a complete scenario draft request', () => {
    expect(scenarioDraftRequestSchema.safeParse(validRequest).success).toBe(true)
  })

  it('rejects empty scenario text and invalid actor collections', () => {
    const result = scenarioDraftRequestSchema.safeParse({ ...validRequest, scenario: '', roles: [] })

    expect(result.success).toBe(false)
  })

  it('requires every Claude draft section needed for Flowent review', () => {
    const result = claudeScenarioDraftSchema.safeParse(validClaudeDraft)

    expect(result.success).toBe(true)
  })

  it('restricts generated source markers to known values', () => {
    const result = claudeScenarioDraftSchema.safeParse({
      ...validClaudeDraft,
      sourcesById: { 'clarify-outcome': 'ai-guessed' },
    })

    expect(result.success).toBe(false)
  })

  it('rejects malformed Claude drafts missing uncertainty sections', () => {
    const draftWithoutRiskPoints: Record<string, unknown> = { ...validClaudeDraft }
    delete draftWithoutRiskPoints.riskPoints

    expect(claudeScenarioDraftSchema.safeParse(draftWithoutRiskPoints).success).toBe(false)
  })
})
