import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import config from './playwright.config'

describe('Playwright E2E server config', () => {
  it('starts an isolated preview server by default', () => {
    expect(config.use?.baseURL).toBe('http://127.0.0.1:5174')
    expect(config.webServer).toMatchObject({
      command: 'node scripts/e2e-preview.mjs',
      url: 'http://127.0.0.1:5174',
      reuseExistingServer: false,
    })
  })

  it('keeps E2E preview process env setup in the cross-platform launcher', () => {
    const launcher = readFileSync('scripts/e2e-preview.mjs', 'utf8')

    expect(launcher).toContain("FLOWENT_E2E_API_PORT ?? '8788'")
    expect(launcher).toContain("FLOWENT_E2E_LIBRARY_FILE ?? '/tmp/flowent-e2e-library.json'")
    expect(launcher).toContain('FLOWENT_API_PORT: apiPort')
    expect(launcher).toContain('FLOWENT_LIBRARY_FILE: libraryFile')
  })
})
