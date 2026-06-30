import { expect, test, type Page } from '@playwright/test'
import { clickPaletteElement } from './canvasDockHelpers'

const pixiCanvas = '.pixi-host canvas'

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

async function addElement(page: Page, label: string) {
  await clickPaletteElement(page, label)
  await page.waitForTimeout(500)
}

async function openLatestNodeEditor(page: Page, kind: 'activity' | 'stage') {
  const node = page.locator(`[data-node-kind="${kind}"]`).last()
  await expect(node).toBeAttached()
  await node.focus()
  await page.keyboard.press('Enter')
  await expect(page.locator('.properties-panel')).toBeVisible()
}

async function getSavedDocuments(page: Page) {
  const response = await page.request.get('/api/library')
  const body = (await response.json()) as {
    data: {
      maps: {
        document?: {
          nodes?: Record<string, { responsibilities?: { roleName: string; kind: string }[]; roleTags?: string[] }>
          edges?: Record<string, { workProductIds?: string[] }>
          processAssets?: {
            workProducts?: Record<string, {
              title: string
              state: string
              description: string
              activityLinks?: { nodeId: string; relation: 'input' | 'output'; maturity: string }[]
              producerNodeIds: string[]
              consumerNodeIds: string[]
              handoffEdgeIds: string[]
              guidanceIds: string[]
            }>
            guidanceItems?: Record<string, { title: string; kind: string; appliesToNodeIds: string[]; workProductIds: string[] }>
            milestones?: Record<string, {
              title: string
              stageNodeId: string | null
              workProductStates: { workProductId: string; state: string }[]
            }>
          }
        }
      }[]
    }
  }
  return body.data.maps.map((map) => map.document).filter(Boolean)
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await resetLibrary(page)
  await page.reload()
  await page.waitForSelector(pixiCanvas, { timeout: 30000 })
  await page.waitForTimeout(800)
})

test('models Stages What Who When How assets and persists them', async ({ page }) => {
  await page.keyboard.press('0')

  await addElement(page, 'Activity')
  await openLatestNodeEditor(page, 'activity')

  await page.getByLabel('Responsibility kind').selectOption('accountable')
  await page.getByLabel('Responsibility role').fill('Product Manager')
  await page.getByRole('button', { name: 'Add responsibility' }).click()
  await expect(page.getByText('A · Product Manager')).toBeVisible()

  await page.getByLabel('New output work product').fill('Discovery brief')
  await page.getByRole('button', { name: 'Add output work product' }).click()
  await expect(page.getByText('Discovery brief · Draft')).toBeVisible()

  await page.getByLabel('Guidance kind').selectOption('checklist')
  await page.getByLabel('New guidance').fill('Interview checklist')
  await page.getByRole('button', { name: 'Add guidance' }).click()
  await expect(page.getByText('Interview checklist · checklist')).toBeVisible()

  await page.getByRole('button', { name: 'Close' }).click()
  await addElement(page, 'Stage')
  await openLatestNodeEditor(page, 'stage')

  await page.getByLabel('New milestone').fill('Discovery exit')
  await page.getByRole('button', { name: 'Add milestone' }).click()
  await expect(page.locator('.properties-section[aria-label="Milestones"]').getByText('Discovery exit').first()).toBeVisible()

  await page.getByLabel('Work product for Discovery exit').selectOption({ label: 'Discovery brief' })
  await page.getByLabel('Maturity at milestone for Discovery exit').fill('Approved')
  await page.locator('.milestone-state-row').filter({ hasText: 'Discovery exit' }).getByRole('button', { name: 'Add maturity' }).click()
  await expect(page.getByText('Discovery exit · 1 maturities')).toBeVisible()

  await expect.poll(async () => {
    const documents = await getSavedDocuments(page)
    const assets = documents[0]?.processAssets
    return {
      roleKinds: Object.values(documents[0]?.nodes ?? {}).flatMap((node) =>
        (node.responsibilities ?? []).map((responsibility) => `${responsibility.kind}:${responsibility.roleName}`),
      ),
      roleTags: Object.values(documents[0]?.nodes ?? {}).flatMap((node) => node.roleTags ?? []),
      workProducts: Object.values(assets?.workProducts ?? {}).map((asset) => asset.title),
      guidance: Object.values(assets?.guidanceItems ?? {}).map((asset) => `${asset.kind}:${asset.title}`),
      milestones: Object.values(assets?.milestones ?? {}).map((asset) => ({
        title: asset.title,
        states: asset.workProductStates.map((state) => state.state),
      })),
    }
  }, { timeout: 7000 }).toEqual({
    roleKinds: ['accountable:Product Manager'],
    roleTags: ['Product Manager'],
    workProducts: ['Discovery brief'],
    guidance: ['checklist:Interview checklist'],
    milestones: [{ title: 'Discovery exit', states: ['Approved'] }],
  })

  await page.getByRole('button', { name: 'Close' }).click()
  const assetsPanel = page.getByRole('complementary', { name: 'Process assets' })
  await assetsPanel.getByRole('button', { name: 'Expand Process assets' }).click()
  await assetsPanel.getByRole('button', { name: 'Work Products', exact: true }).click()
  await assetsPanel.getByRole('button', { name: /select discovery brief/i }).click()
  await expect(assetsPanel.getByLabel('Work product title')).toHaveValue('Discovery brief')

  await assetsPanel.getByLabel('Default maturity').fill('Ready')
  await assetsPanel.getByLabel('Default maturity').blur()
  await assetsPanel.getByLabel('Work product description').fill('Validated customer evidence for delivery')
  await assetsPanel.getByLabel('Work product description').blur()
  await assetsPanel.getByLabel('Add handoff').selectOption({ index: 1 })
  await assetsPanel.getByRole('button', { name: 'Link handoff' }).click()
  await assetsPanel.getByRole('button', { name: /unlink producer new activity/i }).click()

  await assetsPanel.getByRole('button', { name: 'Guidance', exact: true }).click()
  await assetsPanel.getByRole('button', { name: /select interview checklist/i }).click()
  await assetsPanel.getByLabel('Guidance URL').fill('https://example.test/interview-checklist')
  await assetsPanel.getByLabel('Guidance URL').blur()
  await assetsPanel.getByLabel('Add work product').selectOption({ label: 'Discovery brief' })
  await assetsPanel.getByRole('button', { name: 'Link work product' }).click()
  await assetsPanel.getByRole('button', { name: /delete interview checklist/i }).click()
  await assetsPanel.getByRole('button', { name: /confirm delete interview checklist/i }).click()

  await assetsPanel.getByRole('button', { name: 'Milestones', exact: true }).click()
  await assetsPanel.getByRole('button', { name: /select discovery exit/i }).click()
  await assetsPanel.getByLabel('Maturity at milestone for Discovery brief').fill('Released')
  await assetsPanel.getByLabel('Maturity at milestone for Discovery brief').blur()

  await expect.poll(async () => {
    const documents = await getSavedDocuments(page)
    const document = documents[0]
    const assets = document?.processAssets
    const workProduct = Object.values(assets?.workProducts ?? {})[0]
    const milestone = Object.values(assets?.milestones ?? {})[0]
    return {
      workProduct: workProduct ? {
        state: workProduct.state,
        description: workProduct.description,
        producers: workProduct.producerNodeIds.length,
        handoffs: workProduct.handoffEdgeIds.length,
        guidanceIds: workProduct.guidanceIds.length,
      } : null,
      edgeWorkProducts: Object.values(document?.edges ?? {}).flatMap((edge) => edge.workProductIds ?? []),
      guidanceCount: Object.keys(assets?.guidanceItems ?? {}).length,
      milestoneStates: milestone?.workProductStates.map((state) => state.state) ?? [],
    }
  }, { timeout: 7000 }).toEqual({
    workProduct: {
      state: 'Ready',
      description: 'Validated customer evidence for delivery',
      producers: 0,
      handoffs: 1,
      guidanceIds: 0,
    },
    edgeWorkProducts: [expect.any(String)],
    guidanceCount: 0,
    milestoneStates: ['Released'],
  })

  await page.getByRole('button', { name: 'Perspectives' }).click()
  await expect(assetsPanel.getByRole('heading', { name: 'What' })).toBeVisible()
  await expect(assetsPanel.getByRole('heading', { name: 'Who' })).toBeVisible()
  await expect(assetsPanel.getByRole('heading', { name: 'When' })).toBeVisible()
  await expect(assetsPanel.getByRole('heading', { name: 'How' })).toBeVisible()
  await expect(assetsPanel.getByText('Discovery brief').first()).toBeVisible()
  await expect(assetsPanel.getByText('Product Manager').first()).toBeVisible()

  await page.reload()
  await page.waitForSelector(pixiCanvas, { timeout: 30000 })
  await expect(page.getByRole('complementary', { name: 'Process assets' }).getByText('Discovery brief').first()).toBeVisible({ timeout: 10000 })
  await page.getByRole('button', { name: 'Work Products' }).click()
  await page.getByRole('button', { name: /select discovery brief/i }).click()
  await expect(page.getByLabel('Default maturity')).toHaveValue('Ready')
})

test('allows one work product to move through different maturity levels in one activity', async ({ page }) => {
  await page.keyboard.press('0')
  await addElement(page, 'Activity')
  await openLatestNodeEditor(page, 'activity')

  await page.getByLabel('New input work product').fill('Research brief')
  await page.getByLabel('New input maturity').fill('Draft')
  await page.getByRole('button', { name: 'Add input work product' }).click()
  await expect(page.getByText('Research brief · Draft')).toBeVisible()

  await page.getByLabel('Existing output work product').selectOption({ label: 'Research brief' })
  await expect(page.getByText('Same maturity cannot be both input and output for this activity. Choose another maturity or unlink first.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Link output work product' })).toBeDisabled()

  await page.getByLabel('Existing output maturity').fill('Approved')
  await page.getByRole('button', { name: 'Link output work product' }).click()
  await expect(page.getByText('Research brief · Approved')).toBeVisible()

  await expect.poll(async () => {
    const documents = await getSavedDocuments(page)
    const workProduct = Object.values(documents[0]?.processAssets?.workProducts ?? {})[0]
    return (workProduct?.activityLinks ?? [])
      .map((link) => `${link.relation}:${link.maturity}`)
      .sort()
  }, { timeout: 7000 }).toEqual(['input:Draft', 'output:Approved'])

  await page.getByRole('button', { name: 'Close' }).click()
  const assetsPanel = page.getByRole('complementary', { name: 'Process assets' })
  await assetsPanel.getByRole('button', { name: 'Expand Process assets' }).click()
  await assetsPanel.getByRole('button', { name: 'Perspectives', exact: true }).click()
  await expect(assetsPanel.getByText('Draft -> Approved')).toBeVisible()

  await page.reload()
  await page.waitForSelector(pixiCanvas, { timeout: 30000 })
  await expect.poll(async () => {
    const documents = await getSavedDocuments(page)
    const workProduct = Object.values(documents[0]?.processAssets?.workProducts ?? {})[0]
    return (workProduct?.activityLinks ?? []).map((link) => `${link.relation}:${link.maturity}`).sort()
  }, { timeout: 7000 }).toEqual(['input:Draft', 'output:Approved'])
})
