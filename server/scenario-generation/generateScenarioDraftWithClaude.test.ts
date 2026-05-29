import Anthropic from '@anthropic-ai/sdk'
import { describe, expect, it, vi } from 'vitest'
import { createScenarioDraftGenerationError, generateScenarioDraftWithClaude } from './generateScenarioDraftWithClaude'

const scenarioInput = {
  scenario: 'Customer feedback needs to become a release-ready navigation improvement.',
  problemGoal: 'Align discovery and delivery responsibilities.',
  trigger: 'Customer feedback shows unclear ownership.',
  roles: ['Product Manager', 'Frontend Engineer', 'QA Engineer'],
  stakeholders: ['Design Lead'],
  upstreamActors: ['Customer Feedback Group'],
  downstreamActors: ['Release Team'],
  inputs: ['Approved change request'],
  outputs: ['Role navigation update'],
  activities: ['Clarify outcome', 'Implement experience', 'Validate release'],
  decisions: ['Is release risk acceptable?'],
}

const parsedOutput = {
  title: 'Role navigation improvement draft',
  scenario: scenarioInput.scenario,
  actors: [{ id: 'product-manager', name: 'Product Manager', kind: 'role', focus: 'Clarifies outcomes' }],
  inputs: [],
  outputs: [],
  workProducts: [],
  expectations: [],
  decisions: [],
  handoffs: [],
  activities: [],
  sourcesById: {},
  missingInformation: ['Confirm release owner.'],
  assumptions: ['QA validates before release.'],
  riskPoints: ['Release ownership may remain unclear.'],
  requiredConfirmations: ['Product confirms release criteria.'],
}

describe('generateScenarioDraftWithClaude', () => {
  it('calls Claude with Opus 4.8, adaptive thinking, high effort, and structured output', async () => {
    const parse = vi.fn().mockResolvedValue({ parsed_output: parsedOutput })

    const result = await generateScenarioDraftWithClaude(scenarioInput, {
      anthropic: { messages: { parse } },
    })

    expect(result).toEqual(parsedOutput)
    expect(parse).toHaveBeenCalledTimes(1)
    expect(parse).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'claude-opus-4-8',
        thinking: { type: 'adaptive' },
        output_config: expect.objectContaining({ effort: 'high' }),
      }),
    )
    expect(parse.mock.calls[0][0]).not.toHaveProperty('temperature')
    expect(parse.mock.calls[0][0]).not.toHaveProperty('top_p')
    expect(parse.mock.calls[0][0]).not.toHaveProperty('top_k')
  })

  it('maps empty parsed output to a safe generation error', async () => {
    const parse = vi.fn().mockResolvedValue({ parsed_output: null })

    await expect(
      generateScenarioDraftWithClaude(scenarioInput, { anthropic: { messages: { parse } } }),
    ).rejects.toMatchObject({
      code: 'malformed-output',
      userMessage: 'Flowent could not safely read the generated draft. Please try again.',
    })
  })

  it('maps Anthropic rate-limit errors to safe user-facing errors', () => {
    const error = new Anthropic.RateLimitError(
      429,
      { error: { type: 'rate_limit_error', message: 'limit' } },
      'message',
      new Headers(),
    )

    expect(createScenarioDraftGenerationError(error)).toMatchObject({
      code: 'rate-limited',
      userMessage: 'Claude is receiving too many requests right now. Please retry shortly.',
    })
  })
})
