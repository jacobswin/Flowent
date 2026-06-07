import type { PortSide } from '../canvasTypes'

export interface RoutePoint {
  x: number
  y: number
}

export interface OrthogonalRouteInput {
  source: RoutePoint
  sourceSide: PortSide
  target: RoutePoint
  targetSide: PortSide
  stub?: number
}

const DEFAULT_STUB = 32

export function routeOrthogonalEdge(input: OrthogonalRouteInput): RoutePoint[] {
  const stub = input.stub ?? DEFAULT_STUB
  const sourceStub = moveInDirection(input.source, input.sourceSide, stub)
  const targetStub = moveInDirection(input.target, input.targetSide, stub)
  const points = [input.source, sourceStub]

  if (sourceStub.x === targetStub.x || sourceStub.y === targetStub.y) {
    points.push(targetStub)
  } else if (isHorizontal(input.sourceSide) || isHorizontal(input.targetSide)) {
    const midX = (sourceStub.x + targetStub.x) / 2
    points.push({ x: midX, y: sourceStub.y }, { x: midX, y: targetStub.y }, targetStub)
  } else {
    const midY = (sourceStub.y + targetStub.y) / 2
    points.push({ x: sourceStub.x, y: midY }, { x: targetStub.x, y: midY }, targetStub)
  }

  points.push(input.target)
  return compactRoutePoints(points)
}

export function compactRoutePoints(points: RoutePoint[]): RoutePoint[] {
  const withoutDuplicates: RoutePoint[] = []

  for (const point of points) {
    const last = withoutDuplicates.at(-1)
    if (!last || last.x !== point.x || last.y !== point.y) {
      withoutDuplicates.push(point)
    }
  }

  const compacted: RoutePoint[] = []
  for (const point of withoutDuplicates) {
    const prev = compacted.at(-2)
    const current = compacted.at(-1)

    if (prev && current && isCollinear(prev, current, point)) {
      compacted[compacted.length - 1] = point
    } else {
      compacted.push(point)
    }
  }

  return compacted
}

export function getLastSegmentDirection(points: RoutePoint[]): PortSide | null {
  if (points.length < 2) return null

  const from = points[points.length - 2]
  const to = points[points.length - 1]

  if (to.x > from.x) return 'right'
  if (to.x < from.x) return 'left'
  if (to.y > from.y) return 'bottom'
  if (to.y < from.y) return 'top'
  return null
}

function moveInDirection(point: RoutePoint, side: PortSide, distance: number): RoutePoint {
  switch (side) {
    case 'top':
      return { x: point.x, y: point.y - distance }
    case 'right':
      return { x: point.x + distance, y: point.y }
    case 'bottom':
      return { x: point.x, y: point.y + distance }
    case 'left':
      return { x: point.x - distance, y: point.y }
  }
}

function isHorizontal(side: PortSide): boolean {
  return side === 'left' || side === 'right'
}

function isCollinear(a: RoutePoint, b: RoutePoint, c: RoutePoint): boolean {
  return (a.x === b.x && b.x === c.x) || (a.y === b.y && b.y === c.y)
}
