import { Container, Graphics, Text } from 'pixi.js'
import type { GraphLayoutProfile, GraphNode } from '../canvasTypes'
import { describeReviewStatus } from '../reviewStatus'
import {
  formatDecisionOutcomeSummary,
  formatStageConditionSummary,
  truncateSummaryLine,
} from './drawNodeSummaries'

export interface DrawNodesOptions {
  dimmedNodeIds?: Set<string>
  layoutProfile?: GraphLayoutProfile
}

const NODE_HALO_STROKE = 0x93c5fd
const NODE_HALO_ALPHA = 0.35
const NODE_HALO_PADDING = 6
const INPUT_CHIP_PALETTE = { bg: 0xeff6ff, stroke: 0x93c5fd, text: 0x1d4ed8 }
const OUTPUT_CHIP_PALETTE = { bg: 0xfff7ed, stroke: 0xfdba74, text: 0xc2410c }
const GUIDANCE_CHIP_PALETTE = { bg: 0xf0fdf4, stroke: 0x86efac, text: 0x166534 }

export function drawNodes(
  layer: Container,
  nodes: GraphNode[],
  selectedNodeIds: Set<string>,
  options: DrawNodesOptions = {},
): void {
  layer.removeChildren()

  // Stage rectangles deliberately sit below Activities and Decisions so they
  // read as containers and never intercept their members' interactions.
  const orderedNodes = [...nodes.filter((node) => node.type === 'stage'), ...nodes.filter((node) => node.type !== 'stage')]
  for (const node of orderedNodes) {
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
      const subtleTerminal = options.layoutProfile === 'swimlane'
      const fill = subtleTerminal
        ? node.type === 'start' ? 0xeff6ff : 0xf8fafc
        : node.type === 'start' ? 0x1d1d1f : 0xffffff
      const stroke = subtleTerminal
        ? node.type === 'start' ? 0x93c5fd : 0x94a3b8
        : 0x1d1d1f
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
      shape.fill({ color: 0xf8fafc, alpha: 0.72 })
      shape.stroke({ color: selected ? 0x1d4ed8 : 0x94a3b8, width: selected ? 2.6 : 1.35 })
    } else if (node.type === 'bottleneck') {
      shape.roundRect(0, 0, node.width, node.height, 18)
      shape.fill(0xfff7ed)
      shape.stroke({ color: selected ? 0x9a3412 : 0xea580c, width: selected ? 2.6 : 1.6 })
    } else {
      shape.roundRect(0, 0, node.width, node.height, 12)
      shape.fill(0xffffff)
      shape.stroke({ color: selected ? 0x1d4ed8 : 0xe5e5e7, width: selected ? 2.2 : 1.5 })
    }

    const titleWrapWidth = getTitleWrapWidth(node)
    const titleFontSize = node.type === 'start' || node.type === 'end' ? 12 : node.type === 'decision' ? 14 : 15
    const titleLineHeight = node.type === 'decision' ? 16 : 18
    const titleDisplayText = getDisplayNodeTitle(node.title, {
      fontSize: titleFontSize,
      maxLines: node.type === 'start' || node.type === 'end' ? 1 : 2,
      wrapWidth: titleWrapWidth,
    })
    const title = new Text({
      text: titleDisplayText,
      style: {
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", "Segoe UI", sans-serif',
        fontSize: titleFontSize,
        fontWeight: '600',
        fill: node.type === 'start' && options.layoutProfile !== 'swimlane' ? 0xf5f5f7 : 0x334155,
        align: 'center',
        breakWords: true,
        lineHeight: titleLineHeight,
        wordWrap: false,
        wordWrapWidth: titleWrapWidth,
      },
    })

    title.x = node.type === 'stage' ? 16 : centerTextX(title.width, node.width, node.type === 'decision' ? node.width * 0.22 : 12)
    title.y = node.type === 'stage' ? 13 : centerTextY(title.height, node.height)

    container.addChild(halo)
    container.addChild(shape)
    if (node.type === 'stage') {
      const header = new Graphics()
      header.roundRect(1, 1, Math.max(0, node.width - 2), 42, 21)
      header.fill({ color: 0xeaf2ff, alpha: 0.78 })
      container.addChild(header)
    }
    container.addChild(title)

    if (node.type === 'activity' && options.layoutProfile !== 'swimlane') {
      const responsibleRole = getResponsibleRoleName(node)
      if (responsibleRole) drawResponsibleRoleBadge(container, node, responsibleRole)
    }

    if (node.summary && node.type === 'activity') {
      const summary = new Text({
        text: node.summary,
        style: {
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", "Segoe UI", sans-serif',
          fontSize: 12,
          fill: 0x86868b,
          align: 'center',
          breakWords: true,
          wordWrap: true,
          wordWrapWidth: Math.max(72, node.width - 34),
        },
      })
      summary.x = centerTextX(summary.width, node.width, 14)
      summary.y = Math.max(40, title.y + title.height + 6)
      container.addChild(summary)
    }

    if (node.type === 'activity' && node.assetSummary) {
      drawActivityAssetSummary(container, node, options.layoutProfile)
    }

    if (node.owner && node.type === 'decision') {
      drawChip(container, `Owner · ${node.owner}`, 0, node.height / 2 + 4, {
        bg: 0xe0ecff,
        stroke: 0x93c5fd,
        text: 0x1d4ed8,
      }, {
        centerX: node.width / 2,
        maxWidth: node.width * 0.54,
      })
    } else if (node.owner && node.type === 'stage') {
      drawChip(container, `Owner · ${node.owner}`, 14, 52, {
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
          align: 'center',
          breakWords: true,
          wordWrap: true,
          wordWrapWidth: Math.max(54, node.width * 0.52),
        },
      })
      outcomes.x = centerTextX(outcomes.width, node.width, node.width * 0.22)
      outcomes.y = node.owner ? node.height / 2 + 28 : node.height / 2 + 8
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
        goal.y = node.owner ? 84 : 56
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
        conditionsText.y = node.goal ? (node.owner ? 100 : 72) : (node.owner ? 84 : 56)
        container.addChild(conditionsText)
      }

      if (node.assetSummary?.milestoneCount) {
        drawChip(container, `${node.assetSummary.milestoneCount} milestones`, 14, node.height - 28, {
          bg: 0xfef3c7,
          stroke: 0xfcd34d,
          text: 0x92400e,
        })
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

function getResponsibleRoleName(node: GraphNode): string {
  const explicit = node.responsibilities
    ?.find((responsibility) => responsibility.kind === 'responsible')
    ?.roleName
    ?.trim()
  return explicit || node.assetSummary?.responsibleRoles[0] || node.roleTags[0] || ''
}

function drawResponsibleRoleBadge(container: Container, node: GraphNode, roleName: string): void {
  const badge = new Container()
  badge.label = 'responsible-role-badge'
  const displayRole = truncateSummaryLine(roleName, 22)
  const label = new Text({
    text: displayRole,
    style: {
      fontFamily:
        '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", "Segoe UI", sans-serif',
      fontSize: 10,
      fontWeight: '600',
      fill: 0x1f2937,
      align: 'left',
    },
  })

  const iconSize = 14
  const paddingX = 9
  const gap = 5
  const badgeWidth = Math.min(node.width - 18, Math.max(44, paddingX * 2 + iconSize + gap + label.width))
  const badgeHeight = 24
  const shape = new Graphics()
  shape.roundRect(0, 0, badgeWidth, badgeHeight, 12)
  shape.fill({ color: 0xffffff, alpha: 0.94 })
  shape.stroke({ color: 0xd1d5db, width: 1 })

  const icon = new Graphics()
  icon.circle(paddingX + 5, 8, 3.2)
  icon.fill(0x64748b)
  icon.roundRect(paddingX + 1.5, 12, 7, 5.5, 3)
  icon.fill(0x64748b)

  label.x = paddingX + iconSize + gap
  label.y = 5

  badge.x = centerTextX(badgeWidth, node.width, 10)
  badge.y = -badgeHeight - 10
  badge.addChild(shape)
  badge.addChild(icon)
  badge.addChild(label)
  container.addChild(badge)
}

function drawActivityAssetSummary(
  container: Container,
  node: GraphNode,
  layoutProfile: GraphLayoutProfile | undefined,
): void {
  const { inputCount, outputCount, guidanceCount } = node.assetSummary ?? {}
  const chipY = Math.max(74, node.height - 26)
  const inputText = inputCount ? `In ${inputCount}` : ''
  const outputText = outputCount ? `Out ${outputCount}` : ''
  const guidanceText = guidanceCount ? `How ${guidanceCount}` : ''

  if (layoutProfile === 'swimlane') {
    if (guidanceText) {
      drawChip(container, guidanceText, 14, chipY, GUIDANCE_CHIP_PALETTE)
    }
    return
  }

  const inputWidth = inputText ? getChipWidth(inputText) : 0
  const outputWidth = outputText ? getChipWidth(outputText) : 0

  if (inputText) {
    drawChip(container, inputText, 14, chipY, INPUT_CHIP_PALETTE)
  }

  if (outputText) {
    drawChip(container, outputText, node.width - 14 - outputWidth, chipY, OUTPUT_CHIP_PALETTE)
  }

  if (!guidanceText) return

  const leftBoundary = inputText ? 14 + inputWidth + 6 : 14
  const rightBoundary = outputText ? node.width - 14 - outputWidth - 6 : node.width - 14
  const guidanceWidth = getChipWidth(guidanceText)
  if (guidanceWidth > rightBoundary - leftBoundary) return

  const guidanceX = Math.max(
    leftBoundary,
    Math.min(node.width / 2 - guidanceWidth / 2, rightBoundary - guidanceWidth),
  )
  drawChip(container, guidanceText, guidanceX, chipY, GUIDANCE_CHIP_PALETTE)
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

function getTitleWrapWidth(node: GraphNode): number {
  if (node.type === 'decision') {
    return Math.max(54, node.width * 0.52)
  }

  if (node.type === 'start' || node.type === 'end') {
    return Math.max(52, node.width - 28)
  }

  return Math.max(72, node.width - 34)
}

export function getDisplayNodeTitle(
  title: string,
  options: { fontSize: number; maxLines: number; wrapWidth: number },
): string {
  const text = title.replace(/\s+/g, ' ').trim()
  if (!text) return ''

  const maxUnitsPerLine = Math.max(4, Math.floor(options.wrapWidth / (options.fontSize * 0.58)))
  const lines: string[] = []
  const hasWordBreaks = text.includes(' ')
  const separator = hasWordBreaks ? ' ' : ''
  const tokens = hasWordBreaks ? text.split(' ') : Array.from(text)
  let index = 0

  while (index < tokens.length && lines.length < options.maxLines) {
    let line = ''

    while (index < tokens.length) {
      const token = tokens[index]
      const candidate = line ? `${line}${separator}${token}` : token
      if (visualUnits(candidate) <= maxUnitsPerLine) {
        line = candidate
        index += 1
        continue
      }

      if (!line) {
        const split = splitTokenToFit(token, maxUnitsPerLine)
        line = split.head
        if (split.tail) {
          tokens[index] = split.tail
        } else {
          index += 1
        }
      }
      break
    }

    if (!line) break
    lines.push(line)
  }

  if (index >= tokens.length) return lines.join('\n')

  return finishNodeTitleLines(lines, tokens.slice(index).join(separator), maxUnitsPerLine)
}

function finishNodeTitleLines(lines: string[], remainingText: string, maxUnitsPerLine: number): string {
  if (!remainingText.trim()) return lines.join('\n')
  const lastIndex = Math.max(0, lines.length - 1)
  lines[lastIndex] = truncateLineWithDots(lines[lastIndex], maxUnitsPerLine)
  return lines.join('\n')
}

function truncateLineWithDots(line: string, maxUnitsPerLine: number): string {
  const dots = '...'
  const maxTextUnits = Math.max(1, maxUnitsPerLine - visualUnits(dots))
  let output = ''
  for (const char of Array.from(line.trimEnd())) {
    if (visualUnits(output + char) > maxTextUnits) break
    output += char
  }
  return `${output.trimEnd()}${dots}`
}

function splitTokenToFit(token: string, maxUnitsPerLine: number): { head: string; tail: string } {
  let head = ''
  let tailStart = 0
  const chars = Array.from(token)
  for (let i = 0; i < chars.length; i += 1) {
    if (visualUnits(head + chars[i]) > maxUnitsPerLine) {
      tailStart = i
      break
    }
    head += chars[i]
    tailStart = i + 1
  }
  return { head, tail: chars.slice(tailStart).join('') }
}

function visualUnits(text: string): number {
  return Array.from(text).reduce((total, char) => {
    if (char === ' ') return total + 0.5
    return total + (char.charCodeAt(0) > 255 ? 1.7 : 1)
  }, 0)
}

function centerTextX(textWidth: number, nodeWidth: number, padding: number): number {
  const minX = padding
  const maxX = Math.max(minX, nodeWidth - textWidth - padding)
  return Math.min(Math.max(nodeWidth / 2 - textWidth / 2, minX), maxX)
}

function centerTextY(textHeight: number, nodeHeight: number): number {
  return Math.max(8, nodeHeight / 2 - textHeight / 2)
}

function drawChip(
  container: Container,
  text: string,
  x: number,
  y: number,
  palette: { bg: number; stroke: number; text: number },
  options: { centerX?: number; maxWidth?: number } = {},
): void {
  let displayText = text
  let label = createChipLabel(displayText, palette.text)
  const maxWidth = options.maxWidth
  if (maxWidth && label.width + 16 > maxWidth) {
    const estimatedChars = Math.max(8, Math.floor((maxWidth - 16) / 6))
    displayText = truncateSummaryLine(text, estimatedChars)
    label = createChipLabel(displayText, palette.text)
  }

  const chipWidth = Math.min(label.width + 16, maxWidth ?? label.width + 16)
  const chipHeight = 18
  const chipX = options.centerX === undefined ? x : options.centerX - chipWidth / 2
  const shape = new Graphics()
  shape.roundRect(chipX, y, chipWidth, chipHeight, 9)
  shape.fill(palette.bg)
  shape.stroke({ color: palette.stroke, width: 1 })
  label.x = chipX + 8
  label.y = y + 2
  container.addChild(shape)
  container.addChild(label)
}

function getChipWidth(text: string): number {
  return createChipLabel(text, 0x000000).width + 16
}

function createChipLabel(text: string, color: number): Text {
  return new Text({
    text,
    style: {
      fontFamily:
        '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", "Segoe UI", sans-serif',
      fontSize: 10,
      fontWeight: '600',
      fill: color,
    },
  })
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
