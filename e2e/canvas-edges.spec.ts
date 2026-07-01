import { test, expect } from '@playwright/test'
import { clickPaletteElement } from './canvasDockHelpers'

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
  await clickPaletteElement(page, 'Activity')
  await page.waitForTimeout(120)
  // The current branch's "add activity" path is the ProcessElementPalette
  // tile whose accessible name starts with "Activity:". We use the
  // aria-label prefix to avoid matching the alignment-diagnostic
  // buttons (which start with "Activity needs" / "Activity expectation").
  await clickPaletteElement(page, 'Activity')
  await page.waitForTimeout(120)

  const statusBefore = await page.locator(statusBar).textContent()
  expect(statusBefore).toContain('3 nodes')
  // The current branch auto-connects one of the new activities to
  // start via quickCreate, so we may already have 1 edge before
  // the manual port drag. Accept either state.
  expect(statusBefore).toMatch(/[01] edges/)
  const edgeCountBefore = Number(statusBefore?.match(/(\d+) edges/)?.[1] ?? 0)

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

  const sbBefore = await page.locator(statusBar).textContent()
  expect(sbBefore).toContain('3 nodes')

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

  expect(statusAfter).toContain('3 nodes')
  const edgeCountAfter = Number(statusAfter?.match(/(\d+) edges/)?.[1] ?? 0)
  expect(edgeCountAfter).toBe(edgeCountBefore + 1)
})

test('dragging from a right-side endpoint to blank canvas opens a type picker and creates a connected node', async ({ page }) => {
  page.on('pageerror', (err) => console.log('[pageerror]', err.message))
  await page.waitForSelector(pixiCanvas)
  await page.waitForTimeout(200)
  await page.keyboard.press('0')
  await page.waitForTimeout(80)

  const box = await page.locator(pixiCanvas).boundingBox()
  if (!box) throw new Error('no pixi canvas')

  const startPosition = await page.evaluate(() => window.__flowentGetNodePosition?.('start'))
  if (!startPosition) throw new Error('no start node position')

  const outX = box.x + startPosition.x + 120
  const outY = box.y + startPosition.y + 28
  const dropX = outX + 360
  const dropY = outY + 20

  await page.mouse.move(outX, outY)
  await page.mouse.down()
  await page.mouse.move(dropX, dropY, { steps: 8 })
  await page.mouse.up()

  const picker = page.getByRole('menu', { name: /choose next node type/i })
  await expect(picker).toBeVisible()
  await picker.getByRole('menuitem', { name: /decision/i }).click()
  await page.waitForTimeout(200)

  const statusAfter = await page.locator(statusBar).textContent()
  expect(statusAfter).toContain('2 nodes')
  expect(statusAfter).toContain('1 edges')
})

test('clicking the selected node plus handle opens Plus Create and creates a connected node', async ({ page }) => {
  await page.waitForSelector(pixiCanvas)
  await page.waitForTimeout(200)
  await page.keyboard.press('0')
  await page.waitForTimeout(80)

  const box = await page.locator(pixiCanvas).boundingBox()
  if (!box) throw new Error('no pixi canvas')

  const startPosition = await page.evaluate(() => window.__flowentGetNodePosition?.('start'))
  if (!startPosition) throw new Error('no start node position')

  await page.mouse.click(box.x + startPosition.x + 60, box.y + startPosition.y + 28)

  const quickConnect = page.getByRole('button', { name: /quick connect from start/i })
  await expect(quickConnect).toBeVisible()
  await quickConnect.click()

  const picker = page.getByRole('menu', { name: /choose next node type/i })
  await expect(picker).toBeVisible()
  await picker.getByRole('menuitem', { name: /activity/i }).click()
  await page.waitForTimeout(200)

  const statusAfter = await page.locator(statusBar).textContent()
  expect(statusAfter).toContain('2 nodes')
  expect(statusAfter).toContain('1 edges')
})

test('selecting an edge keeps editing behind explicit quick actions', async ({ page }) => {
  await page.waitForSelector(pixiCanvas)
  await page.waitForTimeout(200)
  await page.keyboard.press('0')
  await page.waitForTimeout(80)

  const box = await page.locator(pixiCanvas).boundingBox()
  if (!box) throw new Error('no pixi canvas')
  const hostBox = await page.locator('.pixi-host').boundingBox()
  if (!hostBox) throw new Error('no pixi host')

  const startPosition = await page.evaluate(() => window.__flowentGetNodePosition?.('start'))
  if (!startPosition) throw new Error('no start node position')

  await page.mouse.click(box.x + startPosition.x + 60, box.y + startPosition.y + 28)

  const quickConnect = page.getByRole('button', { name: /quick connect from start/i })
  await expect(quickConnect).toBeVisible()
  await quickConnect.click()

  const picker = page.getByRole('menu', { name: /choose next node type/i })
  await expect(picker).toBeVisible()
  await picker.getByRole('menuitem', { name: /activity/i }).click()
  await page.waitForTimeout(250)

  const edgeId = await page.evaluate(() => Object.keys(window.__flowentGetEdgeRoutes?.() ?? {})[0] ?? null)
  if (!edgeId) throw new Error('no edge id')

  const center = await page.evaluate((id) => window.__flowentGetEdgeLabelCenter?.(id), edgeId)
  const viewport = await page.evaluate(() => window.__flowentGetViewport?.())
  if (!center || !viewport) throw new Error('missing edge center')
  const edgeCenterX = hostBox.x + viewport.x + center.x * viewport.zoom
  const edgeCenterY = hostBox.y + viewport.y + center.y * viewport.zoom

  await page.locator(`[data-edge-id="${edgeId}"]`).evaluate((element) => {
    ;(element as HTMLButtonElement).click()
  })

  const labelEditor = page.getByRole('textbox', { name: /edit connection label/i })
  await expect(labelEditor).not.toBeVisible()

  const quickActions = page.getByRole('toolbar', { name: /connection quick actions/i })
  await expect(quickActions).toBeVisible()
  const quickActionsBox = await quickActions.boundingBox()
  if (!quickActionsBox) throw new Error('missing connection quick actions box')
  const quickActionsCenterX = quickActionsBox.x + quickActionsBox.width / 2
  const quickActionsGapAboveEdge = edgeCenterY - (quickActionsBox.y + quickActionsBox.height)
  expect(Math.abs(quickActionsCenterX - edgeCenterX)).toBeLessThanOrEqual(4)
  expect(quickActionsGapAboveEdge).toBeGreaterThanOrEqual(22)
  expect(quickActionsGapAboveEdge).toBeLessThanOrEqual(26)
  await quickActions.getByRole('button', { name: 'Label' }).click()
  await expect(labelEditor).toBeVisible()
  const labelEditorBox = await labelEditor.boundingBox()
  if (!labelEditorBox) throw new Error('missing label editor box')
  const labelCenterX = labelEditorBox.x + labelEditorBox.width / 2
  const labelGapAboveEdge = edgeCenterY - (labelEditorBox.y + labelEditorBox.height)
  expect(Math.abs(labelCenterX - edgeCenterX)).toBeLessThanOrEqual(4)
  expect(labelGapAboveEdge).toBeGreaterThanOrEqual(22)
  expect(labelGapAboveEdge).toBeLessThanOrEqual(26)
  await labelEditor.fill('PM handoff')
  await labelEditor.press('Enter')

  await expect.poll(async () => {
    return page.evaluate((id) => window.__flowentGetEdge?.(id)?.label ?? '', edgeId)
  }).toBe('PM handoff')

  const redSwatch = quickActions.getByRole('button', { name: /set connection color red/i })
  await redSwatch.click()
  await expect(redSwatch).toHaveAttribute('aria-pressed', 'true')
})

test('double-clicking a node keeps editing behind explicit quick actions', async ({ page }) => {
  await page.waitForSelector(pixiCanvas)
  await page.waitForTimeout(200)
  await page.keyboard.press('0')
  await page.waitForTimeout(80)

  await clickPaletteElement(page, 'Activity')
  await page.waitForTimeout(200)

  const box = await page.locator(pixiCanvas).boundingBox()
  if (!box) throw new Error('no pixi canvas')
  const hostBox = await page.locator('.pixi-host').boundingBox()
  if (!hostBox) throw new Error('no pixi host')

  const positions = await page.evaluate(() => window.__flowentGetNodePositions?.() ?? {})
  const activityId = Object.keys(positions).find((id) => id.startsWith('activity-'))
  if (!activityId) throw new Error('no activity node')
  const activityPosition = await page.evaluate((id) => window.__flowentGetNodePosition?.(id), activityId)
  const activityBounds = await page.evaluate((id) => window.__flowentGetNodeBounds?.(id), activityId)
  const viewport = await page.evaluate(() => window.__flowentGetViewport?.())
  if (!activityPosition || !activityBounds || !viewport) throw new Error('missing activity position')

  await page.mouse.dblclick(box.x + activityPosition.x + 110, box.y + activityPosition.y + 48)

  await expect(page.getByRole('complementary', { name: /properties/i })).not.toBeVisible()
  const nodeActions = page.getByRole('toolbar', { name: /node quick actions/i })
  await expect(nodeActions).toBeVisible()
  const nodeActionsBox = await nodeActions.boundingBox()
  if (!nodeActionsBox) throw new Error('missing node quick actions box')
  const nodeCenterX = hostBox.x + viewport.x + (activityBounds.x + activityBounds.width / 2) * viewport.zoom
  const actionsCenterX = nodeActionsBox.x + nodeActionsBox.width / 2
  const nodeTopY = hostBox.y + viewport.y + activityBounds.y * viewport.zoom
  const gapAboveNode = nodeTopY - (nodeActionsBox.y + nodeActionsBox.height)
  expect(Math.abs(actionsCenterX - nodeCenterX)).toBeLessThanOrEqual(4)
  expect(gapAboveNode).toBeGreaterThanOrEqual(4)
  expect(gapAboveNode).toBeLessThanOrEqual(8)
  await nodeActions.getByRole('button', { name: /edit node/i }).click()

  await expect(page.getByRole('complementary', { name: /properties/i })).toBeVisible()
  await expect(page.getByLabel('Title')).toHaveValue('New activity')
})

test('dragging the selected node plus handle to an existing node connects them', async ({ page }) => {
  await page.waitForSelector(pixiCanvas)
  await page.waitForTimeout(200)
  await page.keyboard.press('0')
  await page.waitForTimeout(80)

  await clickPaletteElement(page, 'Activity')
  await page.waitForTimeout(160)

  const box = await page.locator(pixiCanvas).boundingBox()
  if (!box) throw new Error('no pixi canvas')
  const hostBox = await page.locator('.pixi-host').boundingBox()
  if (!hostBox) throw new Error('no pixi host')

  const positions = await page.evaluate(() => window.__flowentGetNodePositions?.() ?? {})
  const activityId = Object.keys(positions).find((id) => id.startsWith('activity-'))
  if (!activityId) throw new Error('no activity node')

  const startPosition = await page.evaluate(() => window.__flowentGetNodePosition?.('start'))
  const activityPosition = await page.evaluate((id) => window.__flowentGetNodePosition?.(id), activityId)
  if (!startPosition || !activityPosition) throw new Error('missing node position')

  // The selected activity's above-node toolbar can overlap the center of the
  // nearby Start node, so pick a visible left-side point on Start.
  await page.mouse.click(hostBox.x + startPosition.x + 4, hostBox.y + startPosition.y + 28)

  const quickConnect = page.getByRole('button', { name: /quick connect from start/i })
  await expect(quickConnect).toBeVisible()
  const handleBox = await quickConnect.boundingBox()
  if (!handleBox) throw new Error('no quick connect handle')

  const targetX = box.x + activityPosition.x + 110
  const targetY = box.y + activityPosition.y + 56

  await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(targetX, targetY, { steps: 10 })
  await page.mouse.up()
  await page.waitForTimeout(250)

  const statusAfter = await page.locator(statusBar).textContent()
  expect(statusAfter).toContain('2 nodes')
  expect(statusAfter).toContain('1 edges')
})
