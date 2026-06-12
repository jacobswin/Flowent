import { Container, Graphics, Text } from 'pixi.js'
import type { GraphNode } from '../canvasTypes'
import { describeReviewStatus } from '../reviewStatus'
import {
  formatDecisionOutcomeSummary,
  formatStageConditionSummary,
  truncateSummaryLine,
} from './drawNodeSummaries'

export interface DrawNodesOptions {
  dimmedNodeIds?: Set<string>
}

const NODE_HALO_STROKE = 0x93c5fd
const NODE_HALO_ALPHA = 0.35
const NODE_HALO_PADDING = 6

export function drawNodes(
  layer: Container,
  nodes: GraphNode[],
  selectedNodeIds: Set<string>,
  options: DrawNodesOptions = {},
): void {
  layer.removeChildren()

  for (const node of nodes) {
    const container = new Container()
    container.x = node.x
    container.y = node.y
    const dimmed = options.dimmedNodeIds?.has(node.id) ?? false
    container.alpha = dimmed ? 0.28 : 1

    const selected = selectedNodeIds.has(node.id)

    const halo = new Graphics()
    const shape = new Graphics()

    if (selected) {
      if (node.type === 'start' || node.type === 'end') {
        halo.roundRect(-NODE_HALO_PADDING, -NODE_HALO_PADDING, node.width + NODE_HALO_PADDING * 2, node.height + NODE_HALO_PADDING * 2, node.height / 2 + NODE_HALO_PADDING)
      } else if (node.type === 'decision') {
        halo.moveTo(node.width / 2, -NODE_HALO_PADDING)
        halo.lineTo(node.width + NODE_HALO_PADDING, node.height / 2)
        halo.lineTo(node.width / 2, node.height + NODE_HALO_PADDING)
        halo.lineTo(-NODE_HALO_PADDING, node.height / 2)
        halo.closePath()
      } else {
        const radius = node.type === 'stage' ? 24 : node.type === 'bottleneck' ? 20 : 14
        halo.roundRect(-NODE_HALO_PADDING, -NODE_HALO_PADDING, node.width + NODE_HALO_PADDING * 2, node.height + NODE_HALO_PADDING * 2, radius)
      }
      halo.stroke({ color: NODE_HALO_STROKE, width: 4, alpha: NODE_HALO_ALPHA })
    }

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
      shape.stroke({ color: selected ? 0x0f4aa6 : 0xc4c4c6, width: selected ? 2.4 : 1.5 })
    } else if (node.type === 'stage') {
      shape.roundRect(0, 0, node.width, node.height, 22)
      shape.fill(0xf8fafc)
      shape.stroke({ color: selected ? 0x1d4ed8 : 0x94a3b8, width: selected ? 2.6 : 1.6 })
    } else if (node.type === 'bottleneck') {
      shape.roundRect(0, 0, node.width, node.height, 18)
      shape.fill(0xfff7ed)
      shape.stroke({ color: selected ? 0x9a3412 : 0xea580c, width: selected ? 2.6 : 1.6 })
    } else {
      shape.roundRect(0, 0, node.width, node.height, 12)
      shape.fill(0xffffff)
      shape.stroke({ color: selected ? 0x1d4ed8 : 0xe5e5e7, width: selected ? 2.2 : 1.5 })
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

    container.addChild(halo)
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
      drawChip(container, `Owner · ${node.owner}`, 14, 38, {
        bg: 0xe0ecff,
        stroke: 0x93c5fd,
        text: 0x1d4ed8,
      })
    }

    if (node.type === 'decision' && node.decisionOutcomes && node.decisionOutcomes.length > 0) {
      const outcomes = new Text({
        text: truncateSummaryLine(formatDecisionOutcomeSummary(node.decisionOutcomes), 28),
        style: {
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", "Segoe UI", sans-serif',
          fontSize: 10,
          fontWeight: '500',
          fill: 0x475569,
        },
      })
      outcomes.x = 14
      outcomes.y = node.owner ? 60 : 38
      container.addChild(outcomes)
    }

    if (node.type === 'stage') {
      if (node.goal) {
        const goal = new Text({
          text: truncateSummaryLine(node.goal, 28),
          style: {
            fontFamily:
              '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", "Segoe UI", sans-serif',
            fontSize: 10,
            fontWeight: '500',
            fill: 0x475569,
          },
        })
        goal.x = 14
        goal.y = node.owner ? 60 : 38
        container.addChild(goal)
      }

      const conditions = formatStageConditionSummary(node.entryCondition ?? '', node.exitCondition ?? '')
      if (conditions) {
        const conditionsText = new Text({
          text: truncateSummaryLine(conditions, 32),
          style: {
            fontFamily:
              '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", "Segoe UI", sans-serif',
            fontSize: 9,
            fontWeight: '500',
            fill: 0x64748b,
          },
        })
        conditionsText.x = 14
        conditionsText.y = node.goal ? (node.owner ? 76 : 54) : (node.owner ? 60 : 38)
        container.addChild(conditionsText)
      }
    }

    if (node.reviewStatus && node.type === 'bottleneck') {
      drawChip(container, describeReviewStatus(node.reviewStatus), 14, 38, {
        bg: 0xffedd5,
        stroke: 0xfdba74,
        text: 0x9a3412,
      })
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

    // Draw the port. The circle is shown at low alpha by default
    // so the canvas doesn't feel busy, and the ProcessCanvas
    // per-frame pass fades it in when its parent node is
    // hovered. We tag it with a label so the redraw pass can
    // find it without iterating every child.
    portCircle.label = `port-circle:${port.id}`
    portCircle.alpha = 0.18
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

function drawChip(
  container: Container,
  text: string,
  x: number,
  y: number,
  palette: { bg: number; stroke: number; text: number },
): void {
  const label = new Text({
    text,
    style: {
      fontFamily:
        '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", "Segoe UI", sans-serif',
      fontSize: 10,
      fontWeight: '600',
      fill: palette.text,
    },
  })
  const chipWidth = label.width + 16
  const chipHeight = 18
  const shape = new Graphics()
  shape.roundRect(x, y, chipWidth, chipHeight, 9)
  shape.fill(palette.bg)
  shape.stroke({ color: palette.stroke, width: 1 })
  label.x = x + 8
  label.y = y + 2
  container.addChild(shape)
  container.addChild(label)
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
