import { describe, expect, it } from 'vitest'
import config from './playwright.config'

describe('Playwright E2E server config', () => {
  it('starts an isolated preview server by default', () => {
    expect(config.use?.baseURL).toBe('http://127.0.0.1:5174')
    expect(config.webServer).toMatchObject({
      url: 'http://127.0.0.1:5174',
      reuseExistingServer: false,
    })
    expect(config.webServer?.command).toContain('FLOWENT_API_PORT=8788')
    expect(config.webServer?.command).toContain('FLOWENT_LIBRARY_FILE=/tmp/flowent-e2e-library.json')
  })
})
