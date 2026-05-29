import { expect, test } from '@playwright/test'

const realisticDraft = {
  success: true,
  data: {
    processMap: {
      id: 'product-experience-change-draft',
      title: 'Product experience change process',
      status: 'draft',
      scenario: 'A product team needs to change a role-navigation screen after a customer feedback review reveals unclear handoffs.',
      roles: [
        { id: 'product-manager', name: 'Product Manager', kind: 'role', focus: 'Clarifies user expectations and accepts release readiness.' },
        { id: 'frontend-engineer', name: 'Frontend Engineer', kind: 'role', focus: 'Turns agreed expectations into an inspectable interface change.' },
        { id: 'qa-engineer', name: 'QA Engineer', kind: 'role', focus: 'Validates that the change satisfies the agreed behavior.' },
      ],
      stakeholders: [{ id: 'design-lead', name: 'Design Lead', kind: 'stakeholder' }],
      upstreamActors: [{ id: 'customer-feedback-group', name: 'Customer Feedback Group', kind: 'upstream' }],
      downstreamActors: [{ id: 'release-team', name: 'Release Team', kind: 'downstream' }],
      inputs: [
        { id: 'approved-change-request', title: 'Approved change request', sourceActorIds: ['product-manager'] },
        { id: 'acceptance-criteria', title: 'Acceptance criteria', sourceActorIds: ['product-manager'] },
      ],
      outputs: [
        { id: 'validation-result', title: 'Validation result', producerActorIds: ['qa-engineer'], recipientActorIds: ['product-manager'] },
      ],
      workProducts: [
        { id: 'release-readiness-note', title: 'Release readiness note', state: 'draft' },
      ],
      expectations: [
        { id: 'validation-is-actionable', title: 'Validation result explains release risk', detail: 'Validation output should state whether remaining risk is acceptable.', roleIds: ['qa-engineer'] },
      ],
      decisions: [
        { id: 'release-risk-acceptable', title: 'Is release risk acceptable?', affectedActorIds: ['product-manager', 'qa-engineer', 'design-lead'], criteria: 'Validation result and remaining issues are understood.' },
      ],
      handoffs: [
        { id: 'frontend-hands-build-to-qa', title: 'Frontend hands build to QA', fromActorIds: ['frontend-engineer'], toActorIds: ['qa-engineer'], inputIds: ['approved-change-request', 'acceptance-criteria'], outputIds: ['validation-result'], expectationIds: ['validation-is-actionable'] },
      ],
      activities: [
        {
          id: 'assess-ui-impact',
          title: 'Assess UI impact',
          summary: 'Review the approved request and identify which role-navigation states need to change.',
          responsibilities: [{ actorId: 'frontend-engineer', kind: 'responsible' }, { actorId: 'product-manager', kind: 'consulted' }],
          inputIds: ['approved-change-request'],
          outputIds: [],
          decisionIds: [],
          handoffIds: [],
          expectationIds: [],
          workProductIds: [],
        },
        {
          id: 'validate-change-behavior',
          title: 'Validate change behavior',
          summary: 'Confirm the changed role-navigation screen satisfies acceptance criteria.',
          responsibilities: [{ actorId: 'qa-engineer', kind: 'responsible' }],
          inputIds: ['approved-change-request', 'acceptance-criteria'],
          outputIds: ['validation-result'],
          decisionIds: [],
          handoffIds: ['frontend-hands-build-to-qa'],
          expectationIds: ['validation-is-actionable'],
          workProductIds: ['release-readiness-note'],
        },
      ],
    },
    sourcesById: {
      'assess-ui-impact': 'model-inferred',
      'validate-change-behavior': 'model-inferred',
      'frontend-hands-build-to-qa': 'model-inferred',
      'release-risk-acceptable': 'model-inferred',
    },
    findings: [
      { kind: 'missing-information', message: 'Confirm who owns the final release readiness decision.' },
      { kind: 'assumption', message: 'QA validates before Release Team schedules rollout.' },
      { kind: 'risk-point', message: 'Design Lead may be informed too late about UI changes.' },
    ],
  },
}

test('full lifecycle: role navigation → scenario generation → workspace → consensus → activation', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('tab', { name: 'Role navigation' })).toBeVisible()
  const rolePanel = page.getByRole('tabpanel', { name: 'Role navigation' })
  await expect(rolePanel.getByRole('button', { name: 'Product Manager' })).toBeVisible()

  await page.getByRole('tab', { name: 'Process views' }).click()
  const viewsPanel = page.getByRole('tabpanel', { name: 'Process views' })
  await expect(viewsPanel.locator('h2').first()).toBeVisible()

  await page.route('**/api/scenario-drafts', async (route) => {
    await route.fulfill({ json: realisticDraft })
  })

  await page.getByRole('tab', { name: 'Scenario generation' }).click()
  const scenarioPanel = page.getByRole('tabpanel', { name: 'Scenario generation' })

  await scenarioPanel.getByLabel('Work scenario').fill(realisticDraft.data.processMap.scenario)
  await scenarioPanel.getByLabel('Roles').fill('Product Manager\nFrontend Engineer\nQA Engineer')
  await scenarioPanel.getByLabel('Expected outputs').fill('Validation result')
  await scenarioPanel.getByLabel('Known activities').fill('Assess UI impact\nValidate change behavior')
  await scenarioPanel.getByRole('button', { name: 'Generate draft map' }).click()

  const review = scenarioPanel.getByRole('region', { name: 'Generated draft review' })
  await expect(review.getByText('Assess UI impact')).toBeVisible()
  await expect(review.getByText('Validate change behavior')).toBeVisible()
  await expect(review.getByText('Confirm who owns the final release readiness decision.')).toBeVisible()

  await scenarioPanel.getByRole('button', { name: 'Refine in workspace' }).click()

  await expect(page.getByRole('heading', { name: 'Product experience change process' })).toBeVisible()
  await expect(page.getByText('Ready for discussion')).toBeVisible()

  const consensusPanel = page.getByRole('region', { name: 'Consensus' })
  await consensusPanel.getByRole('button', { name: 'Confirm for Product Manager' }).click()
  await consensusPanel.getByRole('button', { name: 'Confirm for Frontend Engineer' }).click()
  await consensusPanel.getByRole('button', { name: 'Confirm for QA Engineer' }).click()

  await expect(consensusPanel.locator('.confirmation-badge.confirmed')).toHaveCount(3)

  await consensusPanel.getByRole('button', { name: 'Mark ready for confirmation' }).click()
  await expect(consensusPanel.locator('.draft-state-badge')).toHaveText('Ready for confirmation')

  await consensusPanel.getByRole('button', { name: 'Approve' }).click()
  await expect(consensusPanel.locator('.draft-state-badge')).toHaveText('Approved')

  await consensusPanel.getByRole('button', { name: 'Activate map' }).click()
  await expect(consensusPanel.locator('.draft-state-badge')).toHaveText('Activated')
  await expect(consensusPanel.getByText('This process map is active.')).toBeVisible()
})
