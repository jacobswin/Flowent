import { describe, expect, it } from 'vitest'
import { createHistoryState, pushHistory, setPresent, undo, redo } from './history'

describe('history', () => {
  it('creates history state with initial present value', () => {
    const state = createHistoryState({ marker: 'state-0' })

    expect(state.past).toEqual([])
    expect(state.present).toEqual({ marker: 'state-0' })
    expect(state.future).toEqual([])
  })

  it('pushes snapshot and supports undo/redo', () => {
    const h0 = createHistoryState({ marker: 'state-0' })
    const h1 = pushHistory(h0, { marker: 'state-1' })
    const h2 = pushHistory(h1, { marker: 'state-2' })

    expect(h2.past).toHaveLength(2)
    expect(h2.present).toEqual({ marker: 'state-2' })

    const u1 = undo(h2)
    expect(u1.present).toEqual({ marker: 'state-1' })
    expect(u1.future).toEqual([{ marker: 'state-2' }])

    const r1 = redo(u1)
    expect(r1.present).toEqual({ marker: 'state-2' })
    expect(r1.future).toEqual([])
  })

  it('returns same state on undo when no past snapshots exist', () => {
    const h0 = createHistoryState({ marker: 'state-0' })
    const u0 = undo(h0)

    expect(u0).toBe(h0)
  })

  it('returns same state on redo when no future snapshots exist', () => {
    const h0 = createHistoryState({ marker: 'state-0' })
    const r0 = redo(h0)

    expect(r0).toBe(h0)
  })

  it('clears future snapshots when pushing new history after undo', () => {
    const h0 = createHistoryState({ marker: 'state-0' })
    const h1 = pushHistory(h0, { marker: 'state-1' })
    const h2 = pushHistory(h1, { marker: 'state-2' })

    const u1 = undo(h2)
    expect(u1.future).toHaveLength(1)

    const h3 = pushHistory(u1, { marker: 'state-1b' })
    expect(h3.future).toEqual([])
    expect(h3.present).toEqual({ marker: 'state-1b' })
  })

  describe('setPresent', () => {
    it('replaces the present without pushing onto the past or future stacks', () => {
      const h0 = createHistoryState({ marker: 'state-0' })
      const h1 = pushHistory(h0, { marker: 'state-1' })

      const transient = setPresent(h1, { marker: 'view-only' })

      expect(transient.present).toEqual({ marker: 'view-only' })
      expect(transient.past).toEqual(h1.past)
      expect(transient.future).toEqual(h1.future)
    })

    it('leaves a real undo untouched after a transient viewport update', () => {
      const h0 = createHistoryState({ marker: 'state-0' })
      const h1 = pushHistory(h0, { marker: 'state-1' })
      const transient = setPresent(h1, { marker: 'view-only' })

      const back = undo(transient)
      expect(back.present).toEqual({ marker: 'state-0' })
    })
  })
})
