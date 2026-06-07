import { render, screen, waitFor, cleanup } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import App from './App'

describe('App', () => {
  it('renders single-screen visual modeler with canvas tools', async () => {
    // The library gate calls /api/library on mount. In jsdom there's no
    // server, so stub fetch to return an empty library — that lets
    // LibraryGate auto-create a "Welcome" starter map, render the toolbar,
    // and the test pass without standing up a real backend.
    let nextMapId = 0
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url
      const method = init?.method ?? (input instanceof Request ? input.method : 'GET')
      if (url.endsWith('/api/library') && method === 'GET') {
        return new Response(JSON.stringify({ success: true, data: { folders: [], maps: [] } }), {
          status: 200, headers: { 'content-type': 'application/json' },
        })
      }
      if (url.endsWith('/api/library/maps') && method === 'POST') {
        nextMapId++
        return new Response(JSON.stringify({ success: true, data: { id: `map-${nextMapId}`, name: 'Welcome', folderId: null, order: 0, updatedAt: Date.now() } }), {
          status: 201, headers: { 'content-type': 'application/json' },
        })
      }
      return new Response(JSON.stringify({ success: true, data: {} }), {
        status: 200, headers: { 'content-type': 'application/json' },
      })
    })

    render(<App />)

    expect(screen.getByText('Flowent')).toBeInTheDocument()
    expect(screen.getByText('Process maps for aligned product teams')).toBeInTheDocument()
    // PIXI's WebGL init + the dynamic import of the LibraryGate chunk is
    // slow under jsdom; give the toolbar a generous wait window.
    await waitFor(() => {
      expect(screen.getByRole('toolbar', { name: /canvas tools/i })).toBeInTheDocument()
    }, { timeout: 12000 })

    // Unmount first so the library hook stops firing fetches into a
    // spy that we're about to restore, then restore the spy.
    cleanup()
    fetchSpy.mockRestore()
  })
})
