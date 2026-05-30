import type { GraphNode, GraphViewport } from '../canvasTypes'

export function isNodeVisible(node: GraphNode, viewport: GraphViewport, canvasWidth: number, canvasHeight: number): boolean {
  const left = (0 - viewport.x) / viewport.zoom
  const right = (canvasWidth - viewport.x) / viewport.zoom
  const top = (0 - viewport.y) / viewport.zoom
  const bottom = (canvasHeight - viewport.y) / viewport.zoom

  const nodeRight = node.x + node.width
  const nodeBottom = node.y + node.height

  return nodeRight >= left && node.x <= right && nodeBottom >= top && node.y <= bottom
}

export function getVisibleNodes(
  nodes: GraphNode[],
  viewport: GraphViewport,
  canvasWidth: number,
  canvasHeight: number,
): GraphNode[] {
  return nodes.filter((node) => isNodeVisible(node, viewport, canvasWidth, canvasHeight))
}
