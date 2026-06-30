import { test, expect } from '@playwright/test'
import { clickPaletteElement } from './canvasDockHelpers'

const pixiCanvas = '.pixi-host canvas'

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
    const body = (await res.json()) as { data: { maps: { id: string }[] } }
    for (const m of body.data.maps) {
      await fetch(`/api/library/maps/${m.id}`, { method: 'DELETE' })
    }
  })
  await page.reload()
})

test('selecting an activity opens quick actions and then the editor with role-tag chips', async ({ page }) => {
  await page.waitForSelector(pixiCanvas)
  await page.waitForTimeout(300)
  await page.keyboard.press('0')

  // Add an activity
  await clickPaletteElement(page, 'Activity')
  await page.waitForTimeout(300)

  // Select the activity, then open its editor from the on-canvas quick actions.
  await openNewActivityEditor(page)
  await page.waitForTimeout(300)

  // The properties panel opens with title, summary, and a role-tag input
  const panel = page.locator('.properties-panel')
  await expect(panel).toBeVisible()
  await expect(panel.getByLabel('Title')).toBeVisible()
  await expect(panel.getByLabel('Summary')).toBeVisible()
  await expect(panel.getByLabel('Add role')).toBeVisible()
})

test('adding a role tag commits it to the activity and to the saved library', async ({ page }) => {
  // page.goto runs in beforeEach
  await page.waitForSelector(pixiCanvas)
  await page.waitForTimeout(300)
  await page.keyboard.press('0')

  await clickPaletteElement(page, 'Activity')
  await page.waitForTimeout(300)

  await openNewActivityEditor(page)
  await page.waitForTimeout(300)

  // Type a role and press Enter
  const roleInput = page.getByLabel('Add role')
  await roleInput.fill('Engineer')
  await roleInput.press('Enter')

  // The chip appears in the panel
  await expect(page.locator('.role-tag-chip').filter({ hasText: 'Engineer' })).toBeVisible()

  // Wait for autosave (500ms debounce) and check it landed on the server.
  // The serialized node stores role tags as `roleTags` (the GraphNode
  // field name); the ProcessNode view renames it to `roleIds` but the
  // disk format uses `roleTags` directly. The poll below waits for the
  // PATCH round-trip to actually land on disk before asserting — fetching
  // immediately after the debounce window can race the in-flight PATCH.
  await expect.poll(async () => {
    const res = await page.request.get('/api/library')
    const body = await res.json() as { data: { maps: { document?: { nodes?: Record<string, { roleTags?: string[] }> } }[] } }
    return body.data.maps.flatMap((m) =>
      Object.values(m.document?.nodes ?? {}).flatMap((n) => n.roleTags ?? []),
    )
  }, { timeout: 5000 }).toContain('Engineer')
})
