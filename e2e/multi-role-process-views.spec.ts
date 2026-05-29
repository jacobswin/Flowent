import { expect, test } from '@playwright/test'

test('process participants can switch between multi-role views', async ({ page }) => {
  await page.goto('/')

  await page.getByRole('tab', { name: /Process views/ }).click()
  await expect(page.getByRole('heading', { name: 'Manager readiness view' })).toBeVisible()
  await expect(page.getByText('4 activities mapped')).toBeVisible()

  await page.getByRole('tab', { name: /Process owner/ }).click()
  await expect(page.getByRole('tabpanel', { name: /Process owner completeness view/ })).toBeVisible()
  await expect(page.getByRole('heading', { name: /Process owner completeness view/ })).toBeVisible()
  await expect(page.getByText('Support release readiness review has no completion expectations')).toBeVisible()

  await page.getByRole('tab', { name: /Quality review/ }).click()
  await expect(page.getByRole('tabpanel', { name: /Quality review view/ })).toBeVisible()
  await expect(page.getByRole('heading', { name: /Quality review view/ })).toBeVisible()
  await expect(page.getByText('Role navigation expectation note')).toBeVisible()

  await page.getByRole('tab', { name: /Stakeholder/ }).click()
  await expect(page.getByRole('tabpanel', { name: /Stakeholder involvement view/ })).toBeVisible()
  await expect(page.getByRole('heading', { name: /Stakeholder involvement view/ })).toBeVisible()
  await expect(page.getByText('Consulted on 1 activity')).toBeVisible()
  await expect(page.getByText('No informed activities yet')).toBeVisible()
  await expect(page.getByText('Affected by 1 decision')).toBeVisible()
})
