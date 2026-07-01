import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const apiPort = process.env.FLOWENT_API_PORT ?? '8787'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': `http://127.0.0.1:${apiPort}`,
    },
  },
  // Pre-bundle heavy deps in dev so the browser doesn't have to fetch
  // and parse hundreds of unbundled ESM files on first load. Without
  // this, Pixi.js alone opens ~40 separate module requests and the
  // page can take many seconds to even become interactive.
  optimizeDeps: {
    include: ['pixi.js', 'react', 'react-dom', 'react-dom/client'],
  },
  build: {
    // The lazy Pixi vendor chunk sits just above Vite's 500 kB default
    // after minification. Keep the warning threshold close enough to catch
    // real growth while avoiding noise for the intentionally isolated chunk.
    chunkSizeWarningLimit: 600,
    // Split React into a separate chunk so it isn't redownloaded when
    // the PIXI/lazy chunk changes. PIXI is already split via the
    // React.lazy boundary in App.tsx.
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react') || id.includes('node_modules/scheduler')) {
            return 'react'
          }
          if (id.includes('node_modules/pixi.js')) {
            return 'pixi'
          }
          return undefined
        },
      },
    },
    target: 'es2020',
    minify: 'esbuild',
  },
})
