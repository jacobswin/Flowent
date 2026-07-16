import { test, expect } from '@playwright/test'
import { expandDockPanel } from './canvasDockHelpers'

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
  await expect(page.locator('.library-title')).toContainText('Flowent')
  await expect(page.locator('.canvas-control-rail .canvas-title')).toHaveCount(0)
  await expect(page.locator('.canvas-toolbar')).toBeVisible()
})

test('toolbar exposes the primary actions', async ({ page }) => {
  await expect(page.getByRole('button', { name: 'Expand Elements' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Expand Alignment' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Expand Assets' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Expand Focus view' })).toBeVisible()
  await expect(page.locator('button[aria-label^="Activity:"]')).toHaveCount(0)
  await expandDockPanel(page, 'Elements')
  await expect(page.locator('button[aria-label^="Activity:"]')).toBeVisible()
  await expect(page.locator('button[aria-label^="Decision:"]')).toBeVisible()
  await expect(page.locator('button[aria-label^="End:"]')).toBeVisible()
  await expect(page.getByRole('button', { name: /flow layout/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /swimlane layout/i })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Connect', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Zoom in' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Zoom out' })).toBeVisible()
})

test('clicking toolbar button does not crash', async ({ page }) => {
  await page.goto('/')
  await page.locator('.toolbar-button').first().click()
  await expect(page.locator('.library-title')).toContainText('Flowent')
})
