import { describe, expect, it } from 'vitest'
import { compactRoutePoints, getLastSegmentDirection, routeOrthogonalEdge } from './orthogonalRouter'

function expectOrthogonal(points: { x: number; y: number }[]): void {
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]
    const current = points[i]
    expect(prev.x === current.x || prev.y === current.y).toBe(true)
  }
}

describe('routeOrthogonalEdge', () => {
  it('routes between two ports using only horizontal and vertical segments', () => {
    const route = routeOrthogonalEdge({
      source: { x: 120, y: 100 },
      sourceSide: 'right',
      target: { x: 420, y: 220 },
      targetSide: 'left',
    })

    expect(route[0]).toEqual({ x: 120, y: 100 })
    expect(route.at(-1)).toEqual({ x: 420, y: 220 })
    expect(route.length).toBeGreaterThanOrEqual(4)
    expectOrthogonal(route)
  })

  it('returns deterministic compact routes without duplicate or collinear points', () => {
    const input = {
      source: { x: 120, y: 100 },
      sourceSide: 'right' as const,
      target: { x: 420, y: 100 },
      targetSide: 'left' as const,
    }

    const first = routeOrthogonalEdge(input)
    const second = routeOrthogonalEdge(input)

    expect(first).toEqual(second)
    expect(first).toEqual(compactRoutePoints(first))
    for (let i = 1; i < first.length; i++) {
      expect(first[i]).not.toEqual(first[i - 1])
    }
  })

  it('derives arrow direction from the final segment', () => {
    expect(getLastSegmentDirection([
      { x: 0, y: 0 },
      { x: 50, y: 0 },
      { x: 50, y: 80 },
    ])).toBe('bottom')
  })
})
