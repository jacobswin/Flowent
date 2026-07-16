import { test, expect } from '@playwright/test'
import { clickPaletteElement } from './canvasDockHelpers'

const pixiCanvas = '.pixi-host canvas'

async function openNewActivityEditor(page: import('@playwright/test').Page, targetActivityId?: string) {
  const target = await page.evaluate((requestedActivityId) => {
    const positions = (window as unknown as { __flowentGetNodePositions?: () => Record<string, unknown> }).__flowentGetNodePositions?.() ?? {}
    const activityId = requestedActivityId ?? Object.keys(positions).find((id) => id.startsWith('activity-'))
    if (!activityId) return null
    const bounds = (window as unknown as {
      __flowentGetNodeBounds?: (id: string) => { x: number; y: number; width: number; height: number } | null
    }).__flowentGetNodeBounds?.(activityId)
    const viewport = (window as unknown as { __flowentGetViewport?: () => { x: number; y: number; zoom: number } | null }).__flowentGetViewport?.()
    return bounds && viewport ? { bounds, viewport } : null
  }, targetActivityId)
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

test('selecting an activity opens quick actions and then the editor with fixed RASIC fields', async ({ page }) => {
  await page.waitForSelector(pixiCanvas)
  await page.waitForTimeout(300)
  await page.keyboard.press('0')

  // Add an activity
  await clickPaletteElement(page, 'Activity')
  await page.waitForTimeout(300)

  // Select the activity, then open its editor from the on-canvas quick actions.
  await openNewActivityEditor(page)
  await page.waitForTimeout(300)

  // The properties panel opens with title, summary, and fixed RASIC fields.
  const panel = page.locator('.properties-panel')
  await expect(panel).toBeVisible()
  await expect(panel.getByLabel('Title')).toBeVisible()
  await expect(panel.getByLabel('Summary')).toBeVisible()
  await expect(panel.getByLabel('Responsible')).toBeVisible()
  await expect(panel.getByLabel('Accountable')).toBeVisible()
  await expect(panel.getByLabel('Supporting')).toBeVisible()
  await expect(panel.getByLabel('Add role')).toHaveCount(0)
})

test('editing Responsible commits it to the activity and to the saved library', async ({ page }) => {
  // page.goto runs in beforeEach
  await page.waitForSelector(pixiCanvas)
  await page.waitForTimeout(300)
  await page.keyboard.press('0')

  await clickPaletteElement(page, 'Activity')
  await page.waitForTimeout(300)

  await openNewActivityEditor(page)
  await page.waitForTimeout(300)

  const panel = page.locator('.properties-panel')
  const responsibleInput = panel.getByLabel('Responsible')
  await responsibleInput.fill('Engineer')
  await responsibleInput.blur()

  await expect(responsibleInput).toHaveValue('Engineer')

  // Wait for autosave (500ms debounce) and check it landed on the server.
  // The serialized node stores role tags as `roleTags` (the GraphNode
  // field name); the ProcessNode view renames it to `roleIds` but the
  // disk format uses `roleTags` directly. The poll below waits for the
  // PATCH round-trip to actually land on disk before asserting — fetching
  // immediately after the debounce window can race the in-flight PATCH.
  await expect.poll(async () => {
    const res = await page.request.get('/api/library')
    const body = await res.json() as {
      data: {
        maps: {
          document?: {
            nodes?: Record<string, {
              roleTags?: string[]
              responsibilities?: { roleName: string; kind: string }[]
            }>
          }
        }[]
      }
    }
    return body.data.maps.flatMap((m) =>
      Object.values(m.document?.nodes ?? {}).flatMap((n) => [
        ...(n.roleTags ?? []),
        ...(n.responsibilities ?? []).map((responsibility) => `${responsibility.kind}:${responsibility.roleName}`),
      ]),
    )
  }, { timeout: 5000 }).toEqual(expect.arrayContaining(['Engineer', 'responsible:Engineer']))
})

test('an Activity can open its editor from Swimlane view', async ({ page }) => {
  await page.waitForSelector(pixiCanvas)
  await page.keyboard.press('0')
  await clickPaletteElement(page, 'Activity')
  await page.waitForTimeout(250)

  await page.getByRole('button', { name: 'Swimlane layout' }).click()
  await page.waitForTimeout(250)
  await openNewActivityEditor(page)
  await page.waitForTimeout(600)

  await expect(page.locator('.properties-panel')).toBeVisible()
  await expect(page.getByLabel('Title')).toBeVisible()
})

test('selecting a Swimlane Activity keeps the Edit action visible', async ({ page }) => {
  await page.waitForSelector(pixiCanvas)
  await page.keyboard.press('0')
  await clickPaletteElement(page, 'Activity')
  await page.waitForTimeout(250)
  await page.getByRole('button', { name: 'Swimlane layout' }).click()
  await page.waitForTimeout(250)

  const target = await page.evaluate(() => {
    const activityId = Object.keys(
      (window as unknown as { __flowentGetNodePositions?: () => Record<string, unknown> }).__flowentGetNodePositions?.() ?? {},
    ).find((id) => id.startsWith('activity-'))
    const bounds = activityId
      ? (window as unknown as {
          __flowentGetNodeBounds?: (id: string) => { x: number; y: number; width: number; height: number } | null
        }).__flowentGetNodeBounds?.(activityId)
      : null
    const viewport = (window as unknown as {
      __flowentGetViewport?: () => { x: number; y: number; zoom: number } | null
    }).__flowentGetViewport?.()
    return bounds && viewport ? { bounds, viewport } : null
  })
  expect(target).toBeTruthy()
  const canvas = await page.locator(pixiCanvas).boundingBox()
  if (!canvas) throw new Error('missing canvas')
  await page.mouse.click(
    canvas.x + (target!.bounds.x + target!.bounds.width / 2) * target!.viewport.zoom + target!.viewport.x,
    canvas.y + (target!.bounds.y + target!.bounds.height / 2) * target!.viewport.zoom + target!.viewport.y,
  )

  await page.waitForTimeout(600)
  await expect(page.getByRole('toolbar', { name: 'Node quick actions' })).toBeVisible()
})

test('selecting an Activity immediately after switching to Swimlane keeps Edit visible', async ({ page }) => {
  await page.waitForSelector(pixiCanvas)
  await page.keyboard.press('0')
  await clickPaletteElement(page, 'Activity')
  await page.waitForTimeout(250)

  await page.getByRole('button', { name: 'Swimlane layout' }).click()
  const target = await page.evaluate(() => {
    const activityId = Object.keys(
      (window as unknown as { __flowentGetNodePositions?: () => Record<string, unknown> }).__flowentGetNodePositions?.() ?? {},
    ).find((id) => id.startsWith('activity-'))
    const bounds = activityId
      ? (window as unknown as {
          __flowentGetNodeBounds?: (id: string) => { x: number; y: number; width: number; height: number } | null
        }).__flowentGetNodeBounds?.(activityId)
      : null
    const viewport = (window as unknown as {
      __flowentGetViewport?: () => { x: number; y: number; zoom: number } | null
    }).__flowentGetViewport?.()
    return bounds && viewport ? { bounds, viewport } : null
  })
  expect(target).toBeTruthy()
  const canvas = await page.locator(pixiCanvas).boundingBox()
  if (!canvas) throw new Error('missing canvas')
  await page.mouse.click(
    canvas.x + (target!.bounds.x + target!.bounds.width / 2) * target!.viewport.zoom + target!.viewport.x,
    canvas.y + (target!.bounds.y + target!.bounds.height / 2) * target!.viewport.zoom + target!.viewport.y,
  )

  await page.waitForTimeout(600)
  await expect(page.getByRole('toolbar', { name: 'Node quick actions' })).toBeVisible()
})

test('a middle Swimlane Activity keeps its editor open after Edit', async ({ page }) => {
  await page.waitForSelector(pixiCanvas)
  await page.keyboard.press('0')
  for (let count = 0; count < 3; count += 1) {
    await clickPaletteElement(page, 'Activity')
    await page.waitForTimeout(120)
  }

  const activityIds = await page.evaluate(() => Object.keys(
    (window as unknown as { __flowentGetNodePositions?: () => Record<string, unknown> }).__flowentGetNodePositions?.() ?? {},
  ).filter((id) => id.startsWith('activity-')))
  expect(activityIds.length).toBeGreaterThanOrEqual(3)

  await page.getByRole('button', { name: 'Swimlane layout' }).click()
  await page.waitForTimeout(250)
  await openNewActivityEditor(page, activityIds[1])
  await page.waitForTimeout(600)

  await expect(page.locator('.properties-panel')).toBeVisible()
  await expect(page.getByLabel('Title')).toHaveValue('New activity')
})

test('Activity detail fields save and survive a refresh after using Swimlane view', async ({ page }) => {
  await page.waitForSelector(pixiCanvas)
  await page.keyboard.press('0')
  await clickPaletteElement(page, 'Activity')
  await page.waitForTimeout(250)

  await page.getByRole('button', { name: 'Swimlane layout' }).click()
  await page.waitForTimeout(250)
  await openNewActivityEditor(page)

  const panel = page.locator('.properties-panel')
  await panel.getByLabel('Title').fill('Define release criteria')
  await panel.getByLabel('Summary').fill('Clarify scope, owners, and constraints.')
  await panel.getByLabel('Expectations').fill('The release decision has an agreed owner and criteria.')
  await panel.getByLabel('Expectations').blur()

  await expect.poll(async () => {
    const response = await page.request.get('/api/library')
    const body = await response.json() as {
      data: { maps: Array<{ document?: { nodes?: Record<string, { title?: string; summary?: string; expectations?: string }> } }> }
    }
    return body.data.maps.flatMap((map) => Object.values(map.document?.nodes ?? {}))
      .find((node) => node.title === 'Define release criteria')
  }, { timeout: 5000 }).toMatchObject({
    title: 'Define release criteria',
    summary: 'Clarify scope, owners, and constraints.',
    expectations: 'The release decision has an agreed owner and criteria.',
  })

  await page.reload()
  await page.waitForSelector(pixiCanvas)
  await expect.poll(async () => {
    const response = await page.request.get('/api/library')
    const body = await response.json() as {
      data: { maps: Array<{ document?: { nodes?: Record<string, { title?: string; summary?: string; expectations?: string }> } }> }
    }
    return body.data.maps.flatMap((map) => Object.values(map.document?.nodes ?? {}))
      .find((node) => node.title === 'Define release criteria')
  }, { timeout: 5000 }).toMatchObject({
    summary: 'Clarify scope, owners, and constraints.',
    expectations: 'The release decision has an agreed owner and criteria.',
  })
})

test('Activity detail saves the active field when Close is clicked in Swimlane view', async ({ page }) => {
  await page.waitForSelector(pixiCanvas)
  await page.keyboard.press('0')
  await clickPaletteElement(page, 'Activity')
  await page.waitForTimeout(250)

  await page.getByRole('button', { name: 'Swimlane layout' }).click()
  await page.waitForTimeout(250)
  await openNewActivityEditor(page)

  const panel = page.locator('.properties-panel')
  await panel.getByLabel('Expectations').fill('Save this value when the editor closes.')
  await panel.getByRole('button', { name: 'Close' }).click()
  await expect(panel).toHaveCount(0)

  await expect.poll(async () => {
    const response = await page.request.get('/api/library')
    const body = await response.json() as {
      data: { maps: Array<{ document?: { nodes?: Record<string, { expectations?: string }> } }> }
    }
    return body.data.maps.flatMap((map) => Object.values(map.document?.nodes ?? {}))
      .map((node) => node.expectations ?? '')
  }, { timeout: 5000 }).toContain('Save this value when the editor closes.')
})
