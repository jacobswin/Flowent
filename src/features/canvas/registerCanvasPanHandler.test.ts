import { describe, expect, it, vi } from 'vitest'
import type { FederatedPointerEvent, Graphics } from 'pixi.js'
import { registerCanvasPanHandler } from './registerCanvasPanHandler'

type EventName = 'pointerdown' | 'globalpointermove' | 'pointerup' | 'pointerupoutside'

type HandlerMap = Partial<Record<EventName, (event?: FederatedPointerEvent) => void>>

function createFakeHitArea() {
  const handlers: HandlerMap = {}
  const hitArea = {
    cursor: 'default',
    on: vi.fn((event: EventName, handler: (event?: FederatedPointerEvent) => void) => {
      handlers[event] = handler
    }),
    off: vi.fn((event: EventName, handler: (event?: FederatedPointerEvent) => void) => {
      if (handlers[event] === handler) {
        delete handlers[event]
      }
    }),
  }

  return {
    hitArea: hitArea as unknown as Graphics & { cursor: string },
    handlers,
  }
}

describe('registerCanvasPanHandler', () => {
  it('cancels an in-flight pan when Space is released mid-drag', () => {
    const { hitArea, handlers } = createFakeHitArea()
    const panBy = vi.fn()
    let spaceDown = true

    registerCanvasPanHandler({
      hitArea,
      getCanvas: () => ({ panBy }),
      getSpaceDown: () => spaceDown,
    })

    handlers.pointerdown?.({ globalX: 100, globalY: 100 } as FederatedPointerEvent)
    handlers.globalpointermove?.({ globalX: 130, globalY: 120 } as FederatedPointerEvent)
    expect(panBy).toHaveBeenCalledTimes(1)
    expect(hitArea.cursor).toBe('grabbing')

    spaceDown = false
    handlers.globalpointermove?.({ globalX: 170, globalY: 150 } as FederatedPointerEvent)
    expect(panBy).toHaveBeenCalledTimes(1)
    expect(hitArea.cursor).toBe('default')
  })

  it('restores cursor on pointerupoutside', () => {
    const { hitArea, handlers } = createFakeHitArea()
    let spaceDown = true

    registerCanvasPanHandler({
      hitArea,
      getCanvas: () => ({ panBy: vi.fn() }),
      getSpaceDown: () => spaceDown,
    })

    handlers.pointerdown?.({ globalX: 50, globalY: 60 } as FederatedPointerEvent)
    expect(hitArea.cursor).toBe('grabbing')

    spaceDown = false
    handlers.pointerupoutside?.({} as FederatedPointerEvent)
    expect(hitArea.cursor).toBe('default')
  })
})
