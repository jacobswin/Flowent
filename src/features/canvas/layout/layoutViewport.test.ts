import { describe, expect, it } from 'vitest'
import type { GraphNode, GraphViewport } from '../canvasTypes'
import { getLayoutViewport } from './layoutViewport'

const viewport: GraphViewport = { x: -420, y: -120, zoom: 0.67 }

function node(id: string, x: number, y: number, width = 220, height = 112): GraphNode {
  return { id, type: 'activity', x, y, width, height, title: id, roleTags: [], ports: [] }
}

describe('getLayoutViewport', () => {
  it('brings the beginning of a horizontal Flow back into view and centers its mainline', () => {
    const result = getLayoutViewport([
      node('start', 180, 182, 120, 56),
      node('first', 536, 154),
      node('second', 892, 154),
    ], 'left-to-right', viewport)

    expect(180 * result.zoom + result.x).toBeGreaterThanOrEqual(72)
    expect(182 * result.zoom + result.y).toBeGreaterThan(200)
    expect(result.zoom).toBeGreaterThanOrEqual(0.5)
  })

  it('brings a Swimlane surface into view from its role column and header', () => {
    const result = getLayoutViewport([
      node('first', 660, 222),
      node('second', 660, 410),
    ], 'swimlane', viewport)

    expect(120 * result.zoom + result.x).toBeGreaterThanOrEqual(36)
    expect(100 * result.zoom + result.y).toBeGreaterThanOrEqual(56)
  })
})
