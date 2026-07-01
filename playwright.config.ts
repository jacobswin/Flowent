import { defineConfig, devices } from '@playwright/test'

const webPort = process.env.FLOWENT_E2E_WEB_PORT ?? '5174'
const baseURL = `http://127.0.0.1:${webPort}`
const reuseExistingServer = process.env.FLOWENT_E2E_REUSE_SERVER === '1'

export default defineConfig({
  testDir: './e2e',
  // The library backend is a single shared file; running tests in parallel
  // makes one worker's reset step race with another worker's reads. Run
  // serially instead — each test's beforeEach resets the library.
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    // Use the production preview + a non-watching API process. Vite dev
    // re-bundles dependencies on first request which makes PIXI cold-load
    // too slow for reliable tests; the production preview serves the
    // already-built bundle.
    command: 'node scripts/e2e-preview.mjs',
    url: baseURL,
    reuseExistingServer,
  },
})
