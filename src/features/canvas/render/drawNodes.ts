import { Container, Graphics, Text } from 'pixi.js'
import type { GraphNode } from '../canvasTypes'

export function drawNodes(layer: Container, nodes: GraphNode[], selectedNodeIds: Set<string>): void {
  layer.removeChildren()

  for (const node of nodes) {
    const container = new Container()
    container.x = node.x
    container.y = node.y

    const selected = selectedNodeIds.has(node.id)

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
    } else if (node.type === 'stage') {
      shape.roundRect(0, 0, node.width, node.height, 22)
      shape.fill(0xf8fafc)
      shape.stroke({ color: selected ? 0x2563eb : 0x94a3b8, width: selected ? 2.5 : 1.6 })
    } else if (node.type === 'bottleneck') {
      shape.roundRect(0, 0, node.width, node.height, 18)
      shape.fill(0xfff7ed)
      shape.stroke({ color: selected ? 0x2563eb : 0xea580c, width: selected ? 2.5 : 1.6 })
    } else {
      shape.roundRect(0, 0, node.width, node.height, 12)
      shape.fill(0xffffff)
      shape.stroke({ color: selected ? 0x0071e3 : 0xe5e5e7, width: selected ? 2 : 1.5 })
    }

    const title = new Text({
      text: node.title,
      style: {
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", "Segoe UI", sans-serif',
        fontSize: node.type === 'start' || node.type === 'end' ? 12 : 15,
        fontWeight: '600',
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

    if (node.owner && (node.type === 'stage' || node.type === 'decision')) {
      const owner = new Text({
        text: `Owner: ${node.owner}`,
        style: {
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", "Segoe UI", sans-serif',
          fontSize: 11,
          fill: 0x64748b,
        },
      })
      owner.x = 14
      owner.y = 38
      container.addChild(owner)
    }

    if (node.reviewStatus && node.type === 'bottleneck') {
      const status = new Text({
        text: node.reviewStatus,
        style: {
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", "Segoe UI", sans-serif',
          fontSize: 11,
          fontWeight: '600',
          fill: 0xc2410c,
        },
      })
      status.x = 14
      status.y = 38
      container.addChild(status)
    }

    // Draw connection ports
    drawPorts(container, node)

    ;(container as Container & { eventMode?: string; cursor?: string }).eventMode = 'static'
    ;(container as Container & { eventMode?: string; cursor?: string }).cursor = 'pointer'
    container.label = node.id

    layer.addChild(container)
  }
}

function drawPorts(container: Container, node: GraphNode): void {
  const portRadius = 6
  const portColor = 0xc4c4c6
  const portHoverColor = 0x0071e3

  const ports = node.ports

  for (const port of ports) {
    const { x, y } = getPortPosition(node, port.id)
    const portCircle = new Graphics()

    // Draw visible port
    portCircle.circle(x - node.x, y - node.y, portRadius)
    portCircle.fill(0xffffff)
    portCircle.stroke({ color: portColor, width: 2 })

    // Add larger hit area
    const hitArea = new Graphics()
    hitArea.circle(x - node.x, y - node.y, portRadius + 8)
    hitArea.fill({ color: 0x000000, alpha: 0.001 })
    hitArea.label = `port:${port.id}`
    ;(hitArea as Graphics & { eventMode?: string; cursor?: string }).eventMode = 'static'
    ;(hitArea as Graphics & { eventMode?: string; cursor?: string }).cursor = 'crosshair'

    hitArea.on('pointerover', () => {
      portCircle.clear()
      portCircle.circle(x - node.x, y - node.y, portRadius + 2)
      portCircle.fill(0xffffff)
      portCircle.stroke({ color: portHoverColor, width: 2.5 })
    })

    hitArea.on('pointerout', () => {
      portCircle.clear()
      portCircle.circle(x - node.x, y - node.y, portRadius)
      portCircle.fill(0xffffff)
      portCircle.stroke({ color: portColor, width: 2 })
    })

    container.addChild(portCircle)
    container.addChild(hitArea)
  }
}

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
