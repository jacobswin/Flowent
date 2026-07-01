import { test, expect } from '@playwright/test'
import { clickPaletteElement } from './canvasDockHelpers'

const pixiCanvas = '.pixi-host canvas'

test.beforeEach(async ({ page }) => {
  // Reset the library so the Welcome map is fresh. Without this,
  // previous tests may leave a stale second map in the library
  // which keeps the LibraryGate on the welcome screen. We do
  // two deletes (an initial one to clear stale state, then a
  // reload, then a second delete to clear the welcome the gate
  // creates on the reload). This guarantees a single, fresh map.
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
  // The reload above may have re-created a Welcome. Clear again so
  // only the next reload's brand-new Welcome survives.
  await page.evaluate(async () => {
    const res = await fetch('/api/library')
    const body = (await res.json()) as { data: { maps: { id: string }[]; folders: { id: string }[] } }
    for (const m of body.data.maps) await fetch(`/api/library/maps/${m.id}`, { method: 'DELETE' })
    for (const f of body.data.folders) await fetch(`/api/library/folders/${f.id}`, { method: 'DELETE' })
  })
  await page.reload()
})

test('preview screenshots capture the canvas in several states', async ({ page }) => {
  page.on('pageerror', (err) => console.log('[pageerror]', err.message))

  await page.goto('/')
  await page.waitForSelector(pixiCanvas)
  await page.waitForTimeout(300)
  await page.keyboard.press('0')
  await page.waitForTimeout(80)
  await page.screenshot({ path: 'test-results/01-initial.png', fullPage: true })

  // Add an activity, a decision, an end.
  await clickPaletteElement(page, 'Activity')
  await page.waitForTimeout(120)
  await clickPaletteElement(page, 'Decision')
  await page.waitForTimeout(120)
  await clickPaletteElement(page, 'End')
  await page.waitForTimeout(120)
  await page.screenshot({ path: 'test-results/02-with-nodes.png', fullPage: true })

  // Auto-layout
  await page.locator('button:has-text("Layout")').click()
  await page.waitForTimeout(300)
  await page.screenshot({ path: 'test-results/03-laid-out.png', fullPage: true })
  const beforeEdge = await page.locator('.status-bar').textContent()

  // Connect start to the first activity via the public test API
  // instead of a real port drag. The smoke test is meant to
  // exercise the screenshot pipeline, not the port-drag timing;
  // canvas-edges.spec.ts already covers the drag flow.
  const startId = 'start'
  const firstActivityId = await page.evaluate(() => {
    const w = window as unknown as { __flowentGetNodePositions?: () => Record<string, { x: number; y: number }> }
    const positions = w.__flowentGetNodePositions?.() ?? {}
    return Object.keys(positions).find((id) => id.startsWith('activity-')) ?? null
  })
  if (!firstActivityId) throw new Error('no activity node')
  const edgeId = await page.evaluate(async ([source, target]) => {
    const w = window as unknown as { __flowentTestAddEdge?: (s: string, t: string) => Promise<string | null> }
    return w.__flowentTestAddEdge?.(source, target) ?? null
  }, [startId, firstActivityId])
  if (!edgeId) throw new Error('edge was not created')
  await page.waitForTimeout(500)
  await page.screenshot({ path: 'test-results/04-after-edge.png', fullPage: true })

  // Verify an edge was created. The Welcome starter plus the three
  // quickCreate adds may have left us with a small number of
  // pre-existing handoffs; we only assert that the programmatic
  // addEdge bumped the count by one.
  const beforeCount = Number(beforeEdge?.match(/(\d+) edges/)?.[1] ?? '0')
  const afterStatus = await page.locator('.status-bar').textContent()
  const afterCount = Number(afterStatus?.match(/(\d+) edges/)?.[1] ?? '0')
  expect(afterCount).toBe(beforeCount + 1)
})
