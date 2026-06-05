import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
    // PIXI's WebGL init under jsdom + the dynamic import of the canvas
    // chunk is slow; bump the default test timeout to keep the App-level
    // smoke test reliable.
    testTimeout: 15000,
    exclude: ['e2e/**', 'node_modules/**', 'dist/**', '.claude/worktrees/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      thresholds: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80,
      },
    },
  },
})
