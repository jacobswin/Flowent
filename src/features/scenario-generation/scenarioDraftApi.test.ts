import { afterEach, describe, expect, it, vi } from 'vitest'
import { requestScenarioDraft } from './scenarioDraftApi'
import type { ScenarioInput } from './types'

const input: ScenarioInput = {
  scenario: 'Customer feedback needs to become a release-ready navigation improvement.',
  problemGoal: 'Align discovery and delivery responsibilities.',
  trigger: 'Customer feedback shows unclear ownership.',
  roles: ['Product Manager'],
  stakeholders: ['Design Lead'],
  upstreamActors: ['Customer Feedback Group'],
  downstreamActors: ['Release Team'],
  inputs: ['Approved change request'],
  outputs: ['Role navigation update'],
  activities: ['Clarify outcome'],
  decisions: ['Is release risk acceptable?'],
}

const draft = {
  processMap: {
    id: 'generated-role-navigation-improvement-draft',
    title: 'Role navigation improvement draft',
    status: 'draft',
    scenario: input.scenario,
    roles: [],
    stakeholders: [],
    upstreamActors: [],
    downstreamActors: [],
    inputs: [],
    outputs: [],
    workProducts: [],
    expectations: [],
    decisions: [],
    handoffs: [],
    activities: [],
  },
  sourcesById: {},
  findings: [],
}

describe('requestScenarioDraft', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('posts scenario input only to the local scenario draft API', async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true, data: draft }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetch)

    const result = await requestScenarioDraft(input)

    expect(result).toEqual({ success: true, data: draft })
    expect(fetch).toHaveBeenCalledWith('/api/scenario-drafts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    })
    expect(fetch.mock.calls[0][0]).not.toContain('anthropic')
  })

  it('maps server error envelopes to safe UI errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ success: false, error: 'LLM draft generation is not configured for this environment.' }), {
          status: 503,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    )

    await expect(requestScenarioDraft(input)).resolves.toEqual({
      success: false,
      error: 'LLM draft generation is not configured for this environment.',
    })
  })

  it('maps network failures without leaking provider internals', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('sk-test-secret provider stack')))

    await expect(requestScenarioDraft(input)).resolves.toEqual({
      success: false,
      error: 'Flowent could not reach draft generation. Please try again.',
    })
  })
})
