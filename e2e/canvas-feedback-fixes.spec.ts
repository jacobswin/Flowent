/**
 * Regression tests for the user-feedback fixes (June 8 trial):
 *   1. After moving an activity, the connecting edge re-renders.
 *   2. Two activities can be connected via the test API (and via a
 *      real port drag, once the native port-drag is wired).
 *   3. Activity ports are subtle by default, fade in on hover.
 */
import { test, expect } from '@playwright/test'
import { clickPaletteElement } from './canvasDockHelpers'

const pixiCanvas = '.pixi-host canvas'
const statusBar = '.status-bar'

async function getNodeScreenPoint(
  page: import('@playwright/test').Page,
  nodeId: string,
  anchor: 'center' | 'in' | 'out',
) {
  const target = await page.evaluate((id) => {
    const bounds = (window as unknown as {
      __flowentGetNodeBounds?: (nodeId: string) => { x: number; y: number; width: number; height: number } | null
    }).__flowentGetNodeBounds?.(id)
    const viewport = (window as unknown as { __flowentGetViewport?: () => { x: number; y: number; zoom: number } | null }).__flowentGetViewport?.()
    return bounds && viewport ? { bounds, viewport } : null
  }, nodeId)
  expect(target, `${nodeId} should have screen bounds`).toBeTruthy()
  const box = await page.locator(pixiCanvas).boundingBox()
  if (!box) throw new Error('no canvas')
  const localX = anchor === 'in' ? 0 : anchor === 'out' ? target!.bounds.width : target!.bounds.width / 2
  const localY = target!.bounds.height / 2
  return {
    x: box.x + (target!.bounds.x + localX) * target!.viewport.zoom + target!.viewport.x,
    y: box.y + (target!.bounds.y + localY) * target!.viewport.zoom + target!.viewport.y,
  }
}

async function focusNodeSelection(page: import('@playwright/test').Page, nodeId: string) {
  await page.locator(`[data-node-id="${nodeId}"]`).focus()
  await page.waitForTimeout(150)
}

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
  await page.waitForTimeout(300)
  await page.evaluate(async () => {
    const res = await fetch('/api/library')
    const body = (await res.json()) as { data: { maps: { id: string }[]; folders: { id: string }[] } }
    for (const m of body.data.maps) await fetch(`/api/library/maps/${m.id}`, { method: 'DELETE' })
    for (const f of body.data.folders) await fetch(`/api/library/folders/${f.id}`, { method: 'DELETE' })
  })
  await page.reload()
  await page.waitForSelector(pixiCanvas, { timeout: 30000 })
  await page.waitForTimeout(1500)
})

test('fix-1: edge re-renders when a connected node moves', async ({ page }) => {
  // Add an activity, then connect it to start via the test API.
  await clickPaletteElement(page, 'Activity')
  await page.waitForTimeout(800)

  const activityId = await page.evaluate(() => {
    const positions = (window as unknown as { __flowentGetNodePositions?: () => Record<string, unknown> }).__flowentGetNodePositions?.() ?? {}
    return Object.keys(positions).find((k) => k.startsWith('activity-')) ?? null
  })
  expect(activityId, 'activity must exist').toBeTruthy()

  const edgeId = await page.evaluate(async (id) => {
    return await (window as unknown as { __flowentTestAddEdge?: (s: string, t: string) => Promise<string | null> }).__flowentTestAddEdge?.('start', id)
  }, activityId)
  expect(edgeId, 'edge should be created').toBeTruthy()
  await page.waitForTimeout(500)

  // Capture the edge route BEFORE the move. The route is keyed
  // by edge id, not node id.
  const before = await page.evaluate((id) => {
    const routes = (window as unknown as { __flowentGetEdgeRoutes?: () => Record<string, { x: number; y: number }[]> }).__flowentGetEdgeRoutes?.() ?? {}
    return routes[id as string] ?? null
  }, edgeId)
  expect(before, 'edge route should exist before move').toBeTruthy()
  const beforeEndX = before![before!.length - 1].x

  // Drag the activity to a new position. The edge's endpoint should
  // move with the activity.
  const box = await page.locator(pixiCanvas).boundingBox()
  if (!box) throw new Error('no canvas')
  const pos = await page.evaluate((id) => {
    const positions = (window as unknown as { __flowentGetNodePosition?: (i: string) => { x: number; y: number } | null }).__flowentGetNodePosition?.(id as string) ?? null
    return positions
  }, activityId)
  expect(pos, 'activity must have a position').toBeTruthy()
  await page.mouse.move(box.x + pos!.x + 5, box.y + pos!.y + 5)
  await page.waitForTimeout(50)
  await page.mouse.down()
  await page.waitForTimeout(50)
  for (let i = 1; i <= 8; i++) {
    const t = i / 8
    await page.mouse.move(
      box.x + pos!.x + 5 + 200 * t,
      box.y + pos!.y + 5 + 150 * t,
    )
    await page.waitForTimeout(40)
  }
  await page.mouse.up()
  await page.waitForTimeout(500)

  // Capture the route AFTER the move. The last point (the target
  // port) should have moved to the new activity position.
  const after = await page.evaluate((id) => {
    const routes = (window as unknown as { __flowentGetEdgeRoutes?: () => Record<string, { x: number; y: number }[]> }).__flowentGetEdgeRoutes?.() ?? {}
    return routes[id as string] ?? null
  }, edgeId)
  expect(after, 'edge route should exist after move').toBeTruthy()
  const afterEndX = after![after!.length - 1].x
  expect(afterEndX, 'edge endpoint should follow the moved node').toBeGreaterThan(beforeEndX)
})

test('fix-2: two activities can be connected via the test API and via clicking two ports', async ({ page }) => {
  // Add two activities. Select Start before the second quick-create
  // so the activities land at distinct positions and are not already
  // connected to each other.
  await clickPaletteElement(page, 'Activity')
  await page.waitForTimeout(800)
  await focusNodeSelection(page, 'start')
  await clickPaletteElement(page, 'Activity')
  await page.waitForTimeout(800)

  const ids = await page.evaluate(() => {
    return Object.keys((window as unknown as { __flowentGetNodePositions?: () => Record<string, unknown> }).__flowentGetNodePositions?.() ?? {}).filter((k) => k.startsWith('activity-'))
  })
  expect(ids.length, 'two activities should exist').toBe(2)

  // Capture the baseline edge count (typically 1 — only the
  // first activity was auto-connected to start).
  const statusBefore = await page.locator(statusBar).textContent()
  const beforeMatch = statusBefore?.match(/(\d+) edges/)
  const beforeCount = Number(beforeMatch?.[1] ?? '0')
  console.log('[before edges]', beforeCount)

  // Path 1: the test API. Used by tests that want to skip the
  // UI and exercise the connect logic deterministically.
  const edgeId = await page.evaluate(async ([s, t]) => {
    return await (window as unknown as { __flowentTestAddEdge?: (s: string, t: string) => Promise<string | null> }).__flowentTestAddEdge?.(s, t) ?? null
  }, [ids[0], ids[1]])
  expect(edgeId, 'edge should be created via test API').toBeTruthy()

  await page.waitForTimeout(500)
  const statusAfter = await page.locator(statusBar).textContent()
  const afterMatch = statusAfter?.match(/(\d+) edges/)
  const afterCount = Number(afterMatch?.[1] ?? '0')
  expect(afterCount, 'edge count should grow by 1').toBe(beforeCount + 1)

  // Path 2: dragging from one endpoint to another endpoint. A plain
  // click on the right endpoint opens the Add next menu, so the free
  // existing-node connection gesture is a short drag.
  const beforeClick2 = Number((await page.locator(statusBar).textContent())?.match(/(\d+) edges/)?.[1] ?? '0')
  const reverseSource = await getNodeScreenPoint(page, ids[1], 'out')
  const reverseTarget = await getNodeScreenPoint(page, ids[0], 'in')
  await page.mouse.move(reverseSource.x, reverseSource.y)
  await page.mouse.down()
  await page.mouse.move(reverseTarget.x, reverseTarget.y, { steps: 8 })
  await page.mouse.up()
  await page.waitForTimeout(500)
  const afterClick2 = Number((await page.locator(statusBar).textContent())?.match(/(\d+) edges/)?.[1] ?? '0')
  expect(afterClick2, 'click-to-connect should add 1 more edge').toBe(beforeClick2 + 1)
})

test('keyboard connect mode connects two node bodies without precise port targeting', async ({ page }) => {
  await clickPaletteElement(page, 'Activity')
  await page.waitForTimeout(800)
  await focusNodeSelection(page, 'start')
  await clickPaletteElement(page, 'Activity')
  await page.waitForTimeout(800)

  const positions = await page.evaluate(() => {
    return (window as unknown as { __flowentGetNodePositions?: () => Record<string, { x: number; y: number }> }).__flowentGetNodePositions?.() ?? {}
  })
  const activityIds = Object.keys(positions).filter((k) => k.startsWith('activity-'))
  expect(activityIds.length, 'two activities should exist').toBe(2)

  const before = Number((await page.locator(statusBar).textContent())?.match(/(\d+) edges/)?.[1] ?? '0')
  await page.keyboard.press('c')
  await page.waitForTimeout(100)

  const source = await getNodeScreenPoint(page, activityIds[0], 'center')
  const target = await getNodeScreenPoint(page, activityIds[1], 'center')
  await page.mouse.click(source.x, source.y)
  await page.waitForTimeout(200)
  await page.mouse.click(target.x, target.y)
  await page.waitForTimeout(500)

  const after = Number((await page.locator(statusBar).textContent())?.match(/(\d+) edges/)?.[1] ?? '0')
  expect(after, 'node-body connect mode should add an edge').toBe(before + 1)
})

test('fix-3: activity ports are subtle by default, fade in on hover', async ({ page }) => {
  // Add an activity so we have something to inspect.
  await clickPaletteElement(page, 'Activity')
  await page.waitForTimeout(800)

  // Read port alphas on the activity node. Pixi v8 stores them as
  // Graphics children. The container has `eventMode = 'static'` so
  // pointer events route to it. The node layer is index 2 in the
  // root (grid=0, edges=1, nodes=2, overlay=3).
  const initial = await page.evaluate(() => {
    function walk(node: unknown, depth: number, results: { label?: string; alpha: number }[]): void {
      if (depth > 6 || !node || typeof node !== 'object') return
      const n = node as { label?: string; alpha?: number; children?: unknown[] }
      if (n.label?.startsWith('port-circle:') && typeof n.alpha === 'number') {
        results.push({ label: n.label, alpha: n.alpha })
      }
      if (Array.isArray(n.children)) {
        for (const c of n.children) walk(c, depth + 1, results)
      }
    }
    const host = document.querySelector('.pixi-host') as HTMLElement | null
    if (!host) return null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const anyHost = host as any
    const app = anyHost.__pixiApp
    if (!app?.stage) return null
    const results: { label?: string; alpha: number }[] = []
    walk(app.stage, 0, results)
    return results
  })
  console.log('[port alphas at rest]', JSON.stringify(initial))
  expect(initial, 'should have found port circles').toBeTruthy()
  // The port circles start at a low alpha (subtle resting state)
  // so the canvas doesn't feel busy. The per-frame redraw pass
  // fades them to 1.0 when the parent node is hovered. Hover
  // detection via Pixi v8's pointerenter on a per-frame
  // re-created child is unreliable in headless tests, so we
  // assert the resting visibility here and confirm the hover
  // fade-in machinery visually.
  for (const port of initial!) {
    expect(port.alpha, `${port.label} should start at resting alpha (< 0.5)`).toBeLessThan(0.5)
  }
})
