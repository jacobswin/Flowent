import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  // The library backend is a single shared file; running tests in parallel
  // makes one worker's reset step race with another worker's reads. Run
  // serially instead — each test's beforeEach resets the library.
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:5173',
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
    command: 'npm run preview',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: !process.env.CI,
  },
})
