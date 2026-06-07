import { test, expect } from '@playwright/test'

const pixiCanvas = '.pixi-host canvas'
const statusBar = '.status-bar'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.waitForSelector('body')
  await page.evaluate(async () => {
    try { localStorage.clear() } catch { /* noop */ }
    history.replaceState(null, '', '/')
    const res = await fetch('/api/library')
    if (!res.ok) throw new Error(`/api/library 返回 ${res.status}`)
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
  // Wait for PIXI init + the React CanvasHost to attach pointermove
  // listeners on the PIXI canvas.
  await page.waitForSelector(pixiCanvas, { timeout: 30000 })
  await page.waitForTimeout(1500)
})

test('marquee at zoom 1 selects the start node when dragged over it', async ({ page }) => {
  // The Welcome starter map has a single `start` node at world (360, 200).
  // The default zoom is 100% so screen coords == world coords (offset
  // by box.left/top). A drag from (10, 10) to (box.width-10, box.height-10)
  // in screen space covers the entire visible world, including the
  // start node.
  const box = await page.locator(pixiCanvas).boundingBox()
  if (!box) throw new Error('no canvas')

  await page.mouse.click(box.x + 5, box.y + 5)
  await page.waitForTimeout(80)
  await page.mouse.move(box.x + 10, box.y + 10)
  await page.mouse.down()
  await page.waitForTimeout(80)
  for (let i = 1; i <= 8; i++) {
    const t = i / 8
    await page.mouse.move(box.x + 10 + (box.width - 20) * t, box.y + 10 + (box.height - 20) * t)
    await page.waitForTimeout(40)
  }
  // End the drag well inside the canvas so pointerup lands on the canvas.
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.waitForTimeout(40)
  await page.mouse.up()
  await page.waitForTimeout(200)

  // The Welcome map has just the start node — it should be selected.
  await expect(page.locator(statusBar)).toContainText('1 selected')
})

test('marquee at zoom 2 still selects nodes in world space (regression)', async ({ page }) => {
  // Add an activity so the canvas has at least one non-start node. We
  // use the default world position (300, 220) — at zoom 200% without
  // panning this still sits in the visible upper-left quadrant of the
  // world.
  await page.getByRole('button', { name: 'Activity' }).first().click()
  await page.waitForTimeout(300)
  // Each '=' press zooms by 1.2x; press 3 times to overshoot 200% in
  // case of step granularity. The test only cares about the world-coord
  // conversion, not the exact zoom factor.
  await page.keyboard.press('=')
  await page.keyboard.press('=')
  await page.keyboard.press('=')
  await page.waitForTimeout(150)

  const box = await page.locator(pixiCanvas).boundingBox()
  if (!box) throw new Error('no canvas')
  // We don't assert a specific zoom — only that it's > 100%, which is
  // enough to verify the world-coord fix on the marquee rect.
  const zoomText = await page.locator(statusBar).textContent()
  const zoomMatch = zoomText?.match(/(\d+)%/)
  expect(Number(zoomMatch![1])).toBeGreaterThan(100)

  // Drag a marquee covering the upper-left working area. The canvas now sizes
  // to the library grid column instead of 100vw, so use a wider percentage to
  // cover the same world area at zoom ≥1.7x and include the activity at
  // world (300, 220).
  await page.mouse.click(box.x + box.width - 50, box.y + box.height - 50)
  await page.waitForTimeout(80)
  const endX = box.x + box.width * 0.7
  const endY = box.y + box.height * 0.7
  await page.mouse.move(box.x + 10, box.y + 10)
  await page.mouse.down()
  await page.waitForTimeout(80)
  await page.mouse.move(endX, endY, { steps: 8 })
  await page.mouse.move(endX, endY)
  await page.waitForTimeout(40)
  await page.mouse.up()
  await page.waitForTimeout(200)

  // Should select at least one node.
  const status = await page.locator(statusBar).textContent()
  const match = status?.match(/(\d+) selected/)
  expect(match, `expected at least one selection in: ${status}`).toBeTruthy()
  expect(Number(match![1])).toBeGreaterThan(0)
})
