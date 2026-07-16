import { expect, test } from '@playwright/test'

test('generates an automotive-context draft with the selected process intelligence profile', async ({ page }) => {
  let generateRequest: Record<string, unknown> | null = null

  await page.route('**/api/ai/providers', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          providers: [{
            id: 'provider-1', name: 'Mock provider', presetId: 'custom-openai-compatible', protocol: 'openai-compatible',
            apiBaseUrl: 'https://llm.example.test/v1', useFullUrl: false, model: 'mock-model', websiteUrl: '', notes: '',
            hasApiKey: true, maskedApiKey: 'sk-m...mock', isDefault: true,
          }],
          defaultProviderId: 'provider-1',
        },
      }),
    })
  })
  await page.route('**/api/ai/generate-map', async (route) => {
    generateRequest = route.request().postDataJSON() as Record<string, unknown>
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          title: 'DVP validation', summary: 'Validate a DVP before release.', findings: [], warnings: [],
          document: {
            id: 'ai-automotive',
            nodes: {
              validate: {
                id: 'validate', type: 'activity', title: 'Validate DVP', x: 0, y: 0, width: 220, height: 112,
                roleTags: ['DRE'], ports: [],
                processStage: { kind: 'value-add', durationMinutesP50: 60, durationMinutesP90: 90, classificationSource: 'explicit' },
              },
            },
            edges: {}, selectedNodeIds: [], selectedEdgeIds: [], viewport: { x: 0, y: 0, zoom: 1 },
            processAssets: { workProducts: {}, guidanceItems: {}, milestones: {} },
            meta: { dirty: false, version: 1, processAnalysis: { profile: 'automotive', wip: 4 } },
          },
        },
      }),
    })
  })

  await page.goto('/')
  await page.waitForSelector('.pixi-host canvas')
  await page.getByRole('button', { name: 'Generate with AI' }).click()

  const dialog = page.getByRole('dialog', { name: 'Generate with AI' })
  await dialog.getByLabel('Analysis profile').selectOption('automotive')
  await expect(dialog.getByText('Vehicle and subsystem development through validation.')).toBeVisible()
  await dialog.getByLabel('Source text').fill('DRE validates the DVP before production release.')
  await dialog.getByRole('button', { name: 'Generate Draft' }).click()

  const preview = dialog.getByRole('region', { name: 'AI draft preview' })
  await expect(preview).toContainText('DVP validation')
  await expect(preview).toContainText('Automotive Development')
  expect(generateRequest).toMatchObject({ processAnalysis: { profile: 'automotive' } })
})
