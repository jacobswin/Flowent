import { describe, expect, it } from 'vitest'
import { mapKeyToAction } from './keyboard'

describe('keyboard map', () => {
  it('maps creation shortcuts', () => {
    expect(mapKeyToAction({ key: 'a', metaKey: false, ctrlKey: false, shiftKey: false })).toBe('tool-activity')
    expect(mapKeyToAction({ key: 'd', metaKey: false, ctrlKey: false, shiftKey: false })).toBe('tool-decision')
    expect(mapKeyToAction({ key: 's', metaKey: false, ctrlKey: false, shiftKey: false })).toBe('tool-start-end')
    expect(mapKeyToAction({ key: 'c', metaKey: false, ctrlKey: false, shiftKey: false })).toBe('tool-connector')
    expect(mapKeyToAction({ key: 'v', metaKey: false, ctrlKey: false, shiftKey: false })).toBe('tool-select')
    expect(mapKeyToAction({ key: 'l', metaKey: false, ctrlKey: false, shiftKey: false })).toBe('auto-layout')
  })

  it('maps undo redo shortcuts', () => {
    expect(mapKeyToAction({ key: 'z', metaKey: true, ctrlKey: false, shiftKey: false })).toBe('undo')
    expect(mapKeyToAction({ key: 'z', metaKey: true, ctrlKey: false, shiftKey: true })).toBe('redo')
    expect(mapKeyToAction({ key: 'z', metaKey: false, ctrlKey: true, shiftKey: false })).toBe('undo')
    expect(mapKeyToAction({ key: 'z', metaKey: false, ctrlKey: true, shiftKey: true })).toBe('redo')
    expect(mapKeyToAction({ key: 'y', metaKey: false, ctrlKey: true, shiftKey: false })).toBe('redo')
  })

  it('does not map delete keys to destructive canvas actions', () => {
    expect(mapKeyToAction({ key: 'Delete', metaKey: false, ctrlKey: false, shiftKey: false })).toBeNull()
    expect(mapKeyToAction({ key: 'Backspace', metaKey: false, ctrlKey: false, shiftKey: false })).toBeNull()
  })

  it('returns null for unrelated keys', () => {
    expect(mapKeyToAction({ key: 'x', metaKey: false, ctrlKey: false, shiftKey: false })).toBeNull()
    expect(mapKeyToAction({ key: 'Enter', metaKey: false, ctrlKey: false, shiftKey: false })).toBeNull()
  })
})
