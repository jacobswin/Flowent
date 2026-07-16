import { test, expect } from '@playwright/test'
import { clickPaletteElement, expandDockPanel } from './canvasDockHelpers'

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

  await clickPaletteElement(page, 'Activity')

  const status = await page.locator(statusBar).textContent()
  expect(status ?? '').toMatch(/2 nodes/)
  // quickCreate without a selected source places a node at the fallback
  // position and does not add a handoff edge.
  expect(status ?? '').not.toMatch(/[1-9]\d* edges?/i)
})

test('palette bottleneck button adds a semantic node and surfaces diagnostics', async ({ page }) => {
  await clickPaletteElement(page, 'Bottleneck')

  await expect(page.locator(statusBar)).toContainText('2 nodes')
  await expect(page.getByRole('button', { name: 'Expand Alignment' })).toBeVisible()
})

test('focus bar exposes decision and bottleneck readability modes', async ({ page }) => {
  await expandDockPanel(page, 'Focus view')
  await page.getByRole('button', { name: 'Decision points' }).click()
  await expect(page.getByRole('button', { name: 'Decision points' })).toHaveClass(/active/)

  await page.getByRole('button', { name: 'Bottlenecks' }).click()
  await expect(page.getByRole('button', { name: 'Bottlenecks' })).toHaveClass(/active/)
})

test('Export downloads SVG, PDF, PNG, JPG, and a Flowent JSON backup', async ({ page }) => {
  const exportFormat = async (label: 'SVG' | 'PDF' | 'PNG' | 'JPG' | 'Flowent JSON') => {
    const downloadPromise = page.waitForEvent('download', { timeout: 15_000 })
    await page.getByRole('button', { name: /^export map$/i }).click()
    await page.getByRole('menuitem', { name: label }).click()
    return downloadPromise
  }

  const fs = await import('node:fs/promises')

  const svg = await exportFormat('SVG')
  expect(svg.suggestedFilename()).toMatch(/^flowent-.*\.svg$/)
  const svgPath = await svg.path()
  if (svgPath) {
    const content = await fs.readFile(svgPath, 'utf8')
    expect(content.startsWith('<?xml')).toBe(true)
    expect(content).toContain('<svg')
  }

  const pdf = await exportFormat('PDF')
  expect(pdf.suggestedFilename()).toMatch(/^flowent-.*\.pdf$/)
  const pdfPath = await pdf.path()
  if (pdfPath) expect((await fs.readFile(pdfPath)).subarray(0, 4).toString()).toBe('%PDF')

  const png = await exportFormat('PNG')
  expect(png.suggestedFilename()).toMatch(/^flowent-.*\.png$/)
  const pngPath = await png.path()
  if (pngPath) expect((await fs.readFile(pngPath)).subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a')

  const jpg = await exportFormat('JPG')
  expect(jpg.suggestedFilename()).toMatch(/^flowent-.*\.jpg$/)
  const jpgPath = await jpg.path()
  if (jpgPath) expect((await fs.readFile(jpgPath)).subarray(0, 2).toString('hex')).toBe('ffd8')

  const backup = await exportFormat('Flowent JSON')
  expect(backup.suggestedFilename()).toMatch(/^flowent-.*\.flowent\.json$/)
  const backupPath = await backup.path()
  if (backupPath) {
    const data = JSON.parse(await fs.readFile(backupPath, 'utf8')) as { format: string; version: number; document: unknown }
    expect(data.format).toBe('flowent-map')
    expect(data.version).toBe(1)
    expect(data.document).toBeTruthy()
  }
})
