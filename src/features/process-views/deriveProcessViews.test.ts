import { describe, expect, it } from 'vitest'
import { sampleProcessMap } from '../process-map/sampleProcessMap'
import {
  deriveManagerView,
  deriveProcessOwnerView,
  deriveQualityReviewView,
  deriveStakeholderView,
} from './deriveProcessViews'

describe('deriveProcessViews', () => {
  it('derives a manager view that summarizes readiness and participant context', () => {
    const view = deriveManagerView(sampleProcessMap)

    expect(view.kind).toBe('manager')
    expect(view.processTitle).toBe('Product experience change process')
    expect(view.participatingRoles.map((role) => role.name)).toEqual([
      'Product Manager',
      'Frontend Engineer',
      'Backend Engineer',
      'QA Engineer',
    ])
    expect(view.stakeholders.map((stakeholder) => stakeholder.name)).toEqual(['Design Lead'])
    expect(view.startActivity.title).toBe('Assess UI impact')
    expect(view.endActivity.title).toBe('Support release readiness review')
    expect(view.readinessSignals).toEqual([
      '4 activities mapped',
      '3 handoffs visible',
      '2 decisions have criteria',
      '3 completion expectations defined',
    ])
  })

  it('derives a process owner view that surfaces structural completeness gaps', () => {
    const view = deriveProcessOwnerView(sampleProcessMap)

    expect(view.kind).toBe('process-owner')
    expect(view.completenessSignals).toEqual([
      'Every activity has a responsible or accountable actor',
      'Every input names an upstream source',
      'Every output names a downstream recipient',
      'Every decision has decision criteria',
    ])
    expect(view.gaps).toEqual([
      {
        id: 'activity-expectations:support-release-readiness-review',
        title: 'Support release readiness review has no completion expectations',
        severity: 'medium',
      },
    ])
  })

  it('derives a quality review view around standards, work products, and decision rationale', () => {
    const view = deriveQualityReviewView(sampleProcessMap)

    expect(view.kind).toBe('quality-review')
    expect(view.reviewableWorkProducts.map((workProduct) => workProduct.title)).toEqual([
      'Role navigation expectation note',
      'Role navigation interface change',
      'Release readiness note',
    ])
    expect(view.completionStandards.map((expectation) => expectation.title)).toEqual([
      'UI change is traceable to the approved request',
      'Implementation is ready for QA without hidden assumptions',
      'Validation result explains release risk',
    ])
    expect(view.decisionRationale.map((decision) => decision.title)).toEqual([
      'Is API behavior clear enough to implement?',
      'Is release risk acceptable?',
    ])
    expect(view.reviewHandoffs.map((handoff) => handoff.title)).toEqual([
      'Product clarifies UI expectations',
      'Backend confirms API contract',
      'Frontend hands build to QA',
    ])
  })

  it('derives a stakeholder view for where a stakeholder is involved and affected', () => {
    const view = deriveStakeholderView(sampleProcessMap, 'design-lead')

    expect(view.kind).toBe('stakeholder')
    expect(view.stakeholder.name).toBe('Design Lead')
    expect(view.consultedActivities.map((activity) => activity.title)).toEqual(['Assess UI impact'])
    expect(view.informedActivities).toEqual([])
    expect(view.affectedOutputs.map((output) => output.title)).toEqual(['UI impact notes'])
    expect(view.affectedDecisions.map((decision) => decision.title)).toEqual(['Is release risk acceptable?'])
    expect(view.involvementSummary).toEqual([
      'Consulted on 1 activity',
      'Affected by 1 output',
      'Affected by 1 decision',
    ])
  })

  it('throws when deriving a stakeholder view for a missing stakeholder', () => {
    expect(() => deriveStakeholderView(sampleProcessMap, 'missing-stakeholder')).toThrow(
      'Stakeholder missing-stakeholder was not found in Product experience change process',
    )
  })
})
