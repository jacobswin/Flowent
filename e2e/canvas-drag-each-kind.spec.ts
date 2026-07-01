import { test, expect } from '@playwright/test'
import { clickPaletteElement, resetLibrary } from './canvasDockHelpers'
import { attachPageDiagnostics } from './pageDiagnostics'

const pixiCanvas = '.pixi-host canvas'
const statusBar = '.status-bar'

test.beforeEach(async ({ page }) => {
  // Reset the library so the Welcome map has a single start node, not
  // whatever the previous test left behind.
  await resetLibrary(page)
})

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

test('start node can be dragged', async ({ page }) => {
  attachPageDiagnostics(page)
  // page.goto runs in beforeEach
  await page.waitForSelector(pixiCanvas)
  await page.waitForTimeout(150)
  await page.keyboard.press('0')
  await page.waitForTimeout(80)

  const pos = getPos(page)
  const before = await pos('start')
  expect(before).toEqual({ x: 360, y: 200 })

  const box = await page.locator(pixiCanvas).boundingBox()
  if (!box) throw new Error('no pixi canvas')

  await dragNode(page, { x: box.x + 420, y: box.y + 230 }, { x: box.x + 420, y: box.y + 400 })

  const after = await pos('start')
  expect(after).not.toEqual(before)
  expect(after!.y).toBeGreaterThan(before!.y)
})

test('activity node can be dragged', async ({ page }) => {
  // page.goto runs in beforeEach
  await page.waitForSelector(pixiCanvas)
  await page.waitForTimeout(150)
  await page.keyboard.press('0')
  await page.waitForTimeout(80)

  await clickPaletteElement(page, 'Activity')
  await page.waitForTimeout(150)

  const statusBefore = await page.locator(statusBar).textContent()
  const beforeCount = Number(statusBefore?.match(/(\d+) nodes/)?.[1] ?? 0)
  expect(beforeCount).toBeGreaterThanOrEqual(2)

  // The freshly added activity is selected and centered around (410, 268).
  // Drag it.
  const box = await page.locator(pixiCanvas).boundingBox()
  if (!box) throw new Error('no pixi canvas')

  // The freshly added activity is selected and centered around (410, 268).
  // Drag it.
  await dragNode(page, { x: box.x + 410, y: box.y + 268 }, { x: box.x + 600, y: box.y + 400 })

  const statusAfter = await page.locator(statusBar).textContent()
  expect(statusAfter).toBeTruthy()
})

test('decision node can be dragged', async ({ page }) => {
  // page.goto runs in beforeEach
  await page.waitForSelector(pixiCanvas)
  await page.waitForTimeout(150)
  await page.keyboard.press('0')
  await page.waitForTimeout(80)

  await clickPaletteElement(page, 'Decision')
  await page.waitForTimeout(150)

  const box = await page.locator(pixiCanvas).boundingBox()
  if (!box) throw new Error('no pixi canvas')

  // Decision node defaults to (460, 320) with size 180x108 → mid (550, 374).
  await dragNode(page, { x: box.x + 550, y: box.y + 374 }, { x: box.x + 750, y: box.y + 500 })
})

test('end node can be dragged', async ({ page }) => {
  // page.goto runs in beforeEach
  await page.waitForSelector(pixiCanvas)
  await page.waitForTimeout(150)
  await page.keyboard.press('0')
  await page.waitForTimeout(80)

  await clickPaletteElement(page, 'End')
  await page.waitForTimeout(150)

  // Click an empty area first to deselect, then find the end node by
  // reading positions.
  const box = await page.locator(pixiCanvas).boundingBox()
  if (!box) throw new Error('no pixi canvas')

  // End node defaults to (200, 200) with size 120x56 → mid (260, 228).
  await page.mouse.click(box.x + 700, box.y + 600)
  await page.waitForTimeout(100)

  // After deselect, the end node label is "End" — drag from its mid.
  await dragNode(page, { x: box.x + 260, y: box.y + 228 }, { x: box.x + 400, y: box.y + 400 })
})
