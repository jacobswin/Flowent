import type { Page } from '@playwright/test'

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
