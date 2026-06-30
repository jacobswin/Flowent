import { expect, test, type Page } from '@playwright/test'
import { expandDockPanel } from './canvasDockHelpers'

const pixiCanvas = '.pixi-host canvas'
const statusBar = '.status-bar'

async function resetLibrary(page: Page) {
  await page.evaluate(async () => {
    try {
      localStorage.clear()
    } catch {
      // noop
    }
    history.replaceState(null, '', '/')
    const res = await fetch('/api/library')
    const body = (await res.json()) as { data: { maps: { id: string }[]; folders: { id: string }[] } }
    for (const map of body.data.maps) await fetch(`/api/library/maps/${map.id}`, { method: 'DELETE' })
    for (const folder of body.data.folders) await fetch(`/api/library/folders/${folder.id}`, { method: 'DELETE' })
  })
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await resetLibrary(page)
  await page.reload()
  await page.waitForSelector(pixiCanvas, { timeout: 30000 })
})

test('top dock panels expand and collapse from fixed headers', async ({ page }) => {
  await expect(page.locator('.keyboard-hint')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Connect', exact: true })).toHaveCount(0)

  await expandDockPanel(page, 'Elements')
  await expect(page.locator('button[aria-label^="Activity:"]')).toBeVisible()
  await page.getByRole('button', { name: 'Collapse Elements' }).click()
  await expect(page.locator('button[aria-label^="Activity:"]')).toHaveCount(0)

  await expandDockPanel(page, 'Alignment checklist')
  await expect(page.getByText('No alignment gaps found in the current map.')).toBeVisible()
  await page.getByRole('button', { name: 'Collapse Alignment checklist' }).click()
  await expect(page.getByText('No alignment gaps found in the current map.')).toHaveCount(0)

  await expandDockPanel(page, 'Process assets')
  await expect(page.getByLabel('Process completeness')).toBeVisible()
  await page.getByRole('button', { name: 'Collapse Process assets' }).click()
  await expect(page.getByLabel('Process completeness')).toHaveCount(0)

  await expandDockPanel(page, 'Focus view')
  await page.getByRole('button', { name: 'Handoff paths' }).click()
  await expect(page.getByRole('button', { name: 'Handoff paths' })).toHaveClass(/active/)
  await page.getByRole('button', { name: 'Collapse Focus view' }).click()
  await expect(page.getByRole('button', { name: 'Handoff paths' })).toHaveCount(0)
})

test('toolbar zoom controls replace the bottom shortcut strip', async ({ page }) => {
  await page.keyboard.press('0')
  await expect(page.locator(statusBar)).toContainText('100%')

  await page.getByRole('button', { name: 'Zoom in' }).click()
  await expect.poll(async () => {
    const status = await page.locator(statusBar).textContent()
    return Number(status?.match(/(\d+)%/)?.[1] ?? '0')
  }).toBeGreaterThan(100)

  await page.locator('.toolbar-zoom-reset').click()
  await expect(page.locator(statusBar)).toContainText('100%')
})

test('connected edges show a visible arrowhead at the target end', async ({ page }) => {
  await page.keyboard.press('0')
  const canvasBox = await page.locator(pixiCanvas).boundingBox()
  const startPosition = await page.evaluate(() => {
    return (window as unknown as { __flowentGetNodePosition?: (id: string) => { x: number; y: number } | null }).__flowentGetNodePosition?.('start')
  })
  if (!canvasBox || !startPosition) throw new Error('missing canvas or start node')
  await page.mouse.click(canvasBox.x + startPosition.x + 60, canvasBox.y + startPosition.y + 28)
  await page.getByRole('button', { name: /quick connect from start/i }).click()
  await page.getByRole('menu', { name: /choose next node type/i }).getByRole('menuitem', { name: /activity/i }).click()
  await expect(page.locator(statusBar)).toContainText('1 edges')

  const edgePixels = await page.evaluate(async () => {
    const canvas = document.querySelector('.pixi-host canvas') as HTMLCanvasElement | null
    const viewport = (window as unknown as { __flowentGetViewport?: () => { x: number; y: number; zoom: number } | null }).__flowentGetViewport?.()
    const edgeId = Object.keys(
      (window as unknown as { __flowentGetEdgeRoutes?: () => Record<string, { x: number; y: number }[]> }).__flowentGetEdgeRoutes?.() ?? {},
    )[0]
    const edgeCenter = edgeId
      ? (window as unknown as { __flowentGetEdgeLabelCenter?: (id: string) => { x: number; y: number } | null }).__flowentGetEdgeLabelCenter?.(edgeId)
      : null
    const activityId = Object.keys(
      (window as unknown as { __flowentGetNodePositions?: () => Record<string, { x: number; y: number }> }).__flowentGetNodePositions?.() ?? {},
    ).find((id) => id.startsWith('activity-'))
    const bounds = activityId
      ? (window as unknown as {
          __flowentGetNodeBounds?: (id: string) => { x: number; y: number; width: number; height: number } | null
        }).__flowentGetNodeBounds?.(activityId)
      : null
    if (!canvas || !viewport || !bounds || !edgeCenter) return { arrow: 0, midline: 999 }

    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)))

    const dataUrl = canvas.toDataURL('image/png')
    const image = new Image()
    image.src = dataUrl
    await image.decode()

    const sampleCanvas = document.createElement('canvas')
    sampleCanvas.width = image.naturalWidth
    sampleCanvas.height = image.naturalHeight
    const context = sampleCanvas.getContext('2d')
    if (!context) return 0
    context.drawImage(image, 0, 0)

    const canvasRect = canvas.getBoundingClientRect()
    const scaleX = image.naturalWidth / canvasRect.width
    const scaleY = image.naturalHeight / canvasRect.height
    const countDarkPixels = (sampleX: number, sampleY: number, radius: number) => {
      let darkPixels = 0
      for (let y = sampleY - radius; y <= sampleY + radius; y += 1) {
        for (let x = sampleX - radius; x <= sampleX + radius; x += 1) {
          const pixel = context.getImageData(x, y, 1, 1).data
          if (pixel[3] > 16 && pixel[0] < 80 && pixel[1] < 90 && pixel[2] < 110) {
            darkPixels += 1
          }
        }
      }
      return darkPixels
    }

    const arrowX = Math.round((viewport.x + (bounds.x - 8) * viewport.zoom) * scaleX)
    const arrowY = Math.round((viewport.y + (bounds.y + bounds.height / 2) * viewport.zoom) * scaleY)
    const midlineX = Math.round((viewport.x + edgeCenter.x * viewport.zoom) * scaleX)
    const midlineY = Math.round((viewport.y + edgeCenter.y * viewport.zoom) * scaleY)
    return {
      arrow: countDarkPixels(arrowX, arrowY, 7),
      midline: countDarkPixels(midlineX, midlineY, 12),
      debug: {
        arrowX,
        arrowY,
        midlineX,
        midlineY,
        scaleX,
        scaleY,
        edgeCenter,
        centerPixel: Array.from(context.getImageData(midlineX, midlineY, 1, 1).data),
      },
    }
  })

  expect(edgePixels.arrow).toBeGreaterThan(4)
  expect(edgePixels.midline, JSON.stringify(edgePixels.debug)).toBeLessThan(120)
})
