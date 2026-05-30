import { Container, Graphics, Text } from 'pixi.js'
import type { GraphEdge, GraphNode } from '../canvasTypes'

function getPortPosition(node: GraphNode, portId: string): { x: number; y: number } {
  const port = node.ports.find((p) => p.id === portId)
  const side = port?.side ?? 'bottom'

  switch (side) {
    case 'top':
      return { x: node.x + node.width / 2, y: node.y }
    case 'right':
      return { x: node.x + node.width, y: node.y + node.height / 2 }
    case 'left':
      return { x: node.x, y: node.y + node.height / 2 }
    case 'bottom':
    default:
      return { x: node.x + node.width / 2, y: node.y + node.height }
  }
}

export function drawEdges(
  layer: Container,
  edges: GraphEdge[],
  nodesById: Map<string, GraphNode>,
  selectedEdgeId: string | null,
): void {
  layer.removeChildren()

  for (const edge of edges) {
    const source = nodesById.get(edge.sourceNodeId)
    const target = nodesById.get(edge.targetNodeId)
    if (!source || !target) continue

    const from = getPortPosition(source, edge.sourcePortId)
    const to = getPortPosition(target, edge.targetPortId)

    const selected = edge.id === selectedEdgeId

    const curve = new Graphics()
    curve.stroke({ color: selected ? 0x0071e3 : 0xc4c4c6, width: selected ? 2.5 : 1.5 })

    const cp1x = from.x + (to.x - from.x) * 0.25
    const cp1y = from.y
    const cp2x = from.x + (to.x - from.x) * 0.75
    const cp2y = to.y

    curve.moveTo(from.x, from.y)
    curve.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, to.x, to.y)

    const hit = new Graphics()
    hit.stroke({ color: 0x000000, alpha: 0, width: 10 })
    hit.moveTo(from.x, from.y)
    hit.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, to.x, to.y)
    hit.label = edge.id
    ;(hit as Graphics & { eventMode?: string; cursor?: string }).eventMode = 'static'
    ;(hit as Graphics & { eventMode?: string; cursor?: string }).cursor = 'pointer'

    layer.addChild(curve)
    layer.addChild(hit)

    if (edge.label) {
      const label = new Text({
        text: edge.label,
        style: {
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", "Segoe UI", sans-serif',
          fontSize: 11,
          fill: 0x86868b,
        },
      })
      label.x = (from.x + to.x) / 2 - label.width / 2
      label.y = (from.y + to.y) / 2 - label.height / 2
      layer.addChild(label)
    }
  }
}
