import { test, expect } from '@playwright/test'
import { resetLibrary } from './canvasDockHelpers'

const libraryPanel = '.library-panel'

test.beforeEach(async ({ page }) => {
  await resetLibrary(page)
})

test('library renders a Welcome starter map on first load', async ({ page }) => {
  await expect(page.locator(libraryPanel)).toBeVisible()
  await expect(page.getByText('Welcome', { exact: true }).first()).toBeVisible({ timeout: 10000 })
})

test('clicking + Map adds a new map and selects it', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator(libraryPanel)).toBeVisible()
  await page.waitForTimeout(800)

  await page.getByRole('button', { name: '+ Map', exact: true }).click()
  await page.getByPlaceholder('New map name').fill('Onboarding flow')
  await page.getByRole('button', { name: 'Confirm' }).click()

  await expect(page.getByText('Onboarding flow', { exact: true })).toBeVisible({ timeout: 5000 })
  // The new map is selected: the LibraryGate should switch to it
  await expect(page.getByText('Onboarding flow', { exact: true })).toBeVisible()
})

test('renaming a map updates the list and persists across reload', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator(libraryPanel)).toBeVisible()
  await page.waitForTimeout(800)

  await page.getByRole('button', { name: '+ Map', exact: true }).click()
  await page.getByPlaceholder('New map name').fill('Original name')
  await page.getByRole('button', { name: 'Confirm' }).click()
  await page.waitForTimeout(500)

  // Open the rename input by clicking the pencil icon on the new map row
  const mapRow = page.locator('.library-map').filter({ hasText: 'Original name' })
  await mapRow.hover()
  await mapRow.getByRole('button', { name: 'Rename', exact: true }).click()

  const editInput = page.locator('.library-inline-edit')
  await editInput.fill('Renamed flow')
  await editInput.press('Enter')

  await expect(page.getByText('Renamed flow', { exact: true })).toBeVisible({ timeout: 5000 })

  // Reload, the new name should persist
  await page.reload()
  await expect(page.locator(libraryPanel)).toBeVisible()
  await expect(page.getByText('Renamed flow', { exact: true })).toBeVisible({ timeout: 5000 })
})

test('deleting a map removes it from the list', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator(libraryPanel)).toBeVisible()
  await page.waitForTimeout(800)

  await page.getByRole('button', { name: '+ Map', exact: true }).click()
  await page.getByPlaceholder('New map name').fill('To delete')
  await page.getByRole('button', { name: 'Confirm' }).click()
  await page.waitForTimeout(500)

  const mapRow = page.locator('.library-map').filter({ hasText: 'To delete' })
  await mapRow.hover()
  await mapRow.getByRole('button', { name: 'Delete', exact: true }).click()

  // Confirm dialog
  await page.locator('.library-confirm').getByRole('button', { name: 'Delete' }).click()

  await expect(page.getByText('To delete', { exact: true })).toHaveCount(0, { timeout: 5000 })
})

test('creating a folder, then moving a map into it', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator(libraryPanel)).toBeVisible()
  await page.waitForTimeout(800)

  await page.getByRole('button', { name: '+ Folder', exact: true }).click()
  await page.getByPlaceholder('New folder name').fill('Engineering')
  await page.getByRole('button', { name: 'Confirm' }).click()
  await page.waitForTimeout(300)

  await page.getByRole('button', { name: '+ Map', exact: true }).click()
  await page.getByPlaceholder('New map name').fill('Deployment')
  await page.getByRole('button', { name: 'Confirm' }).click()
  await page.waitForTimeout(500)

  // Move the Deployment map into the Engineering folder
  const mapRow = page.locator('.library-map').filter({ hasText: 'Deployment' })
  await mapRow.hover()
  await mapRow.getByRole('button', { name: 'Move', exact: true }).click()
  await page.getByRole('button', { name: 'Engineering', exact: true }).click()
  await page.waitForTimeout(500)

  // The map should now appear under the Engineering folder
  const folder = page.locator('.library-folder').filter({ hasText: 'Engineering' })
  await expect(folder).toBeVisible()
  await expect(folder.locator('.library-map').filter({ hasText: 'Deployment' })).toBeVisible()
})
