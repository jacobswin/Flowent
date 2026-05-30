import { Container, Graphics, Text } from 'pixi.js'
import type { GraphNode } from '../canvasTypes'

export function drawNodes(layer: Container, nodes: GraphNode[], selectedNodeId: string | null): void {
  layer.removeChildren()

  for (const node of nodes) {
    const container = new Container()
    container.x = node.x
    container.y = node.y

    const selected = selectedNodeId === node.id

    const shape = new Graphics()

    if (node.type === 'start' || node.type === 'end') {
      const fill = node.type === 'start' ? 0x1d1d1f : 0xffffff
      const stroke = node.type === 'start' ? 0x1d1d1f : 0x1d1d1f
      shape.roundRect(0, 0, node.width, node.height, node.height / 2)
      shape.fill(fill)
      shape.stroke({ color: stroke, width: selected ? 2 : 1.5 })
    } else if (node.type === 'decision') {
      shape.moveTo(node.width / 2, 0)
      shape.lineTo(node.width, node.height / 2)
      shape.lineTo(node.width / 2, node.height)
      shape.lineTo(0, node.height / 2)
      shape.closePath()
      shape.fill(0xffffff)
      shape.stroke({ color: selected ? 0x0071e3 : 0xc4c4c6, width: selected ? 2 : 1.5 })
    } else {
      shape.roundRect(0, 0, node.width, node.height, 12)
      shape.fill(0xffffff)
      shape.stroke({ color: selected ? 0x0071e3 : 0xe5e5e7, width: selected ? 2 : 1.5 })
    }

    const title = new Text({
      text: node.type === 'start' || node.type === 'end' ? node.title : node.title,
      style: {
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", "Segoe UI", sans-serif',
        fontSize: node.type === 'start' || node.type === 'end' ? 12 : 15,
        fontWeight: node.type === 'start' || node.type === 'end' ? '600' : '600',
        fill: node.type === 'start' ? 0xf5f5f7 : 0x1d1d1f,
      },
    })

    title.x = node.type === 'start' || node.type === 'end' ? node.width / 2 - title.width / 2 : 14
    title.y = node.type === 'start' || node.type === 'end' ? node.height / 2 - title.height / 2 : 14

    container.addChild(shape)
    container.addChild(title)

    if (node.summary && node.type === 'activity') {
      const summary = new Text({
        text: node.summary,
        style: {
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", "Segoe UI", sans-serif',
          fontSize: 12,
          fill: 0x86868b,
        },
      })
      summary.x = 14
      summary.y = 36
      container.addChild(summary)
    }

    if (node.roleTags.length > 0 && node.type === 'activity') {
      const roles = new Text({
        text: node.roleTags.join(', '),
        style: {
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", "Segoe UI", sans-serif',
          fontSize: 11,
          fill: 0x86868b,
        },
      })
      roles.x = 14
      roles.y = Math.min(node.height - 20, 58)
      container.addChild(roles)
    }

    ;(container as Container & { eventMode?: string; cursor?: string }).eventMode = 'static'
    ;(container as Container & { eventMode?: string; cursor?: string }).cursor = 'pointer'
    container.label = node.id

    layer.addChild(container)
  }
}
