import { expect, test } from '@playwright/test'

const mockedDraft = {
  success: true,
  data: {
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
  },
}

test('R&D team can generate an LLM-assisted draft process map for discussion', async ({ page }) => {
  await page.route('**/api/scenario-drafts', async (route) => {
    await route.fulfill({ json: mockedDraft })
  })

  await page.goto('/')
  await page.getByRole('tab', { name: 'Scenario generation' }).click()

  const scenarioPanel = page.getByRole('tabpanel', { name: 'Scenario generation' })

  await scenarioPanel.getByLabel('Work scenario').fill(mockedDraft.data.processMap.scenario)
  await scenarioPanel.getByLabel('Roles').fill('Product Manager')
  await scenarioPanel.getByLabel('Expected outputs').fill('Validated role navigation update')
  await scenarioPanel.getByLabel('Known activities').fill('Validate release')
  await scenarioPanel.getByRole('button', { name: 'Generate draft map' }).click()

  const review = scenarioPanel.getByRole('region', { name: 'Generated draft review' })

  await expect(review.getByText('Draft for discussion')).toBeVisible()
  await expect(review.getByRole('heading', { name: 'Role navigation improvement draft' })).toBeVisible()
  await expect(review.getByText('Validate release')).toBeVisible()
  await expect(review.getByText('QA hands validated update to Release Team')).toBeVisible()
  await expect(review.getByText('Confirm who signs off release readiness.')).toBeVisible()
  await expect(review.getByText('QA validates before Release Team schedules rollout.')).toBeVisible()
  await expect(review.getByText('Design Lead may be informed too late.')).toBeVisible()
})
