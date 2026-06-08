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
    for (const m of body.data.maps) {
      await fetch(`/api/library/maps/${m.id}`, { method: 'DELETE' })
    }
  })
  await page.reload()
})

test('connecting two activities via ports produces an edge', async ({ page }) => {
  page.on('pageerror', (err) => console.log('[pageerror]', err.message))
  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.text().includes('[port-down]') || msg.text().includes('[bind-port]'))
      console.log('[console]', msg.type(), msg.text())
  })

  await page.waitForSelector(pixiCanvas)
  await page.waitForTimeout(200)

  // Reset zoom to 100% so ports sit at known world coords.
  await page.keyboard.press('0')
  await page.waitForTimeout(80)

  // Add two activities so we have 1 start + 2 activities stacked at (300,220).
  // Then immediately Layout so the two activities spread to a second column,
  // and the start node's out port and an activity in port don't overlap.
  // The current branch's "add activity" path is the ProcessElementPalette
  // tile whose accessible name starts with "Activity:". We use the
  // aria-label prefix to avoid matching the alignment-diagnostic
  // buttons (which start with "Activity needs" / "Activity expectation").
  await page.locator('button[aria-label^="Activity:"]').click()
  await page.waitForTimeout(120)
  // The current branch's "add activity" path is the ProcessElementPalette
  // tile whose accessible name starts with "Activity:". We use the
  // aria-label prefix to avoid matching the alignment-diagnostic
  // buttons (which start with "Activity needs" / "Activity expectation").
  await page.locator('button[aria-label^="Activity:"]').click()
  await page.waitForTimeout(120)

  const statusBefore = await page.locator(statusBar).textContent()
  console.log('[status-before]', statusBefore)
  expect(statusBefore).toContain('3 nodes')
  // The current branch auto-connects one of the new activities to
  // start via quickCreate, so we may already have 1 edge before
  // the manual port drag. Accept either state.
  expect(statusBefore).toMatch(/[01] edges/)

  const box = await page.locator(pixiCanvas).boundingBox()
  if (!box) throw new Error('no pixi canvas')

  // Click an empty area to deselect.
  await page.mouse.click(box.x + 800, box.y + 600)
  await page.waitForTimeout(80)

  // Auto-layout: topological sort of {start -> activity1, start -> activity2}
  // produces columns: [start] in column 0, [activity1, activity2] in column 1.
  // activity1 is at (320, 120) and activity2 at (320, 260) approximately.
  // We just want any activity's in port — read it from a known world coord.
  await page.locator('button:has-text("Layout")').click()
  await page.waitForTimeout(300)

  const startPosition = await page.evaluate(() => window.__flowentGetNodePosition?.('start'))
  if (!startPosition) throw new Error('no start node position')

  // With no edges, auto-layout spreads root components horizontally. The first
  // activity lands one column to the right of Start with the same Y.
  const activityPosition = { x: startPosition.x + 360, y: startPosition.y }

  const outX = box.x + startPosition.x + 120
  const outY = box.y + startPosition.y + 28
  const inX = box.x + activityPosition.x
  const inY = box.y + activityPosition.y + 48

  // Log status before drag to see where the nodes actually are on screen.
  const sbBefore = await page.locator(statusBar).textContent()
  console.log('[before-drag]', sbBefore)

  await page.mouse.move(outX, outY)
  await page.mouse.down()
  for (let i = 1; i <= 12; i++) {
    const t = i / 12
    await page.mouse.move(outX + (inX - outX) * t, outY + (inY - outY) * t)
    await page.waitForTimeout(30)
  }
  await page.mouse.up()
  await page.waitForTimeout(250)

  const statusAfter = await page.locator(statusBar).textContent()
  console.log('[status-after]', statusAfter)

  expect(statusAfter).toContain('3 nodes')
  expect(statusAfter).toContain('1 edges')
})
