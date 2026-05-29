import { describe, expect, it } from 'vitest'
import { buildScenarioDraftPrompt } from './scenarioDraftPrompt'

const firstInput = {
  scenario: 'Support tickets show users cannot identify who owns release readiness.',
  problemGoal: 'Align product, engineering, QA, and release responsibilities.',
  trigger: 'Navigation confusion appears in customer feedback.',
  roles: ['Product Manager', 'Frontend Engineer', 'QA Engineer'],
  stakeholders: ['Design Lead'],
  upstreamActors: ['Customer Feedback Group'],
  downstreamActors: ['Release Team'],
  inputs: ['Approved change request'],
  outputs: ['Role navigation update'],
  activities: ['Clarify outcome', 'Implement experience', 'Validate release'],
  decisions: ['Is release risk acceptable?'],
}

const secondInput = {
  ...firstInput,
  scenario: 'A different team needs to map incident follow-up into product improvements.',
}

describe('scenario draft prompt assembly', () => {
  it('keeps stable Flowent instructions unchanged when scenario text changes', () => {
    const firstPrompt = buildScenarioDraftPrompt(firstInput)
    const secondPrompt = buildScenarioDraftPrompt(secondInput)

    expect(firstPrompt.system).toEqual(secondPrompt.system)
    expect(JSON.stringify(firstPrompt.messages)).toContain(firstInput.scenario)
    expect(JSON.stringify(secondPrompt.messages)).toContain(secondInput.scenario)
  })

  it('puts draft-only, uncertainty, and source-marker requirements in the cached system block', () => {
    const prompt = buildScenarioDraftPrompt(firstInput)

    expect(prompt.system[0].text).toContain('draft')
    expect(prompt.system[0].text).toContain('missing information')
    expect(prompt.system[0].text).toContain('assumptions')
    expect(prompt.system[0].text).toContain('risk points')
    expect(prompt.system[0].text).toContain('user-provided')
    expect(prompt.system[0].text).toContain('model-inferred')
    expect(prompt.system[0].cache_control).toEqual({ type: 'ephemeral' })
  })

  it('does not include volatile cache invalidators in stable instructions', () => {
    const prompt = buildScenarioDraftPrompt(firstInput)

    expect(prompt.system[0].text).not.toMatch(/\d{4}-\d{2}-\d{2}/)
    expect(prompt.system[0].text).not.toContain('requestId')
    expect(prompt.system[0].text).not.toContain('Date.now')
    expect(prompt.system[0].text).not.toContain('randomUUID')
  })
})
