import { test, expect } from '@playwright/test'

test('canvas loads with toolbar and title', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('.canvas-title')).toContainText('Flowent')
  await expect(page.locator('.canvas-subtitle')).toContainText('Process maps for aligned product teams')
  await expect(page.locator('.canvas-toolbar')).toBeVisible()
})

test('toolbar has all required buttons', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('.toolbar-button')).toHaveCount(4) // Activity, Decision, End, Layout
  await expect(page.locator('.toolbar-button').first()).toHaveText(/Activity/)
  await expect(page.locator('.toolbar-button').nth(1)).toHaveText(/Decision/)
  await expect(page.locator('.toolbar-button').nth(2)).toHaveText(/End/)
  await expect(page.locator('button:has-text("Layout")')).toBeVisible()
})

test('clicking toolbar button does not crash', async ({ page }) => {
  await page.goto('/')
  await page.locator('.toolbar-button').first().click()
  await expect(page.locator('.canvas-title')).toBeVisible()
})
