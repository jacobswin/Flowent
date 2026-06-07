import { test, expect } from '@playwright/test'

const pixiCanvas = '.pixi-host canvas'

test('LIVE: take screenshots of the canvas in several states', async ({ page }) => {
  page.on('pageerror', (err) => console.log('[pageerror]', err.message))
  page.on('console', (msg) => {
    if (msg.type() === 'error') console.log('[console.error]', msg.text())
  })

  await page.goto('/')
  await page.waitForSelector(pixiCanvas)
  await page.waitForTimeout(300)
  await page.keyboard.press('0')
  await page.waitForTimeout(80)
  await page.screenshot({ path: 'test-results/01-initial.png', fullPage: true })

  // Add an activity, a decision, an end.
  await page.locator('button:has-text("Activity")').click()
  await page.waitForTimeout(120)
  await page.locator('button:has-text("Decision")').click()
  await page.waitForTimeout(120)
  await page.locator('button:has-text("End")').click()
  await page.waitForTimeout(120)
  await page.screenshot({ path: 'test-results/02-with-nodes.png', fullPage: true })

  // Auto-layout
  await page.locator('button:has-text("Layout")').click()
  await page.waitForTimeout(300)
  await page.screenshot({ path: 'test-results/03-laid-out.png', fullPage: true })

  // Connect start to first activity via port drag.
  const box = await page.locator(pixiCanvas).boundingBox()
  if (!box) throw new Error('no pixi canvas')

  // After layout, start sits at world (200, 450) with size 120x56 → out at (320, 478).
  // First activity at (520, 450) size 220x96 → in at (520, 498).
  const outX = box.x + 320
  const outY = box.y + 478
  const inX = box.x + 520
  const inY = box.y + 498

  await page.mouse.move(outX, outY)
  await page.mouse.down()
  for (let i = 1; i <= 12; i++) {
    const t = i / 12
    await page.mouse.move(outX + (inX - outX) * t, outY + (inY - outY) * t)
    await page.waitForTimeout(30)
  }
  await page.mouse.up()
  await page.waitForTimeout(300)
  await page.screenshot({ path: 'test-results/04-after-edge.png', fullPage: true })

  // Verify an edge was created.
  const status = await page.locator('.status-bar').textContent()
  console.log('[status after edge]', status)
  expect(status).toContain('1 edges')
})
