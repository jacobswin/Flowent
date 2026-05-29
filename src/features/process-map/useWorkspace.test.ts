import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useWorkspace } from './useWorkspace'
import type { ProcessMap } from './types'

const sampleMap: ProcessMap = {
  id: 'test-map',
  title: 'Test map',
  status: 'draft',
  scenario: 'Test scenario',
  roles: [{ id: 'pm', name: 'Product Manager', kind: 'role', focus: 'Clarifies outcomes' }],
  stakeholders: [],
  upstreamActors: [],
  downstreamActors: [],
  inputs: [{ id: 'req', title: 'Change request', sourceActorIds: [] }],
  outputs: [{ id: 'update', title: 'Feature update', producerActorIds: ['pm'], recipientActorIds: [] }],
  workProducts: [],
  expectations: [],
  decisions: [],
  handoffs: [],
  activities: [
    {
      id: 'plan',
      title: 'Plan work',
      summary: 'PM plans the work.',
      responsibilities: [{ actorId: 'pm', kind: 'responsible' }],
      inputIds: ['req'],
      outputIds: ['update'],
      decisionIds: [],
      handoffIds: [],
      expectationIds: [],
      workProductIds: [],
    },
  ],
}

describe('useWorkspace', () => {
  it('initializes with provided map and empty sources', () => {
    const { result } = renderHook(() => useWorkspace(sampleMap, {}))

    expect(result.current.map.title).toBe('Test map')
    expect(result.current.map.activities).toHaveLength(1)
    expect(result.current.isDirty).toBe(false)
  })

  it('tracks edits and marks dirty', () => {
    const { result } = renderHook(() => useWorkspace(sampleMap, {}))

    act(() => {
      result.current.updateTitle('Updated title')
    })

    expect(result.current.map.title).toBe('Updated title')
    expect(result.current.isDirty).toBe(true)
  })

  it('supports undo and redo', () => {
    const { result } = renderHook(() => useWorkspace(sampleMap, {}))

    act(() => {
      result.current.updateTitle('Updated title')
    })
    expect(result.current.map.title).toBe('Updated title')
    expect(result.current.canUndo).toBe(true)

    act(() => {
      result.current.undo()
    })
    expect(result.current.map.title).toBe('Test map')
    expect(result.current.canRedo).toBe(true)

    act(() => {
      result.current.redo()
    })
    expect(result.current.map.title).toBe('Updated title')
  })

  it('adds an activity through the hook', () => {
    const { result } = renderHook(() => useWorkspace(sampleMap, {}))

    act(() => {
      result.current.addActivity({
        id: 'implement',
        title: 'Implement',
        summary: 'Implement the feature.',
        responsibilities: [],
        inputIds: [],
        outputIds: [],
        decisionIds: [],
        handoffIds: [],
        expectationIds: [],
        workProductIds: [],
      })
    })

    expect(result.current.map.activities).toHaveLength(2)
    expect(result.current.sources['implement']).toBe('user-provided')
  })

  it('removes an activity through the hook', () => {
    const { result } = renderHook(() => useWorkspace(sampleMap, {}))

    act(() => {
      result.current.removeActivity('plan')
    })

    expect(result.current.map.activities).toHaveLength(0)
  })

  it('computes readiness', () => {
    const { result } = renderHook(() => useWorkspace(sampleMap, {}))

    expect(result.current.readiness.isReady).toBe(true)

    act(() => {
      result.current.removeActivity('plan')
    })

    expect(result.current.readiness.isReady).toBe(false)
    expect(result.current.readiness.missing).toContain('Add at least one activity.')
  })
})
