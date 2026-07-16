import { Container, Graphics, Text } from 'pixi.js'
import type { GraphDocument } from '../canvasTypes'
import { deriveSwimlaneRows, SWIMLANE_LANES, type SwimlaneCard } from '../layout/swimlaneLayout'
import { truncateSummaryLine } from './drawNodeSummaries'

const HEADER_Y = 100
const HEADER_HEIGHT = 42
const ROW_HEIGHT = 188

const LANE_COLORS = {
  role: 0xe6edf5,
  input: 0xe5f0ff,
  activity: 0xf5f7fa,
  output: 0xe6f5ec,
} as const

export interface DrawSwimlanesOptions {
  onSelectWorkProduct?: (workProductId: string) => void
}

export function drawSwimlanes(layer: Container, doc: GraphDocument, options: DrawSwimlanesOptions = {}): void {
  layer.removeChildren()
  if (doc.meta.layoutProfile !== 'swimlane') return

  const rows = deriveSwimlaneRows(doc)
  if (rows.length === 0) return

  const end = doc.nodes.get('end')
  const firstX = SWIMLANE_LANES.role.x
  const lastX = SWIMLANE_LANES.output.x + SWIMLANE_LANES.output.width
  const lastY = Math.max(
    ...rows.map((row) => row.y + ROW_HEIGHT),
    end ? end.y + end.height + 18 : HEADER_Y + ROW_HEIGHT,
  )
  const totalHeight = Math.max(ROW_HEIGHT * rows.length + HEADER_HEIGHT, lastY - HEADER_Y)

  const surface = new Graphics()
  surface.roundRect(firstX, HEADER_Y, lastX - firstX, totalHeight, 16)
  surface.fill(0xffffff)
  surface.stroke({ color: 0xcbd5e1, width: 1.2 })
  layer.addChild(surface)

  for (const [kind, lane] of Object.entries(SWIMLANE_LANES) as Array<[
    keyof typeof SWIMLANE_LANES,
    typeof SWIMLANE_LANES[keyof typeof SWIMLANE_LANES],
  ]>) {
    const band = new Graphics()
    band.rect(lane.x, HEADER_Y + 1, lane.width, totalHeight - 2)
    band.fill({ color: LANE_COLORS[kind], alpha: 1 })
    layer.addChild(band)

    if (lane.x !== firstX) {
      const divider = new Graphics()
      divider.stroke({ color: 0xcbd5e1, width: 1, alpha: 0.95 })
      divider.moveTo(lane.x, HEADER_Y)
      divider.lineTo(lane.x, HEADER_Y + totalHeight)
      layer.addChild(divider)
    }

    const header = new Text({
      text: lane.title,
      style: {
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", "Segoe UI", sans-serif',
        fontSize: 12,
        fontWeight: '700',
        fill: 0x64748b,
        letterSpacing: 0,
      },
    })
    header.x = lane.x + 16
    header.y = HEADER_Y + 13
    layer.addChild(header)
  }

  const headerRule = new Graphics()
  headerRule.stroke({ color: 0xcbd5e1, width: 1, alpha: 0.95 })
  headerRule.moveTo(firstX, HEADER_Y + HEADER_HEIGHT)
  headerRule.lineTo(lastX, HEADER_Y + HEADER_HEIGHT)
  layer.addChild(headerRule)

  for (const row of rows) {
    const separator = new Graphics()
    separator.stroke({ color: 0xe5e7eb, width: 1, alpha: 0.72 })
    separator.moveTo(firstX, Math.max(HEADER_Y + HEADER_HEIGHT, row.y - 34))
    separator.lineTo(lastX, Math.max(HEADER_Y + HEADER_HEIGHT, row.y - 34))
    layer.addChild(separator)

    for (const card of [...row.roleCards, ...row.inputCards, ...row.outputCards]) {
      drawCard(layer, card, card.workProductId ? 'asset' : 'role', options)
    }
  }

}

function drawCard(layer: Container, card: SwimlaneCard, kind: 'role' | 'asset', options: DrawSwimlanesOptions): void {
  const group = new Container()
  group.label = card.workProductId ? `swimlane-asset:${card.workProductId}` : `swimlane-role:${card.id}`
  group.x = card.x
  group.y = card.y
  if (card.workProductId && options.onSelectWorkProduct) {
    ;(group as Container & { eventMode?: string; cursor?: string }).eventMode = 'static'
    ;(group as Container & { eventMode?: string; cursor?: string }).cursor = 'pointer'
    group.on('pointertap', () => options.onSelectWorkProduct?.(card.workProductId!))
  }

  const shape = new Graphics()
  shape.roundRect(0, 0, card.width, card.height, 12)
  shape.fill(0xffffff)
  shape.stroke({ color: kind === 'role' ? 0x94a3b8 : 0x93c5fd, width: 1.2 })
  group.addChild(shape)

  if (kind === 'role') {
    const icon = new Graphics()
    icon.circle(17, 16, 4)
    icon.fill(0x64748b)
    icon.roundRect(12, 24, 10, 7, 4)
    icon.fill(0x64748b)
    group.addChild(icon)
  }

  const label = new Text({
    text: truncateSummaryLine(card.label, kind === 'role' ? 18 : 26),
    style: {
      fontFamily:
        '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", "Segoe UI", sans-serif',
      fontSize: 11,
      fontWeight: '600',
      fill: kind === 'role' ? 0x1f2937 : 0x334155,
      wordWrap: false,
    },
  })
  label.x = kind === 'role' ? 34 : 12
  label.y = 15
  group.addChild(label)

  layer.addChild(group)
}
