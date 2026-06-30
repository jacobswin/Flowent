import { describe, expect, it, vi } from 'vitest'
import {
  DRAG_MIME_TYPE,
  hasDraggedProcessElement,
  readDraggedProcessElement,
} from './processElementDrag'

function makeDataTransfer(types: string[], payload = ''): DataTransfer {
  return {
    types,
    getData: vi.fn(() => payload),
  } as unknown as DataTransfer
}

describe('process element drag payloads', () => {
  it('detects Flowent process element drag payloads', () => {
    expect(hasDraggedProcessElement(makeDataTransfer([DRAG_MIME_TYPE]))).toBe(true)
    expect(hasDraggedProcessElement(makeDataTransfer(['text/plain']))).toBe(false)
  })

  it('reads only supported process element types', () => {
    expect(readDraggedProcessElement(makeDataTransfer([DRAG_MIME_TYPE], 'activity'))).toBe('activity')
    expect(readDraggedProcessElement(makeDataTransfer([DRAG_MIME_TYPE], 'unknown'))).toBeNull()
  })
})
