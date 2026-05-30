import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useCanvasState } from './useCanvasState'

describe('useCanvasState', () => {
  it('adds activity node from toolbar action', () => {
    const { result } = renderHook(() => useCanvasState())

    act(() => result.current.addActivity())

    expect(result.current.nodes.some((n) => n.data.kind === 'activity')).toBe(true)
  })

  it('adds decision and end nodes from toolbar actions', () => {
    const { result } = renderHook(() => useCanvasState())

    act(() => result.current.addDecision())
    act(() => result.current.addEnd())

    expect(result.current.nodes.some((n) => n.data.kind === 'decision')).toBe(true)
    expect(result.current.nodes.some((n) => n.data.kind === 'end')).toBe(true)
  })

  it('undoes and redoes node creation', () => {
    const { result } = renderHook(() => useCanvasState())

    const initialCount = result.current.nodes.length

    act(() => result.current.addActivity())
    const createdCount = result.current.nodes.length
    expect(createdCount).toBeGreaterThan(initialCount)

    act(() => result.current.undo())
    expect(result.current.nodes.length).toBe(initialCount)

    act(() => result.current.redo())
    expect(result.current.nodes.length).toBe(createdCount)
  })

  it('updates node data by id', () => {
    const { result } = renderHook(() => useCanvasState())

    act(() => {
      result.current.addActivity({ x: 120, y: 180 })
    })

    const createdNode = result.current.nodes.find((n) => n.data.kind === 'activity')
    expect(createdNode).toBeTruthy()

    act(() => {
      result.current.updateNodeData(createdNode!.id, {
        title: 'Updated activity title',
        summary: 'Updated activity summary',
      })
    })

    const updatedNode = result.current.nodes.find((n) => n.id === createdNode!.id)
    expect(updatedNode?.data.kind).toBe('activity')
    if (updatedNode?.data.kind === 'activity') {
      expect(updatedNode.data.title).toBe('Updated activity title')
      expect(updatedNode.data.summary).toBe('Updated activity summary')
    }
  })

  it('selects multiple nodes with additive click', () => {
    const { result } = renderHook(() => useCanvasState())

    act(() => result.current.addActivity({ x: 100, y: 100 }))
    act(() => result.current.addActivity({ x: 400, y: 100 }))

    const ids = result.current.nodes.map((n) => n.id)

    act(() => result.current.onNodeClick(ids[0], false))
    expect(result.current.selectedNodeIds.size).toBe(1)

    act(() => result.current.onNodeClick(ids[1], true))
    expect(result.current.selectedNodeIds.size).toBe(2)
  })

  it('removes selected node and connected edges', () => {
    const { result } = renderHook(() => useCanvasState())

    act(() => {
      result.current.addActivity({ x: 100, y: 200 })
    })

    const selectedIds = Array.from(result.current.selectedNodeIds)
    expect(selectedIds.length).toBe(1)

    act(() => {
      result.current.removeSelected()
    })

    expect(result.current.nodes.find((n) => n.id === selectedIds[0])).toBeUndefined()
  })
})
