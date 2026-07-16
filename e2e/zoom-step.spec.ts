import { test, expect } from '@playwright/test'

const pixiCanvas = '.pixi-host canvas'
const statusBar = '.status-bar'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  // Clear the URL/localStorage hint so the gate doesn't try to load a
  // map that previous tests deleted. Without this, smoke-screenshots's
  // leftover state can wedge the gate on "Loading library…" for the
  // rest of the run.
  await page.evaluate(() => {
    try { localStorage.clear() } catch { /* noop */ }
    history.replaceState(null, '', '/')
  })
  await page.evaluate(async () => {
    const res = await fetch('/api/library')
    const body = (await res.json()) as { data: { maps: { id: string }[]; folders: { id: string }[] } }
    for (const m of body.data.maps) {
      await fetch(`/api/library/maps/${m.id}`, { method: 'DELETE' })
    }
    for (const f of body.data.folders) {
      await fetch(`/api/library/folders/${f.id}`, { method: 'DELETE' })
    }
  })
  await page.reload()
})

async function readZoom(page: import('@playwright/test').Page): Promise<number> {
  const text = await page.locator(statusBar).textContent()
  const match = text?.match(/(\d+)%/)
  return match ? Number(match[1]) / 100 : 0
}

async function resetZoom(page: import('@playwright/test').Page): Promise<void> {
  await page.keyboard.press('0')
  await page.waitForTimeout(80)
}

test('mouse wheel notch (line mode) zooms by ~1.25x per event', async ({ page }) => {
  await page.waitForSelector(pixiCanvas, { timeout: 60000 })
  await page.waitForTimeout(150)
  await resetZoom(page)

  const before = await readZoom(page)
  expect(before).toBeCloseTo(1, 2)

  const box = await page.locator(pixiCanvas).boundingBox()
  if (!box) throw new Error('no pixi canvas')

  // One wheel notch in DOM_DELTA_LINE mode. Playwright's mouse.wheel doesn't
  // expose deltaMode, so we dispatch a real WheelEvent with deltaMode=1
  // (LINE) and deltaY=-120 (one detent up) directly.
  await page.evaluate(({ x, y }) => {
    const el = document.querySelector('.pixi-host canvas') as HTMLCanvasElement | null
    if (!el) throw new Error('no canvas')
    const ev = new WheelEvent('wheel', {
      deltaY: -120,
      deltaMode: 1,
      clientX: x,
      clientY: y,
      bubbles: true,
      cancelable: true,
    })
    el.dispatchEvent(ev)
  }, { x: box.x + 400, y: box.y + 300 })

  await page.waitForTimeout(80)

  const after = await readZoom(page)
  // 1.25x ± rounding: 1.20 - 1.30
  expect(after).toBeGreaterThanOrEqual(1.2)
  expect(after).toBeLessThanOrEqual(1.3)
})

test('mouse wheel notch zoomed in can be zoomed out (round trip)', async ({ page }) => {
  // page.goto runs in beforeEach
  await page.waitForSelector(pixiCanvas)
  await page.waitForTimeout(150)
  await resetZoom(page)

  const box = await page.locator(pixiCanvas).boundingBox()
  if (!box) throw new Error('no pixi canvas')

  // Two in, then two out — should land back at 100%.
  const dispatch = async (deltaY: number) => {
    await page.evaluate(({ x, y, dy }) => {
      const el = document.querySelector('.pixi-host canvas') as HTMLCanvasElement | null
      if (!el) throw new Error('no canvas')
      el.dispatchEvent(new WheelEvent('wheel', { deltaY: dy, deltaMode: 1, clientX: x, clientY: y, bubbles: true, cancelable: true }))
    }, { x: box.x + 400, y: box.y + 300, dy: deltaY })
    await page.waitForTimeout(60)
  }

  await dispatch(-120)
  await dispatch(-120)
  await dispatch(120)
  await dispatch(120)

  const zoom = await readZoom(page)
  expect(zoom).toBeCloseTo(1, 2)
})

test('wheel zoom is clamped at 5x max', async ({ page }) => {
  // page.goto runs in beforeEach
  await page.waitForSelector(pixiCanvas)
  await page.waitForTimeout(150)
  await resetZoom(page)

  const box = await page.locator(pixiCanvas).boundingBox()
  if (!box) throw new Error('no pixi canvas')

  // Fire 20 notches in — should clamp at 500% (5x).
  for (let i = 0; i < 20; i++) {
    await page.evaluate(({ x, y }) => {
      const el = document.querySelector('.pixi-host canvas') as HTMLCanvasElement | null
      if (!el) throw new Error('no canvas')
      el.dispatchEvent(new WheelEvent('wheel', { deltaY: -120, deltaMode: 1, clientX: x, clientY: y, bubbles: true, cancelable: true }))
    }, { x: box.x + 400, y: box.y + 300 })
  }
  await page.waitForTimeout(80)

  const zoom = await readZoom(page)
  expect(zoom).toBeLessThanOrEqual(5.01)
  expect(zoom).toBeGreaterThanOrEqual(4.9)
})
