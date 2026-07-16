import { beforeEach, describe, expect, it, vi } from 'vitest'

const pixi = vi.hoisted(() => ({
  destroy: vi.fn(() => {
    throw new Error('renderer cleanup failed')
  }),
  stop: vi.fn(),
}))

vi.mock('pixi.js', () => {
  class Container {
    eventMode?: string
    addChild = vi.fn()
  }

  class Application {
    canvas = document.createElement('canvas')
    stage = new Container()
    ticker = { stop: pixi.stop }
    init = vi.fn(async () => undefined)
    destroy = pixi.destroy
  }

  return { Application, Container }
})

import { createPixiStage } from './pixiStage'

describe('createPixiStage', () => {
  beforeEach(() => {
    pixi.destroy.mockClear()
    pixi.stop.mockClear()
  })

  it('stops the ticker and removes the canvas when renderer cleanup fails', async () => {
    const host = document.createElement('div')
    const stage = await createPixiStage(host)

    expect(host.querySelector('canvas')).toBe(stage.app.canvas)

    expect(() => stage.destroy()).not.toThrow()

    expect(pixi.stop).toHaveBeenCalledOnce()
    expect(host.querySelector('canvas')).toBeNull()
  })
})
