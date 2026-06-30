import { expect, test } from '@playwright/test'

const pixiHost = '.pixi-host'
const pixiCanvas = '.pixi-host canvas'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.evaluate(async () => {
    try { localStorage.clear() } catch { /* noop */ }
    history.replaceState(null, '', '/')
    const res = await fetch('/api/library')
    const body = (await res.json()) as { data: { maps: { id: string }[]; folders: { id: string }[] } }
    for (const m of body.data.maps) await fetch(`/api/library/maps/${m.id}`, { method: 'DELETE' })
    for (const f of body.data.folders) await fetch(`/api/library/folders/${f.id}`, { method: 'DELETE' })
  })
  await page.reload()
  await page.waitForSelector(pixiCanvas, { timeout: 30000 })
})

test('collapsing the library lets the canvas fill the viewport', async ({ page }) => {
  const before = await page.locator(pixiHost).boundingBox()
  const viewport = page.viewportSize()
  if (!before || !viewport) throw new Error('canvas host or viewport was unavailable')

  expect(before.x).toBeGreaterThanOrEqual(250)
  expect(before.width).toBeLessThanOrEqual(viewport.width - 250)

  await page.getByRole('button', { name: 'Collapse library' }).click()
  const expandLibrary = page.getByRole('button', { name: 'Expand library' })
  await expect(expandLibrary).toBeVisible()

  const after = await page.locator(pixiHost).boundingBox()
  if (!after) throw new Error('canvas host was unavailable after collapse')

  expect(after.x).toBeLessThanOrEqual(1)
  expect(after.width).toBeGreaterThanOrEqual(viewport.width - 1)

  const railBox = await expandLibrary.boundingBox()
  const titleBox = await page.locator('.canvas-title').boundingBox()
  if (!railBox || !titleBox) throw new Error('library rail or title was unavailable')
  expect(titleBox.x).toBeGreaterThanOrEqual(railBox.x + railBox.width + 12)
})
