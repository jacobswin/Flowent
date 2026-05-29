import { describe, expect, it, vi } from 'vitest'
import { createScenarioDraftRouteHandler } from './scenarioDraftRoute'

const validBody = {
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

const draftData = {
  processMap: {
    id: 'generated-role-navigation-improvement-draft',
    title: 'Role navigation improvement draft',
    status: 'draft',
    scenario: validBody.scenario,
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

describe('scenario draft route', () => {
  it('returns a success envelope for a valid request', async () => {
    const generateDraft = vi.fn().mockResolvedValue(draftData)
    const handleRequest = createScenarioDraftRouteHandler({ generateDraft, hasApiKey: () => true })

    const response = await handleRequest(
      new Request('http://localhost/api/scenario-drafts', {
        method: 'POST',
        body: JSON.stringify(validBody),
      }),
    )
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({ success: true, data: draftData })
    expect(generateDraft).toHaveBeenCalledWith(validBody)
  })

  it('rejects validation failures before calling the generator', async () => {
    const generateDraft = vi.fn()
    const handleRequest = createScenarioDraftRouteHandler({ generateDraft, hasApiKey: () => true })

    const response = await handleRequest(
      new Request('http://localhost/api/scenario-drafts', {
        method: 'POST',
        body: JSON.stringify({ ...validBody, scenario: '', roles: [] }),
      }),
    )
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.success).toBe(false)
    expect(body.error).toBe('Please complete the required scenario details before generating a draft map.')
    expect(generateDraft).not.toHaveBeenCalled()
  })

  it('returns a safe setup error when the Claude API key is missing', async () => {
    const generateDraft = vi.fn()
    const handleRequest = createScenarioDraftRouteHandler({ generateDraft, hasApiKey: () => false })

    const response = await handleRequest(
      new Request('http://localhost/api/scenario-drafts', {
        method: 'POST',
        body: JSON.stringify(validBody),
      }),
    )
    const body = await response.json()

    expect(response.status).toBe(503)
    expect(body.success).toBe(false)
    expect(body.error).toBe('LLM draft generation is not configured for this environment.')
    expect(JSON.stringify(body)).not.toContain('sk-')
    expect(generateDraft).not.toHaveBeenCalled()
  })

  it('rejects malformed JSON without exposing stack traces', async () => {
    const handleRequest = createScenarioDraftRouteHandler({ generateDraft: vi.fn(), hasApiKey: () => true })

    const response = await handleRequest(
      new Request('http://localhost/api/scenario-drafts', { method: 'POST', body: '{not-json' }),
    )
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body).toEqual({ success: false, error: 'Request body must be valid JSON.' })
  })
})
