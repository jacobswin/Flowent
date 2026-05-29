import { describe, expect, it } from 'vitest'
import { sampleProcessMap } from '../process-map/sampleProcessMap'
import { deriveRoleView } from './deriveRoleView'

describe('deriveRoleView', () => {
  it('shows what a role does, needs, produces, and hands off', () => {
    const view = deriveRoleView(sampleProcessMap, 'frontend-engineer')

    expect(view.role.name).toBe('Frontend Engineer')
    expect(view.activities.map((activity) => activity.title)).toEqual([
      'Assess UI impact',
      'Implement interface change',
      'Support release readiness review',
    ])
    expect(view.requiredInputs.map((input) => input.title)).toEqual([
      'Approved change request',
      'Updated interaction expectations',
      'API contract notes',
    ])
    expect(view.producedOutputs.map((output) => output.title)).toEqual([
      'UI impact notes',
      'Updated role navigation screen',
    ])
    expect(view.upstreamDependencies.map((actor) => actor.name)).toEqual([
      'Product Manager',
      'Backend Engineer',
    ])
    expect(view.downstreamRecipients.map((actor) => actor.name)).toEqual([
      'QA Engineer',
      'Product Manager',
    ])
  })

  it('surfaces decisions, handoffs, and expectations that affect the role', () => {
    const view = deriveRoleView(sampleProcessMap, 'frontend-engineer')

    expect(view.decisions.map((decision) => decision.title)).toEqual([
      'Is API behavior clear enough to implement?',
      'Is release risk acceptable?',
    ])
    expect(view.handoffs.map((handoff) => handoff.title)).toEqual([
      'Product clarifies UI expectations',
      'Backend confirms API contract',
      'Frontend hands build to QA',
    ])
    expect(view.expectations.map((expectation) => expectation.title)).toEqual([
      'UI change is traceable to the approved request',
      'Implementation is ready for QA without hidden assumptions',
    ])
  })

  it('derives a different view for another role from the same process map', () => {
    const view = deriveRoleView(sampleProcessMap, 'qa-engineer')

    expect(view.role.name).toBe('QA Engineer')
    expect(view.activities.map((activity) => activity.title)).toEqual([
      'Validate change behavior',
      'Support release readiness review',
    ])
    expect(view.requiredInputs.map((input) => input.title)).toEqual([
      'Updated role navigation screen',
      'Acceptance criteria',
    ])
    expect(view.producedOutputs.map((output) => output.title)).toEqual([
      'Validation result',
    ])
    expect(view.upstreamDependencies.map((actor) => actor.name)).toEqual([
      'Frontend Engineer',
      'Product Manager',
    ])
    expect(view.downstreamRecipients.map((actor) => actor.name)).toEqual([
      'Product Manager',
    ])
  })

  it('does not credit supporting roles with outputs they do not produce', () => {
    const view = deriveRoleView(sampleProcessMap, 'backend-engineer')

    expect(view.role.name).toBe('Backend Engineer')
    expect(view.activities.map((activity) => activity.title)).toEqual(['Implement interface change'])
    expect(view.producedOutputs).toEqual([])
    expect(view.downstreamRecipients.map((actor) => actor.name)).toEqual(['Frontend Engineer'])
  })

  it('throws when the role does not exist in the process map', () => {
    expect(() => deriveRoleView(sampleProcessMap, 'missing-role')).toThrow(
      'Role missing-role was not found in Product experience change process',
    )
  })
})
