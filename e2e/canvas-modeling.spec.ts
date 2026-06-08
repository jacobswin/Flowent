import { test, expect } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.evaluate(async () => {
    try { localStorage.clear() } catch { /* noop */ }
    history.replaceState(null, '', '/')
    const res = await fetch('/api/library')
    const body = (await res.json()) as { data: { maps: { id: string }[] } }
    for (const m of body.data.maps) {
      await fetch(`/api/library/maps/${m.id}`, { method: 'DELETE' })
    }
  })
  await page.reload()
})

test('canvas loads with toolbar and title', async ({ page }) => {
  await expect(page.locator('.canvas-title')).toContainText('Flowent')
  await expect(page.locator('.canvas-subtitle')).toContainText('Process maps for aligned product teams')
  await expect(page.locator('.canvas-toolbar')).toBeVisible()
})

test('toolbar exposes the primary actions', async ({ page }) => {
  await expect(page.locator('button[aria-label^="Activity:"]')).toBeVisible()
  await expect(page.locator('button[aria-label^="Decision:"]')).toBeVisible()
  await expect(page.locator('button[aria-label^="End:"]')).toBeVisible()
  await expect(page.locator('button:has-text("Layout")')).toBeVisible()
})

test('clicking toolbar button does not crash', async ({ page }) => {
  await page.goto('/')
  await page.locator('.toolbar-button').first().click()
  await expect(page.locator('.canvas-title')).toBeVisible()
})
