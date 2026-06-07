import { test, expect } from '@playwright/test'

const pixiCanvas = '.pixi-host canvas'
const statusBar = '.status-bar'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.evaluate(async () => {
    try { localStorage.clear() } catch { /* noop */ }
    history.replaceState(null, '', '/')
    const res = await fetch('/api/library')
    const body = (await res.json()) as { data: { maps: { id: string }[] } }
    for (const map of body.data.maps) {
      await fetch(`/api/library/maps/${map.id}`, { method: 'DELETE' })
    }
  })
  await page.reload()
  await page.waitForSelector(pixiCanvas)
})

test('palette quick-creates a process node on the start map', async ({ page }) => {
  await expect(page.locator(statusBar)).toContainText('1 nodes')

  await page.getByRole('button', { name: /^Activity:/i }).click()

  const status = await page.locator(statusBar).textContent()
  expect(status ?? '').toMatch(/2 nodes/)
  // quickCreate without a selected source places a node at the fallback
  // position and does not add a handoff edge.
  expect(status ?? '').not.toMatch(/[1-9]\d* edges?/i)
})

test('palette bottleneck button adds a semantic node and surfaces diagnostics', async ({ page }) => {
  await page.getByRole('button', { name: /^Bottleneck:/i }).click()

  await expect(page.locator(statusBar)).toContainText('2 nodes')
  await expect(page.getByText('Alignment checklist')).toBeVisible()
})

test('focus bar exposes decision and bottleneck readability modes', async ({ page }) => {
  await page.getByRole('button', { name: 'Decisions' }).click()
  await expect(page.getByRole('button', { name: 'Decisions' })).toHaveClass(/active/)

  await page.getByRole('button', { name: 'Bottlenecks' }).click()
  await expect(page.getByRole('button', { name: 'Bottlenecks' })).toHaveClass(/active/)
})

test('export button triggers an SVG download of the current map', async ({ page }) => {
  // Intercept downloads so the test doesn't actually save a file to disk.
  const downloadPromise = page.waitForEvent('download', { timeout: 5000 })

  await page.getByRole('button', { name: /export map as svg/i }).click()

  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/^flowent-process-map-.*\.svg$/)

  // Validate the downloaded SVG payload is well-formed.
  const path = await download.path()
  if (path) {
    const fs = await import('node:fs/promises')
    const svg = await fs.readFile(path, 'utf8')
    expect(svg.startsWith('<?xml')).toBe(true)
    expect(svg).toContain('<svg')
    expect(svg).toContain('</svg>')
  }
})
