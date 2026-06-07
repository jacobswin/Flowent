export interface EdgeLabelAnchor {
  x: number
  y: number
}

export function getEdgeLabelAnchor(points: { x: number; y: number }[]): EdgeLabelAnchor | null {
  if (points.length < 2) return null

  let bestLength = Number.NEGATIVE_INFINITY
  let bestAnchor: EdgeLabelAnchor | null = null

  for (let i = 1; i < points.length; i++) {
    const from = points[i - 1]
    const to = points[i]
    const dx = to.x - from.x
    const dy = to.y - from.y
    if (dx === 0 && dy === 0) continue

    if (dx === 0) {
      const length = Math.abs(dy)
      if (length > bestLength) {
        bestLength = length
        bestAnchor = { x: from.x, y: (from.y + to.y) / 2 }
      }
    } else if (dy === 0) {
      const length = Math.abs(dx)
      if (length > bestLength) {
        bestLength = length
        bestAnchor = { x: (from.x + to.x) / 2, y: from.y }
      }
    }
  }

  return bestAnchor
}

/**
 * Cubic Bézier midpoint evaluator. The renderer draws edges as a cubic
 * Bézier with control points cp1 and cp2 — we sample the curve at t=0.5
 * so the label sits on the visible curve, not on the control handle.
 */
export function sampleBezierMidpoint(points: {
  from: { x: number; y: number }
  cp1: { x: number; y: number }
  cp2: { x: number; y: number }
  to: { x: number; y: number }
}): { x: number; y: number } {
  const t = 0.5
  const u = 1 - t
  const x = u * u * u * points.from.x
    + 3 * u * u * t * points.cp1.x
    + 3 * u * t * t * points.cp2.x
    + t * t * t * points.to.x
  const y = u * u * u * points.from.y
    + 3 * u * u * t * points.cp1.y
    + 3 * u * t * t * points.cp2.y
    + t * t * t * points.to.y
  return { x, y }
}
