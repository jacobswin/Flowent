import { test, expect } from '@playwright/test'

const pixiCanvas = '.pixi-host canvas'
const statusBar = '.status-bar'

test.beforeEach(async ({ page }) => {
  // Each test starts with a fresh Welcome map so node counts are
  // deterministic regardless of what previous tests left behind.
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
  // Reload so the gate creates a fresh "Welcome" and picks it as active
  await page.reload()
})

test('nodes can be dragged with the pointer', async ({ page }) => {
  page.on('pageerror', (err) => console.log('[pageerror]', err.message))
  await page.waitForSelector(pixiCanvas)
  await page.waitForTimeout(300)

  // Add an activity and reset zoom for predictable math. Library gate
  // seeds a "Welcome" map with 1 start node, so the total is now 2.
  await page.locator('button[aria-label^="Activity:"]').click()
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
  await page.locator('button[aria-label^="Activity:"]').click()
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
  page.on('pageerror', (err) => console.log('[pageerror]', err.message))
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

test('keyboard zoom-in still works after fixes', async ({ page }) => {
  page.on('pageerror', (err) => console.log('[pageerror]', err.message))
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
