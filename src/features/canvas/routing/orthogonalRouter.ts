import type { PortSide } from '../canvasTypes'

export interface RoutePoint {
  x: number
  y: number
}

export interface RouteObstacle {
  id?: string
  x: number
  y: number
  width: number
  height: number
}

export interface OrthogonalRouteInput {
  source: RoutePoint
  sourceSide: PortSide
  target: RoutePoint
  targetSide: PortSide
  stub?: number
  obstacles?: RouteObstacle[]
  obstaclePadding?: number
}

const DEFAULT_STUB = 32
const DEFAULT_OBSTACLE_PADDING = 18

export function routeOrthogonalEdge(input: OrthogonalRouteInput): RoutePoint[] {
  const stub = input.stub ?? DEFAULT_STUB
  const sourceStub = moveInDirection(input.source, input.sourceSide, stub)
  const targetStub = moveInDirection(input.target, input.targetSide, stub)
  const obstacles = (input.obstacles ?? []).map((obstacle) => padObstacle(obstacle, input.obstaclePadding ?? DEFAULT_OBSTACLE_PADDING))
  const directRoute = buildOrthogonalRoute(input, sourceStub, targetStub)

  if (obstacles.length === 0 || !routeIntersectsObstacles(directRoute, obstacles)) {
    return directRoute
  }

  return buildDetourRoute(input, sourceStub, targetStub, obstacles)
}

function buildOrthogonalRoute(
  input: OrthogonalRouteInput,
  sourceStub: RoutePoint,
  targetStub: RoutePoint,
): RoutePoint[] {
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

function buildDetourRoute(
  input: OrthogonalRouteInput,
  sourceStub: RoutePoint,
  targetStub: RoutePoint,
  obstacles: RouteObstacle[],
): RoutePoint[] {
  const horizontalPreference = Math.abs(input.target.x - input.source.x) >= Math.abs(input.target.y - input.source.y)
    || isHorizontal(input.sourceSide)
    || isHorizontal(input.targetSide)

  if (horizontalPreference) {
    const laneY = chooseClearLane(
      [
        Math.min(...obstacles.map((obstacle) => obstacle.y)) - 24,
        Math.max(...obstacles.map((obstacle) => obstacle.y + obstacle.height)) + 24,
      ],
      input.source.y,
      input.target.y,
      (candidate) => compactRoutePoints([
        input.source,
        sourceStub,
        { x: sourceStub.x, y: candidate },
        { x: targetStub.x, y: candidate },
        targetStub,
        input.target,
      ]),
      obstacles,
    )

    return compactRoutePoints([
      input.source,
      sourceStub,
      { x: sourceStub.x, y: laneY },
      { x: targetStub.x, y: laneY },
      targetStub,
      input.target,
    ])
  }

  const laneX = chooseClearLane(
    [
      Math.min(...obstacles.map((obstacle) => obstacle.x)) - 24,
      Math.max(...obstacles.map((obstacle) => obstacle.x + obstacle.width)) + 24,
    ],
    input.source.x,
    input.target.x,
    (candidate) => compactRoutePoints([
      input.source,
      sourceStub,
      { x: candidate, y: sourceStub.y },
      { x: candidate, y: targetStub.y },
      targetStub,
      input.target,
    ]),
    obstacles,
  )

  return compactRoutePoints([
    input.source,
    sourceStub,
    { x: laneX, y: sourceStub.y },
    { x: laneX, y: targetStub.y },
    targetStub,
    input.target,
  ])
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

function padObstacle(obstacle: RouteObstacle, padding: number): RouteObstacle {
  return {
    ...obstacle,
    x: obstacle.x - padding,
    y: obstacle.y - padding,
    width: obstacle.width + padding * 2,
    height: obstacle.height + padding * 2,
  }
}

function chooseClearLane(
  candidates: number[],
  sourceCoordinate: number,
  targetCoordinate: number,
  buildRoute: (candidate: number) => RoutePoint[],
  obstacles: RouteObstacle[],
): number {
  const sorted = [...candidates].sort((a, b) => {
    const aCost = Math.abs(a - sourceCoordinate) + Math.abs(a - targetCoordinate)
    const bCost = Math.abs(b - sourceCoordinate) + Math.abs(b - targetCoordinate)
    return aCost - bCost
  })
  return sorted.find((candidate) => !routeIntersectsObstacles(buildRoute(candidate), obstacles)) ?? sorted[0]
}

function routeIntersectsObstacles(points: RoutePoint[], obstacles: RouteObstacle[]): boolean {
  for (let index = 1; index < points.length; index += 1) {
    if (obstacles.some((obstacle) => segmentIntersectsObstacle(points[index - 1], points[index], obstacle))) {
      return true
    }
  }
  return false
}

function segmentIntersectsObstacle(a: RoutePoint, b: RoutePoint, obstacle: RouteObstacle): boolean {
  const left = obstacle.x
  const right = obstacle.x + obstacle.width
  const top = obstacle.y
  const bottom = obstacle.y + obstacle.height

  if (a.x === b.x) {
    if (a.x < left || a.x > right) return false
    const minY = Math.min(a.y, b.y)
    const maxY = Math.max(a.y, b.y)
    return maxY >= top && minY <= bottom
  }

  if (a.y === b.y) {
    if (a.y < top || a.y > bottom) return false
    const minX = Math.min(a.x, b.x)
    const maxX = Math.max(a.x, b.x)
    return maxX >= left && minX <= right
  }

  return false
}
