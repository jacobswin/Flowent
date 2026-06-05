import { renderHook, act } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { useLibrary } from './useLibrary'

const originalFetch = globalThis.fetch

describe('useLibrary', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
    globalThis.fetch = originalFetch
  })

  it('deletes a created template map when the template patch fails', async () => {
    const fetchMock = vi.fn()
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: { folders: [], maps: [] } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: { id: 'map-1', name: 'Draft', folderId: null, order: 0, updatedAt: 1 } }) })
      .mockResolvedValueOnce({ ok: false, status: 500 })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: { id: 'map-1' } }) })

    globalThis.fetch = fetchMock as typeof fetch

    const { result } = renderHook(() => useLibrary())

    await act(async () => {
      await vi.runAllTimersAsync()
    })

    await expect(
      act(async () => {
        await result.current.createMapFromTemplate('Draft', null, 'blank')
      }),
    ).rejects.toThrow('HTTP 500')

    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      '/api/library/maps/map-1',
      expect.objectContaining({ method: 'DELETE' }),
    )
    expect(result.current.library.maps).toEqual([])

    await act(async () => {
      await vi.runAllTimersAsync()
    })

    expect(result.current.error).toContain('createMapFromTemplate: HTTP 500')
  })
})
