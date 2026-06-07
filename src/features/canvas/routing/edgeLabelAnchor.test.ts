import { describe, expect, it } from 'vitest'
import { getEdgeLabelAnchor, sampleBezierMidpoint } from './edgeLabelAnchor'

describe('getEdgeLabelAnchor', () => {
  it('returns null when there are no segments', () => {
    expect(getEdgeLabelAnchor([])).toBeNull()
  })

  it('returns null when the route is just a single point', () => {
    expect(getEdgeLabelAnchor([{ x: 100, y: 100 }])).toBeNull()
  })

  it('skips diagonal segments and finds the longest axis-aligned one', () => {
    const anchor = getEdgeLabelAnchor([
      { x: 0, y: 0 },
      { x: 50, y: 50 },
      { x: 200, y: 50 },
    ])

    expect(anchor).toEqual({ x: 125, y: 50 })
  })

  it('prefers a long vertical middle segment when horizontal runs are short', () => {
    const anchor = getEdgeLabelAnchor([
      { x: 0, y: 0 },
      { x: 32, y: 0 },
      { x: 32, y: 200 },
      { x: 64, y: 200 },
    ])

    expect(anchor).toEqual({ x: 32, y: 100 })
  })

  it('skips zero-length segments and still returns the next axis-aligned midpoint', () => {
    const anchor = getEdgeLabelAnchor([
      { x: 0, y: 0 },
      { x: 0, y: 0 },
      { x: 60, y: 0 },
    ])

    expect(anchor).toEqual({ x: 30, y: 0 })
  })
})

describe('sampleBezierMidpoint', () => {
  it('returns the from point when control and to points coincide with from', () => {
    const midpoint = sampleBezierMidpoint({
      from: { x: 10, y: 10 },
      cp1: { x: 10, y: 10 },
      cp2: { x: 10, y: 10 },
      to: { x: 10, y: 10 },
    })

    expect(midpoint).toEqual({ x: 10, y: 10 })
  })

  it('lands at the visual midpoint for a typical horizontal connector', () => {
    const midpoint = sampleBezierMidpoint({
      from: { x: 0, y: 0 },
      cp1: { x: 50, y: 0 },
      cp2: { x: 150, y: 0 },
      to: { x: 200, y: 0 },
    })

    expect(midpoint.x).toBeCloseTo(100, 5)
    expect(midpoint.y).toBeCloseTo(0, 5)
  })

  it('lands at the visual midpoint for a typical vertical connector', () => {
    const midpoint = sampleBezierMidpoint({
      from: { x: 0, y: 0 },
      cp1: { x: 0, y: 60 },
      cp2: { x: 0, y: 140 },
      to: { x: 0, y: 200 },
    })

    expect(midpoint.x).toBeCloseTo(0, 5)
    expect(midpoint.y).toBeCloseTo(100, 5)
  })
})
