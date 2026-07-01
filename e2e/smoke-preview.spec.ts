import { test, expect } from '@playwright/test'
import { clickPaletteElement } from './canvasDockHelpers'

const pixiCanvas = '.pixi-host canvas'
const statusBar = '.status-bar'

const getPos = (page: import('@playwright/test').Page) =>
  (id: string) =>
    page.evaluate((nodeId: string) => {
      const w = window as unknown as { __flowentGetNodePosition?: (n: string) => { x: number; y: number } | null }
      return w.__flowentGetNodePosition?.(nodeId) ?? null
    }, id)

async function dragNode(
  page: import('@playwright/test').Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
) {
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  for (let i = 1; i <= 8; i++) {
    const t = i / 8
    await page.mouse.move(from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t)
    await page.waitForTimeout(30)
  }
  await page.mouse.up()
  await page.waitForTimeout(200)
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.evaluate(async () => {
    try { localStorage.clear() } catch { /* noop */ }
    history.replaceState(null, '', '/')
    const res = await fetch('/api/library')
    if (!res.ok) throw new Error(`/api/library 반환 ${res.status}`)
    const text = await res.text()
    const body = text ? JSON.parse(text) as { data: { maps: { id: string }[]; folders: { id: string }[] } } : { data: { maps: [], folders: [] } }
    for (const m of body.data.maps) {
      await fetch(`/api/library/maps/${m.id}`, { method: 'DELETE' })
    }
    for (const f of body.data.folders) {
      await fetch(`/api/library/folders/${f.id}`, { method: 'DELETE' })
    }
  })
  await page.reload()
  await page.waitForSelector(pixiCanvas, { timeout: 30000 })
  await page.waitForTimeout(1500)
})

test('preview page loads against the isolated server', async ({ page }) => {
  page.on('pageerror', (err) => console.log('[pageerror]', err.message))
  page.on('console', (msg) => {
    if (msg.type() === 'error') console.log('[console.error]', msg.text())
  })

  await page.keyboard.press('0')
  await page.waitForTimeout(80)

  // Confirm the test helper is wired up.
  const helperPresent = await page.evaluate(() => {
    return typeof (window as unknown as { __flowentGetNodePosition?: unknown }).__flowentGetNodePosition === 'function'
  })
  expect(helperPresent).toBe(true)

  const pos = getPos(page)

  // 1. start node can be dragged
  const startBefore = await pos('start')
  expect(startBefore).toEqual({ x: 360, y: 200 })

  const box = await page.locator(pixiCanvas).boundingBox()
  if (!box) throw new Error('no pixi canvas')

  await dragNode(page, { x: box.x + 420, y: box.y + 228 }, { x: box.x + 420, y: box.y + 400 })

  const startAfter = await pos('start')
  expect(startAfter!.y).toBeGreaterThan(startBefore!.y)

  // 2. add an activity, then drag it
  await clickPaletteElement(page, 'Activity')
  await page.waitForTimeout(150)
  const afterAdd = await page.locator(statusBar).textContent()
  expect(afterAdd).toContain('2 nodes')

  // Activity default is (300, 220) size 220x96 → mid (410, 268).
  await dragNode(page, { x: box.x + 410, y: box.y + 268 }, { x: box.x + 600, y: box.y + 400 })

  // 3. status bar should still show 2 nodes
  const afterDrag = await page.locator(statusBar).textContent()
  expect(afterDrag).toContain('2 nodes')
})
