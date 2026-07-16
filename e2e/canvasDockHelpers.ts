import type { Page } from '@playwright/test'

export async function resetLibrary(page: Page): Promise<void> {
  await page.goto('/')
  await page.evaluate(async () => {
    try { localStorage.clear() } catch { /* noop */ }
    history.replaceState(null, '', '/')

    const response = await fetch('/api/library')
    const text = await response.text()
    const body = text
      ? JSON.parse(text) as { data: { maps?: { id: string }[]; folders?: { id: string }[] } }
      : { data: { maps: [], folders: [] } }

    for (const map of body.data.maps ?? []) {
      await fetch(`/api/library/maps/${map.id}`, { method: 'DELETE' })
    }
    for (const folder of body.data.folders ?? []) {
      await fetch(`/api/library/folders/${folder.id}`, { method: 'DELETE' })
    }
  })
  await page.reload()
}

export async function expandDockPanel(page: Page, title: string): Promise<void> {
  const expand = page.getByRole('button', { name: new RegExp(`^Expand ${title}$`, 'i') })
  if (await expand.isVisible().catch(() => false)) {
    await expand.click()
  }
}

export async function clickPaletteElement(page: Page, label: string): Promise<void> {
  await expandDockPanel(page, 'Elements')
  await page.locator(`button[aria-label^="${label}:"]`).first().click()
}
