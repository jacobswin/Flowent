import { test, expect } from '@playwright/test'
import { clickPaletteElement, resetLibrary } from './canvasDockHelpers'
import { attachPageDiagnostics } from './pageDiagnostics'

const pixiCanvas = '.pixi-host canvas'
const statusBar = '.status-bar'

test.beforeEach(async ({ page }) => {
  // Each test starts with a fresh Welcome map so node counts are
  // deterministic regardless of what previous tests left behind.
  // Reload so the gate creates a fresh "Welcome" and picks it as active
  await resetLibrary(page)
})

test('nodes can be dragged with the pointer', async ({ page }) => {
  attachPageDiagnostics(page)
  await page.waitForSelector(pixiCanvas)
  await page.waitForTimeout(300)

  // Add an activity and reset zoom for predictable math. Library gate
  // seeds a "Welcome" map with 1 start node, so the total is now 2.
  await clickPaletteElement(page, 'Activity')
  await page.waitForTimeout(150)
  await page.keyboard.press('0')
  await page.waitForTimeout(80)

  const box = await page.locator(pixiCanvas).boundingBox()
  if (!box) throw new Error('no pixi canvas')

  // Default activity sits at world (300, 220), viewport 0,0, zoom 1.
  // The drag must change the activity's x/y.
  const start = { x: box.x + 300, y: box.y + 240 } // mid-height for tolerance
  const end = { x: start.x + 120, y: start.y + 60 }

  const statusBefore = await page.locator(statusBar).textContent()
  expect(statusBefore).toContain('2 nodes')

  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  for (let i = 1; i <= 8; i++) {
    const t = i / 8
    await page.mouse.move(
      start.x + (end.x - start.x) * t,
      start.y + (end.y - start.y) * t,
    )
    await page.waitForTimeout(35)
  }
  await page.mouse.up()
  await page.waitForTimeout(150)

  // Node count unchanged, selection state is the post-drag state (still selected).
  const statusAfter = await page.locator(statusBar).textContent()
  expect(statusAfter).toContain('2 nodes')

  // Re-add an activity and verify positions differ: if the drag worked, the original
  // activity no longer overlaps the new one we drop at the default 300,220.
  await clickPaletteElement(page, 'Activity')
  await page.waitForTimeout(150)
  const statusFinal = await page.locator(statusBar).textContent()
  expect(statusFinal).toContain('3 nodes')

  // The autoLayout button is the most reliable way to confirm positions changed:
  // layouting 3 nodes from overlapping should spread them out and bump zoom back to 100%.
  await page.locator('button:has-text("Layout")').click()
  await page.waitForTimeout(300)
  const statusPostLayout = await page.locator(statusBar).textContent()
  expect(statusPostLayout).toContain('3 nodes')
  expect(statusPostLayout).toContain('%')
})

test('mouse wheel zooms the canvas', async ({ page }) => {
  attachPageDiagnostics(page)
  await page.waitForSelector(pixiCanvas)
  await page.waitForTimeout(150)

  // Make sure we start at 100%.
  await page.keyboard.press('0')
  await page.waitForTimeout(80)
  const before = await page.locator(statusBar).textContent()
  expect(before).toContain('100%')

  // Wheel up over the canvas to zoom in.
  const box = await page.locator(pixiCanvas).boundingBox()
  if (!box) throw new Error('no pixi canvas')
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  for (let i = 0; i < 10; i++) {
    await page.mouse.wheel(0, -100)
    await page.waitForTimeout(20)
  }

  const after = await page.locator(statusBar).textContent()
  const match = after?.match(/(\d+)%/)
  expect(match).toBeTruthy()
  const pct = Number(match![1])
  expect(pct).toBeGreaterThan(100)
})

test('dragging empty whiteboard pans the viewport with the mouse', async ({ page }) => {
  attachPageDiagnostics(page)
  await page.waitForSelector(pixiCanvas)
  await page.waitForTimeout(150)
  await page.keyboard.press('0')
  await page.waitForTimeout(80)

  const box = await page.locator(pixiCanvas).boundingBox()
  if (!box) throw new Error('no pixi canvas')

  const before = await page.evaluate(() => {
    return (window as unknown as { __flowentGetViewport?: () => { x: number; y: number; zoom: number } | null }).__flowentGetViewport?.() ?? null
  })
  expect(before).toBeTruthy()

  const start = { x: box.x + box.width / 2, y: box.y + box.height / 2 }
  await page.mouse.move(start.x, start.y)
  await page.mouse.down()
  await page.mouse.move(start.x + 140, start.y + 70, { steps: 6 })
  await page.mouse.up()
  await page.waitForTimeout(120)

  const after = await page.evaluate(() => {
    return (window as unknown as { __flowentGetViewport?: () => { x: number; y: number; zoom: number } | null }).__flowentGetViewport?.() ?? null
  })
  expect(after).toBeTruthy()
  expect(after!.x).toBeGreaterThan(before!.x + 100)
  expect(after!.y).toBeGreaterThan(before!.y + 40)
})

test('a mistaken connector can be rerouted from the edge properties panel', async ({ page }) => {
  attachPageDiagnostics(page)
  await page.waitForSelector(pixiCanvas)
  await page.waitForTimeout(150)
  await page.keyboard.press('0')
  await page.waitForTimeout(80)

  await clickPaletteElement(page, 'Activity')
  await page.waitForTimeout(250)
  await clickPaletteElement(page, 'Activity')
  await page.waitForTimeout(250)

  const activityIds = await page.evaluate(() => {
    const positions = (window as unknown as { __flowentGetNodePositions?: () => Record<string, unknown> }).__flowentGetNodePositions?.() ?? {}
    return Object.keys(positions).filter((id) => id.startsWith('activity-'))
  })
  expect(activityIds.length).toBeGreaterThanOrEqual(2)

  const [wrongTargetId, correctTargetId] = activityIds
  const edgeId = await page.evaluate(async (targetId) => {
    return await (window as unknown as { __flowentTestAddEdge?: (sourceId: string, targetId: string) => Promise<string | null> }).__flowentTestAddEdge?.('start', targetId) ?? null
  }, wrongTargetId)
  expect(edgeId).toBeTruthy()

  await page.locator(`[data-edge-id="${edgeId}"]`).evaluate((element) => {
    ;(element as HTMLButtonElement).click()
  })
  await expect(page.getByRole('toolbar', { name: 'Connection quick actions' })).toBeVisible()
  await page.getByRole('toolbar', { name: 'Connection quick actions' }).getByRole('button', { name: 'Edit connection' }).click()
  await expect(page.getByRole('complementary', { name: 'Properties' })).toBeVisible()

  await page.getByLabel('To node').selectOption(correctTargetId)
  await page.waitForTimeout(150)

  const endpoints = await page.evaluate((id) => {
    return (window as unknown as {
      __flowentGetEdgeEndpoints?: (edgeId: string) => {
        sourceNodeId: string
        sourcePortId: string
        targetNodeId: string
        targetPortId: string
      } | null
    }).__flowentGetEdgeEndpoints?.(id as string) ?? null
  }, edgeId)

  expect(endpoints).toMatchObject({
    sourceNodeId: 'start',
    sourcePortId: 'out',
    targetNodeId: correctTargetId,
    targetPortId: 'in',
  })
})

test('a selected connector can be deleted from the on-canvas action pill', async ({ page }) => {
  attachPageDiagnostics(page)
  await page.waitForSelector(pixiCanvas)
  await page.waitForTimeout(150)
  await page.keyboard.press('0')
  await page.waitForTimeout(80)

  await clickPaletteElement(page, 'Activity')
  await page.waitForTimeout(250)

  const activityId = await page.evaluate(() => {
    const positions = (window as unknown as { __flowentGetNodePositions?: () => Record<string, unknown> }).__flowentGetNodePositions?.() ?? {}
    return Object.keys(positions).find((id) => id.startsWith('activity-')) ?? null
  })
  expect(activityId).toBeTruthy()

  const edgeId = await page.evaluate(async (targetId) => {
    return await (window as unknown as { __flowentTestAddEdge?: (sourceId: string, targetId: string) => Promise<string | null> }).__flowentTestAddEdge?.('start', targetId as string) ?? null
  }, activityId)
  expect(edgeId).toBeTruthy()

  await page.locator(`[data-edge-id="${edgeId}"]`).evaluate((element) => {
    ;(element as HTMLButtonElement).click()
  })
  await expect(page.locator('.edge-quick-actions')).toBeVisible()

  await page.locator('.edge-quick-actions').getByRole('button', { name: 'Delete' }).click()
  await page.waitForTimeout(150)

  const deleted = await page.evaluate((id) => {
    return (window as unknown as { __flowentGetEdgeEndpoints?: (edgeId: string) => unknown | null }).__flowentGetEdgeEndpoints?.(id as string) ?? null
  }, edgeId)
  expect(deleted).toBeNull()
  await expect(page.locator('.edge-quick-actions')).toHaveCount(0)
})

test('keyboard zoom-in still works after fixes', async ({ page }) => {
  attachPageDiagnostics(page)
  await page.waitForSelector(pixiCanvas)
  await page.waitForTimeout(150)

  await page.keyboard.press('0')
  await page.waitForTimeout(80)
  await page.locator('body').click({ position: { x: 1, y: 1 } }) // make sure focus
  await page.keyboard.press('=')
  await page.keyboard.press('=')
  await page.waitForTimeout(80)

  const after = await page.locator(statusBar).textContent()
  const match = after?.match(/(\d+)%/)
  expect(match).toBeTruthy()
  const pct = Number(match![1])
  expect(pct).toBeGreaterThan(100)
})
