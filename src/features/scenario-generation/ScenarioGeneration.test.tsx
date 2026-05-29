import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ScenarioGeneration } from './ScenarioGeneration'
import type { ScenarioDraft, ScenarioDraftApiResponse } from './types'

const draft: ScenarioDraft = {
  processMap: {
    id: 'generated-role-navigation-improvement-draft',
    title: 'Role navigation improvement draft',
    status: 'draft',
    scenario: 'Customer feedback needs to become a release-ready navigation improvement.',
    roles: [{ id: 'product-manager', name: 'Product Manager', kind: 'role', focus: 'Clarifies outcomes' }],
    stakeholders: [{ id: 'design-lead', name: 'Design Lead', kind: 'stakeholder' }],
    upstreamActors: [{ id: 'feedback-group', name: 'Customer Feedback Group', kind: 'upstream' }],
    downstreamActors: [{ id: 'release-team', name: 'Release Team', kind: 'downstream' }],
    inputs: [{ id: 'approved-change-request', title: 'Approved change request', sourceActorIds: ['feedback-group'] }],
    outputs: [
      {
        id: 'validated-role-navigation-update',
        title: 'Validated role navigation update',
        producerActorIds: ['product-manager'],
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
        roleIds: ['product-manager'],
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
        fromActorIds: ['product-manager'],
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
        responsibilities: [{ actorId: 'product-manager', kind: 'responsible' }],
        inputIds: ['approved-change-request'],
        outputIds: ['validated-role-navigation-update'],
        decisionIds: ['release-risk-acceptable'],
        handoffIds: ['qa-to-release'],
        expectationIds: ['validation-expectation'],
        workProductIds: ['role-navigation-update-work-product'],
      },
    ],
  },
  sourcesById: {
    'validate-release': 'user-provided',
    'qa-to-release': 'model-inferred',
    'role-navigation-update-work-product': 'system-derived',
  },
  findings: [
    { kind: 'missing-information', message: 'Confirm who signs off release readiness.' },
    { kind: 'assumption', message: 'QA validates before Release Team schedules rollout.' },
    { kind: 'risk-point', message: 'Design Lead may be informed too late.' },
  ],
}

describe('ScenarioGeneration', () => {
  it('renders scenario inputs and Claude disclosure copy', () => {
    render(<ScenarioGeneration />)

    expect(screen.getByRole('heading', { name: /Generate a draft process map/ })).toBeInTheDocument()
    expect(screen.getByLabelText('Work scenario')).toBeInTheDocument()
    expect(screen.getByLabelText('Problem or goal')).toBeInTheDocument()
    expect(screen.getByLabelText('Trigger')).toBeInTheDocument()
    expect(screen.getByLabelText('Roles')).toBeInTheDocument()
    expect(screen.getByLabelText('Stakeholders')).toBeInTheDocument()
    expect(screen.getByLabelText('Upstream actors')).toBeInTheDocument()
    expect(screen.getByLabelText('Downstream actors')).toBeInTheDocument()
    expect(screen.getByLabelText('Known inputs')).toBeInTheDocument()
    expect(screen.getByLabelText('Expected outputs')).toBeInTheDocument()
    expect(screen.getByLabelText('Known activities')).toBeInTheDocument()
    expect(screen.getByLabelText('Known decisions')).toBeInTheDocument()
    expect(screen.getByText(/sent to Claude/i)).toBeInTheDocument()
    expect(screen.getByText(/Do not include secrets/i)).toBeInTheDocument()
  })

  it('shows validation errors and does not call the API for incomplete input', async () => {
    const user = userEvent.setup()
    const requestDraft = vi.fn()

    render(<ScenarioGeneration requestDraft={requestDraft} />)
    await user.click(screen.getByRole('button', { name: 'Generate draft map' }))

    expect(await screen.findByText('Describe the work scenario before generating a draft map.')).toBeInTheDocument()
    expect(screen.getByText('Add at least one responsible R&D role.')).toBeInTheDocument()
    expect(requestDraft).not.toHaveBeenCalled()
  })

  it('generates and renders a draft-only map review from a mocked API response', async () => {
    const user = userEvent.setup()
    let resolveDraft: (response: ScenarioDraftApiResponse) => void = () => {}
    const requestDraft = vi.fn(
      () =>
        new Promise<ScenarioDraftApiResponse>((resolve) => {
          resolveDraft = resolve
        }),
    )

    render(<ScenarioGeneration requestDraft={requestDraft} />)

    await user.type(screen.getByLabelText('Work scenario'), draft.processMap.scenario)
    await user.type(screen.getByLabelText('Roles'), 'Product Manager')
    await user.type(screen.getByLabelText('Expected outputs'), 'Validated role navigation update')
    await user.type(screen.getByLabelText('Known activities'), 'Validate release')
    await user.click(screen.getByRole('button', { name: 'Generate draft map' }))

    expect(await screen.findByText('Generating draft map with Claude…')).toBeInTheDocument()

    resolveDraft({ success: true, data: draft })

    const review = await screen.findByRole('region', { name: 'Generated draft review' })

    expect(within(review).getByText('Draft for discussion')).toBeInTheDocument()
    expect(within(review).getByRole('heading', { name: 'Role navigation improvement draft' })).toBeInTheDocument()
    expect(within(review).getByText('Validate release')).toBeInTheDocument()
    expect(within(review).getByText('QA hands validated update to Release Team')).toBeInTheDocument()
    expect(within(review).getByText('Is release risk acceptable?')).toBeInTheDocument()
    expect(within(review).getByText('Release readiness is explicit')).toBeInTheDocument()
    expect(within(review).getByText('Confirm who signs off release readiness.')).toBeInTheDocument()
    expect(within(review).getByText('QA validates before Release Team schedules rollout.')).toBeInTheDocument()
    expect(within(review).getByText('Design Lead may be informed too late.')).toBeInTheDocument()
    expect(within(review).getByText('Model inferred')).toBeInTheDocument()
  })

  it('renders a safe API error message', async () => {
    const user = userEvent.setup()
    const requestDraft = vi.fn().mockResolvedValue({
      success: false,
      error: 'LLM draft generation is not configured for this environment.',
    })

    render(<ScenarioGeneration requestDraft={requestDraft} />)

    await user.type(screen.getByLabelText('Work scenario'), draft.processMap.scenario)
    await user.type(screen.getByLabelText('Roles'), 'Product Manager')
    await user.type(screen.getByLabelText('Expected outputs'), 'Validated role navigation update')
    await user.type(screen.getByLabelText('Known activities'), 'Validate release')
    await user.click(screen.getByRole('button', { name: 'Generate draft map' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'LLM draft generation is not configured for this environment.',
    )
  })
})
