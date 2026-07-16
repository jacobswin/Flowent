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

test('main toolbar sits in the same top row as dock panels', async ({ page }) => {
  const elementsBox = await page.getByLabel('Process element library').boundingBox()
  const layoutBox = await page.getByRole('button', { name: /flow layout/i }).boundingBox()

  if (!elementsBox || !layoutBox) throw new Error('missing top control boxes')
  expect(Math.abs(elementsBox.y - layoutBox.y)).toBeLessThanOrEqual(8)
  await expect(page.locator('.canvas-control-rail .canvas-title')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Expand Alignment' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Expand Assets' })).toBeVisible()
})

test('compact top controls remain visible in one proportional row without hidden scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 1130, height: 720 })
  await page.getByRole('button', { name: 'Collapse library' }).click()

  const controls = {
    elements: page.getByRole('region', { name: 'Process element library' }),
    alignment: page.getByRole('complementary', { name: 'Alignment checklist' }),
    assets: page.getByRole('complementary', { name: 'Process assets' }),
    focus: page.getByRole('region', { name: 'Focus view' }),
  }
  const boxes = Object.fromEntries(await Promise.all(
    Object.entries(controls).map(async ([name, control]) => {
      const box = await control.boundingBox()
      if (!box) throw new Error(`missing ${name} top control`)
      return [name, box] as const
    }),
  ))

  for (const box of Object.values(boxes)) {
    expect(box.x).toBeGreaterThanOrEqual(0)
    expect(box.x + box.width).toBeLessThanOrEqual(1130)
  }
  expect(boxes.alignment.width).toBeGreaterThan(boxes.assets.width)
  expect(boxes.focus.width).toBeGreaterThan(boxes.elements.width)

  for (const buttonName of ['Flow layout', 'Swimlane layout', 'Zoom level 100%']) {
    const box = await page.getByRole('button', { name: buttonName }).boundingBox()
    if (!box) throw new Error(`missing ${buttonName}`)
    expect(box.x + box.width).toBeLessThanOrEqual(1130)
  }

  const dockStyle = await page.locator('.canvas-top-dock').evaluate((element) => {
    const style = getComputedStyle(element)
    return {
      background: style.backgroundColor,
      overflowX: style.overflowX,
    }
  })
  expect(dockStyle.background).toBe('rgba(0, 0, 0, 0)')
  expect(dockStyle.overflowX).not.toBe('auto')

  await expandDockPanel(page, 'Focus view')
  await page.getByRole('button', { name: 'Handoff paths' }).click()
  await expect(page.getByRole('button', { name: 'Handoff paths' })).toHaveClass(/active/)

  const chromeStyle = await page.evaluate(() => {
    const readStyle = (selector: string) => {
      const element = document.querySelector(selector)
      if (!element) throw new Error(`missing ${selector}`)
      const style = getComputedStyle(element)
      return {
        backdrop: style.backdropFilter || style.getPropertyValue('-webkit-backdrop-filter'),
        boxShadow: style.boxShadow,
      }
    }
    return {
      library: readStyle('.library-rail'),
      panel: readStyle('.top-dock-panel'),
      toolbar: readStyle('.canvas-toolbar'),
    }
  })
  expect(chromeStyle.library.boxShadow).toBe('none')
  expect(chromeStyle.panel.backdrop).toBe('none')
  expect(chromeStyle.panel.boxShadow).toBe('none')
  expect(chromeStyle.toolbar.backdrop).toBe('none')
  expect(chromeStyle.toolbar.boxShadow).toBe('none')
})

test('top dock panels expand and collapse from fixed headers', async ({ page }) => {
  await expect(page.locator('.keyboard-hint')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Connect', exact: true })).toHaveCount(0)

  await expandDockPanel(page, 'Elements')
  await expect(page.locator('button[aria-label^="Activity:"]')).toBeVisible()
  await page.getByRole('button', { name: 'Collapse Elements' }).click()
  await expect(page.locator('button[aria-label^="Activity:"]')).toHaveCount(0)

  await expandDockPanel(page, 'Alignment')
  await expect(page.getByText('No alignment gaps found in the current map.')).toBeVisible()
  await page.getByRole('button', { name: 'Collapse Alignment' }).click()
  await expect(page.getByText('No alignment gaps found in the current map.')).toHaveCount(0)

  await expandDockPanel(page, 'Assets')
  await expect(page.getByLabel('Process completeness')).toBeVisible()
  await page.getByRole('button', { name: 'Collapse Assets' }).click()
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

  await page.getByRole('button', { name: /zoom level/i }).click()
  await page.getByRole('menu', { name: 'Zoom level' }).getByRole('menuitem', { name: '100%' }).click()
  await expect(page.locator(statusBar)).toContainText('100%')
})

test('zoom level menu offers presets and clamps custom values', async ({ page }) => {
  await page.keyboard.press('0')
  await page.getByRole('button', { name: /zoom level 100%/i }).click()

  const menu = page.getByRole('menu', { name: 'Zoom level' })
  for (const preset of ['25%', '50%', '75%', '100%', '125%', '150%', '175%', '200%']) {
    await expect(menu.getByRole('menuitem', { name: preset, exact: true })).toBeVisible()
  }

  const presetBoxes: Record<string, { x: number; y: number }> = {}
  for (const preset of ['25%', '50%', '75%', '100%', '125%', '150%', '175%', '200%']) {
    const box = await menu.getByRole('menuitem', { name: preset, exact: true }).boundingBox()
    if (!box) throw new Error(`missing ${preset} preset`)
    presetBoxes[preset] = { x: box.x, y: box.y }
  }
  for (const preset of ['50%', '75%', '100%']) {
    expect(Math.abs(presetBoxes[preset].x - presetBoxes['25%'].x)).toBeLessThanOrEqual(2)
    expect(presetBoxes[preset].y).toBeGreaterThan(presetBoxes['25%'].y)
  }
  for (const pair of [['25%', '125%'], ['50%', '150%'], ['75%', '175%'], ['100%', '200%']] as const) {
    expect(presetBoxes[pair[1]].x).toBeGreaterThan(presetBoxes[pair[0]].x)
    expect(Math.abs(presetBoxes[pair[1]].y - presetBoxes[pair[0]].y)).toBeLessThanOrEqual(2)
  }

  await menu.getByRole('menuitem', { name: '150%', exact: true }).click()
  await expect(page.locator(statusBar)).toContainText('150%')

  await page.getByRole('button', { name: /zoom level 150%/i }).click()
  await page.getByRole('spinbutton', { name: /custom zoom percentage/i }).fill('777')
  await page.getByRole('button', { name: /apply custom zoom/i }).click()
  await expect(page.locator(statusBar)).toContainText('500%')

  await page.getByRole('button', { name: /zoom level 500%/i }).click()
  await page.getByRole('spinbutton', { name: /custom zoom percentage/i }).fill('2')
  await page.getByRole('button', { name: /apply custom zoom/i }).click()
  await expect(page.locator(statusBar)).toContainText('5%')
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
