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
      upstreamActors: [],
      downstreamActors: [],
      inputs: [{ id: 'approved-change-request', title: 'Approved change request', sourceActorIds: [] }],
      outputs: [{ id: 'feature-update', title: 'Feature update', producerActorIds: ['product-manager'], recipientActorIds: [] }],
      workProducts: [],
      expectations: [],
      decisions: [],
      handoffs: [],
      activities: [
        {
          id: 'clarify-outcome',
          title: 'Clarify outcome',
          summary: 'Product clarifies the expected process outcome.',
          responsibilities: [{ actorId: 'product-manager', kind: 'responsible' }],
          inputIds: ['approved-change-request'],
          outputIds: ['feature-update'],
          decisionIds: [],
          handoffIds: [],
          expectationIds: [],
          workProductIds: [],
        },
      ],
    },
    sourcesById: { 'clarify-outcome': 'model-inferred' },
    findings: [
      { kind: 'missing-information', message: 'Confirm release owner.' },
      { kind: 'assumption', message: 'QA validates before release.' },
      { kind: 'risk-point', message: 'Release risk may not be visible to all parties.' },
    ],
  },
}

test('team can generate a draft and refine it in the collaborative workspace', async ({ page }) => {
  await page.route('**/api/scenario-drafts', async (route) => {
    await route.fulfill({ json: mockedDraft })
  })

  await page.goto('/')
  await page.getByRole('tab', { name: 'Scenario generation' }).click()

  const scenarioPanel = page.getByRole('tabpanel', { name: 'Scenario generation' })

  await scenarioPanel.getByLabel('Work scenario').fill(mockedDraft.data.processMap.scenario)
  await scenarioPanel.getByLabel('Roles').fill('Product Manager')
  await scenarioPanel.getByLabel('Expected outputs').fill('Feature update')
  await scenarioPanel.getByLabel('Known activities').fill('Clarify outcome')
  await scenarioPanel.getByRole('button', { name: 'Generate draft map' }).click()

  const review = scenarioPanel.getByRole('region', { name: 'Generated draft review' })
  await expect(review.getByText('Clarify outcome')).toBeVisible()

  await scenarioPanel.getByRole('button', { name: 'Refine in workspace' }).click()

  await expect(page.getByRole('heading', { name: 'Role navigation improvement draft' })).toBeVisible()
  await expect(page.getByText('Model inferred')).toBeVisible()
  await expect(page.getByText('Ready for discussion')).toBeVisible()

  const activitiesPanel = page.getByRole('region', { name: 'Activities' })
  await activitiesPanel.getByRole('button', { name: /Edit.*Clarify outcome/ }).click()

  const titleInput = activitiesPanel.getByRole('textbox', { name: 'Activity title' })
  await titleInput.clear()
  await titleInput.fill('Clarify the expected outcome')
  await activitiesPanel.getByRole('button', { name: 'Save' }).click()

  await expect(activitiesPanel.getByText('Clarify the expected outcome', { exact: true })).toBeVisible()
  await expect(activitiesPanel.getByText('User provided')).toBeVisible()

  await page.getByRole('button', { name: 'Undo' }).click()
  await expect(activitiesPanel.getByText('Clarify outcome', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Redo' }).click()
  await expect(activitiesPanel.getByText('Clarify the expected outcome', { exact: true })).toBeVisible()
})
