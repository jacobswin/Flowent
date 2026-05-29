import { expect, test } from '@playwright/test'

const mockedDraft = {
  success: true,
  data: {
    processMap: {
      id: 'generated-navigation-draft',
      title: 'Navigation improvement draft',
      status: 'draft',
      scenario: 'Users need better role-based navigation.',
      roles: [
        { id: 'pm', name: 'Product Manager', kind: 'role', focus: 'Clarifies outcomes' },
        { id: 'eng', name: 'Engineer', kind: 'role', focus: 'Implements features' },
      ],
      stakeholders: [],
      upstreamActors: [],
      downstreamActors: [],
      inputs: [],
      outputs: [],
      workProducts: [],
      expectations: [],
      decisions: [],
      handoffs: [],
      activities: [
        {
          id: 'plan',
          title: 'Plan work',
          summary: 'PM plans the work.',
          responsibilities: [{ actorId: 'pm', kind: 'responsible' }],
          inputIds: [],
          outputIds: [],
          decisionIds: [],
          handoffIds: [],
          expectationIds: [],
          workProductIds: [],
        },
      ],
    },
    sourcesById: { plan: 'model-inferred' },
    findings: [],
  },
}

test('team can confirm roles, approve, and activate a process map', async ({ page }) => {
  await page.route('**/api/scenario-drafts', async (route) => {
    await route.fulfill({ json: mockedDraft })
  })

  await page.goto('/')
  await page.getByRole('tab', { name: 'Scenario generation' }).click()

  const scenarioPanel = page.getByRole('tabpanel', { name: 'Scenario generation' })

  await scenarioPanel.getByLabel('Work scenario').fill('Users need better role-based navigation.')
  await scenarioPanel.getByLabel('Roles').fill('Product Manager\nEngineer')
  await scenarioPanel.getByLabel('Expected outputs').fill('Navigation update')
  await scenarioPanel.getByLabel('Known activities').fill('Plan work')
  await scenarioPanel.getByRole('button', { name: 'Generate draft map' }).click()

  await scenarioPanel.getByRole('button', { name: 'Refine in workspace' }).click()

  const consensusPanel = page.getByRole('region', { name: 'Consensus' })

  await expect(consensusPanel.getByText('Draft')).toBeVisible()
  await expect(consensusPanel.getByText('Product Manager', { exact: true })).toBeVisible()
  await expect(consensusPanel.getByText('Engineer', { exact: true })).toBeVisible()

  await consensusPanel.getByRole('button', { name: 'Confirm for Product Manager' }).click()
  await consensusPanel.getByRole('button', { name: 'Confirm for Engineer' }).click()

  await expect(consensusPanel.locator('.confirmation-badge.confirmed')).toHaveCount(2)

  await consensusPanel.getByRole('button', { name: 'Mark ready for confirmation' }).click()

  await expect(consensusPanel.locator('.draft-state-badge')).toHaveText('Ready for confirmation')

  await consensusPanel.getByRole('button', { name: 'Approve' }).click()

  await expect(consensusPanel.locator('.draft-state-badge')).toHaveText('Approved')

  await consensusPanel.getByRole('button', { name: 'Activate map' }).click()

  await expect(consensusPanel.locator('.draft-state-badge')).toHaveText('Activated')
  await expect(consensusPanel.getByText('This process map is active.')).toBeVisible()
})
