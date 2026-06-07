import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useEdgeLabelEditor } from './useEdgeLabelEditor'

describe('useEdgeLabelEditor', () => {
  it('starts closed with no anchor', () => {
    const { result } = renderHook(() => useEdgeLabelEditor())
    expect(result.current.openEdgeId).toBeNull()
    expect(result.current.anchor).toBeNull()
  })

  it('records anchor and edge id on openAt', () => {
    const { result } = renderHook(() => useEdgeLabelEditor())
    const anchor = { x: 120, y: 80 }

    act(() => {
      result.current.openAt('edge-1', anchor)
    })

    expect(result.current.openEdgeId).toBe('edge-1')
    expect(result.current.anchor).toEqual(anchor)
  })

  it('invokes onCommit and closes the editor on commit', () => {
    const onCommit = vi.fn()
    const { result } = renderHook(() => useEdgeLabelEditor(onCommit))

    act(() => {
      result.current.openAt('edge-1', { x: 0, y: 0 })
    })

    act(() => {
      result.current.commit('PM handoff')
    })

    expect(onCommit).toHaveBeenCalledWith('edge-1', 'PM handoff')
    expect(result.current.openEdgeId).toBeNull()
    expect(result.current.anchor).toBeNull()
  })

  it('does not invoke onCommit for a no-op commit when the editor is closed', () => {
    const onCommit = vi.fn()
    const { result } = renderHook(() => useEdgeLabelEditor(onCommit))

    act(() => {
      result.current.commit('PM handoff')
    })

    expect(onCommit).not.toHaveBeenCalled()
  })

  it('closes the editor without invoking onCommit on cancel', () => {
    const onCommit = vi.fn()
    const { result } = renderHook(() => useEdgeLabelEditor(onCommit))

    act(() => {
      result.current.openAt('edge-1', { x: 0, y: 0 })
    })

    act(() => {
      result.current.cancel()
    })

    expect(onCommit).not.toHaveBeenCalled()
    expect(result.current.openEdgeId).toBeNull()
    expect(result.current.anchor).toBeNull()
  })
})
