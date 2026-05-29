import { expect, test } from '@playwright/test'

test('R&D member can navigate the process by role', async ({ page }) => {
  await page.goto('/')

  const roleNavigation = page.getByRole('tabpanel', { name: 'Role navigation' })

  await expect(roleNavigation.getByRole('heading', { name: 'Frontend Engineer' })).toBeVisible()
  await expect(roleNavigation.getByText('Approved change request', { exact: true })).toBeVisible()
  await expect(roleNavigation.getByText('Frontend hands build to QA', { exact: true })).toBeVisible()

  await roleNavigation.getByRole('button', { name: /QA Engineer/ }).click()

  await expect(roleNavigation.getByRole('heading', { name: 'QA Engineer' })).toBeVisible()
  await expect(roleNavigation.getByText('Validate change behavior')).toBeVisible()
  await expect(roleNavigation.getByText('Validation result explains release risk')).toBeVisible()
})
