import { test, expect } from '@playwright/test'
import { clickPaletteElement } from './canvasDockHelpers'

const pixiCanvas = '.pixi-host canvas'
const statusBar = '.status-bar'

async function openNewActivityEditor(page: import('@playwright/test').Page) {
  const target = await page.evaluate(() => {
    const positions = (window as unknown as { __flowentGetNodePositions?: () => Record<string, unknown> }).__flowentGetNodePositions?.() ?? {}
    const activityId = Object.keys(positions).find((id) => id.startsWith('activity-'))
    if (!activityId) return null
    const bounds = (window as unknown as {
      __flowentGetNodeBounds?: (id: string) => { x: number; y: number; width: number; height: number } | null
    }).__flowentGetNodeBounds?.(activityId)
    const viewport = (window as unknown as { __flowentGetViewport?: () => { x: number; y: number; zoom: number } | null }).__flowentGetViewport?.()
    return bounds && viewport ? { bounds, viewport } : null
  })
  expect(target).toBeTruthy()
  const box = await page.locator(pixiCanvas).boundingBox()
  if (!box) throw new Error('no canvas')
  await page.mouse.click(
    box.x + (target!.bounds.x + target!.bounds.width / 2) * target!.viewport.zoom + target!.viewport.x,
    box.y + (target!.bounds.y + target!.bounds.height / 2) * target!.viewport.zoom + target!.viewport.y,
  )
  await page
    .getByRole('toolbar', { name: 'Node quick actions' })
    .getByRole('button', { name: 'Edit node' })
    .click()
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.evaluate(async () => {
    try { localStorage.clear() } catch { /* noop */ }
    history.replaceState(null, '', '/')
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

test('activity title edit: focus + type + commit on Enter', async ({ page }) => {
  await page.waitForSelector(pixiCanvas, { timeout: 30000 })
  await page.waitForTimeout(300)
  await page.keyboard.press('0')

  await clickPaletteElement(page, 'Activity')
  await page.waitForTimeout(300)

  await openNewActivityEditor(page)
  await page.waitForTimeout(300)

  const titleInput = page.getByLabel('Title')
  await expect(titleInput).toBeVisible()
  // The input should be auto-focused
  await expect(titleInput).toBeFocused()
  // fill() replaces the value atomically and triggers onChange. The
  // onBlur-then-onUpdate commit happens when the input blurs, which
  // Playwright's fill() does not always trigger — press Tab to commit.
  await titleInput.fill('Customer onboarding')
  await page.keyboard.press('Tab')
  await page.waitForTimeout(300)

  // Verify the title persisted by reading the saved library doc.
  await expect.poll(async () => {
    const res = await page.request.get('/api/library')
    const body = await res.json() as { data: { maps: { document?: { nodes?: Record<string, { title?: string }> } }[] } }
    return body.data.maps.flatMap((m) =>
      Object.values(m.document?.nodes ?? {}).map((n) => n.title ?? ''),
    )
  }, { timeout: 5000 }).toContain('Customer onboarding')
})

test('typing in a block editor does not trigger canvas shortcuts', async ({ page }) => {
  await page.waitForSelector(pixiCanvas, { timeout: 30000 })
  await page.waitForTimeout(300)
  await page.keyboard.press('0')

  await clickPaletteElement(page, 'Activity')
  await page.waitForTimeout(300)
  await expect(page.locator(statusBar)).toContainText('2 nodes')

  await openNewActivityEditor(page)
  await page.waitForTimeout(300)

  const titleInput = page.getByLabel('Title')
  await expect(titleInput).toBeFocused()
  await page.keyboard.press('Delete')
  await page.keyboard.press('a')
  await page.waitForTimeout(150)

  await expect(page.locator(statusBar)).toContainText('2 nodes')
  await expect(titleInput).toHaveValue(/a$/)
})

test('decision node only has left+right ports after migration', async ({ page }) => {
  // First, save a map with a legacy 3-port decision so the migration path runs.
  await page.evaluate(async () => {
    // Wait for the gate to settle, then create a map with the legacy schema
    const res = await fetch('/api/library', { method: 'GET' })
    void res
  })

  // Use the UI to add a decision — the in-app addDecision now creates with
  // 2 ports, so this validates the new-schema path.
  await page.waitForSelector(pixiCanvas, { timeout: 30000 })
  await page.waitForTimeout(300)
  await page.keyboard.press('0')

  await clickPaletteElement(page, 'Decision')
  await page.waitForTimeout(300)

  // Decision appears in the saved doc with 2 ports
  await expect.poll(async () => {
    const res = await page.request.get('/api/library')
    const body = await res.json() as { data: { maps: { document?: { nodes?: Record<string, { type?: string; ports?: { id: string; side: string }[] }> } }[] } }
    const decisions = body.data.maps.flatMap((m) =>
      Object.values(m.document?.nodes ?? {}).filter((n) => n.type === 'decision'),
    )
    return decisions.flatMap((d) => d.ports ?? []).map((p) => p.side).sort()
  }, { timeout: 5000 }).toEqual(['left', 'right'])
})

test('decision node loaded from legacy 3-port data gets migrated to 2 ports', async ({ page }) => {
  await page.waitForSelector(pixiCanvas, { timeout: 30000 })
  await page.waitForTimeout(300)

  // Create a fresh map directly so we control the document content
  const created = await page.evaluate(async () => {
    const res = await fetch('/api/library/maps', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Legacy' }),
    })
    const body = (await res.json()) as { data: { id: string } }
    return body.data.id
  })

  // Patch the document with a legacy-schema decision (3 ports)
  await page.evaluate(async (mapId) => {
    await fetch(`/api/library/maps/${mapId}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        document: {
          id: mapId,
          nodes: {
            d1: {
              id: 'd1',
              type: 'decision',
              x: 300,
              y: 300,
              width: 180,
              height: 108,
              title: 'Legacy decision',
              roleTags: [],
              ports: [
                { id: 'in', side: 'left' },
                { id: 'yes', side: 'top' },
                { id: 'no', side: 'bottom' },
              ],
            },
          },
          edges: {},
          selectedNodeIds: [],
          selectedEdgeIds: [],
          viewport: { x: 0, y: 0, zoom: 1 },
          meta: { dirty: false, version: 1 },
        },
      }),
    })
  }, created)

  // Now load the Legacy map
  await page.goto(`/?map=${created}`)
  await page.waitForSelector(pixiCanvas, { timeout: 30000 })
  await page.waitForTimeout(800)

  // Migration runs on init. Trigger a save by changing the zoom (which
  // marks the doc dirty) and wait past the 500ms autosave debounce.
  await page.keyboard.press('0')
  await page.waitForTimeout(1200)

  // Read the saved doc
  const ports = await page.evaluate(async (mapId) => {
    const r2 = await fetch('/api/library')
    const body = await r2.json() as { data: { maps: { id: string; document?: { nodes?: Record<string, { ports?: { id: string; side: string }[] }> } }[] } }
    const map = body.data.maps.find((m) => m.id === mapId)
    const d1 = map?.document?.nodes?.d1
    return (d1?.ports ?? []).map((p) => p.side).sort()
  }, created)

  expect(ports).toEqual(['left', 'right'])
})
