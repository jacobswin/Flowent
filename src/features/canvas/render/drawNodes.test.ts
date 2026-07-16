import { describe, expect, it, vi } from 'vitest'

vi.mock('pixi.js', async () => {
  const actual = await vi.importActual<typeof import('pixi.js')>('pixi.js')

  class StubText extends actual.Container {
    text: string
    style: { fontSize?: number; lineHeight?: number }

    constructor(options: { text: string; style?: { fontSize?: number; lineHeight?: number } }) {
      super()
      this.text = options.text
      this.style = options.style ?? {}
    }

    override get width(): number {
      const fontSize = this.style.fontSize ?? 12
      const lines = this.text.split('\n')
      return Math.max(...lines.map((line) => line.length), 0) * fontSize * 0.56
    }

    override set width(_value: number) {
      // no-op
    }

    override get height(): number {
      const lineHeight = this.style.lineHeight ?? this.style.fontSize ?? 12
      return this.text.split('\n').length * lineHeight
    }

    override set height(_value: number) {
      // no-op
    }
  }

  return { ...actual, Text: StubText as unknown as typeof actual.Text }
})

import { Container } from 'pixi.js'
import type { GraphNode } from '../canvasTypes'
import { drawNodes } from './drawNodes'

function makeActivity(overrides: Partial<GraphNode> = {}): GraphNode {
  return {
    id: 'activity-1',
    type: 'activity',
    x: 0,
    y: 0,
    width: 180,
    height: 96,
    title: 'Review product requirements',
    roleTags: [],
    ports: [],
    ...overrides,
  }
}

function textChildren(container: Container): Array<{ text: string; x: number; y: number; width: number; height: number }> {
  return container.children.filter((child): child is Container & { text: string } =>
    typeof (child as { text?: unknown }).text === 'string',
  )
}

describe('drawNodes title layout', () => {
  it('keeps the node title vertically centered when activity chips are present', () => {
    const layer = new Container()
    const node = makeActivity({
      assetSummary: {
        responsibleRoles: [],
        accountableRoles: [],
        inputCount: 1,
        outputCount: 1,
        guidanceCount: 0,
        milestoneCount: 0,
      },
    })

    drawNodes(layer, [node], new Set())

    const nodeContainer = layer.children[0] as Container
    const [title] = textChildren(nodeContainer)
    expect(title.text.replace(/\n/g, ' ')).toBe(node.title)
    expect(title.y).toBeCloseTo((node.height - title.height) / 2)
  })

  it('truncates long node titles with three dots before rendering them', () => {
    const layer = new Container()
    const node = makeActivity({
      width: 140,
      height: 64,
      title: 'Coordinate enterprise-scale compliance readiness review with security and product leadership',
    })

    drawNodes(layer, [node], new Set())

    const nodeContainer = layer.children[0] as Container
    const [title] = textChildren(nodeContainer)
    expect(title.text.length).toBeLessThan(node.title.length)
    expect(title.text).toContain('...')
  })

  it('draws a Responsible person badge above activity nodes', () => {
    const layer = new Container()
    const node = makeActivity({
      responsibilities: [{ id: 'r1', roleName: 'DRE', kind: 'responsible' }],
      roleTags: ['DRE'],
    })

    drawNodes(layer, [node], new Set())

    const nodeContainer = layer.children[0] as Container
    const badge = nodeContainer.children.find((child) => (child as { label?: string }).label === 'responsible-role-badge') as Container | undefined
    expect(badge).toBeDefined()
    expect(badge?.y).toBeLessThan(0)
    expect(textChildren(badge!).map((child) => child.text)).toContain('DRE')
  })

  it('does not draw a Responsible person badge when an activity has no Responsible role', () => {
    const layer = new Container()

    drawNodes(layer, [makeActivity({ responsibilities: [], roleTags: [] })], new Set())

    const nodeContainer = layer.children[0] as Container
    expect(nodeContainer.children.some((child) => (child as { label?: string }).label === 'responsible-role-badge')).toBe(false)
  })

  it('draws Flow inputs and outputs as separate bottom-corner summaries', () => {
    const layer = new Container()
    const node = makeActivity({
      assetSummary: {
        responsibleRoles: [],
        accountableRoles: [],
        inputCount: 2,
        outputCount: 3,
        guidanceCount: 0,
        milestoneCount: 0,
      },
    })

    drawNodes(layer, [node], new Set(), { layoutProfile: 'left-to-right' })

    const nodeContainer = layer.children[0] as Container
    const input = textChildren(nodeContainer).find((child) => child.text === 'In 2')
    const output = textChildren(nodeContainer).find((child) => child.text === 'Out 3')
    expect(input).toBeDefined()
    expect(output).toBeDefined()
    expect(input!.x).toBeLessThan(output!.x)
    expect(input!.y).toBeGreaterThanOrEqual(node.height - 24)
    expect(output!.y).toBeGreaterThanOrEqual(node.height - 24)
  })

  it('hides input and output summaries inside Swimlane activities while retaining guidance', () => {
    const layer = new Container()
    const node = makeActivity({
      assetSummary: {
        responsibleRoles: [],
        accountableRoles: [],
        inputCount: 1,
        outputCount: 1,
        guidanceCount: 2,
        milestoneCount: 0,
      },
    })

    drawNodes(layer, [node], new Set(), { layoutProfile: 'swimlane' })

    const labels = textChildren(layer.children[0] as Container).map((child) => child.text)
    expect(labels).toContain('How 2')
    expect(labels).not.toContain('In 1')
    expect(labels).not.toContain('Out 1')
    expect(labels.some((label) => label.includes('In 1 · Out 1'))).toBe(false)
  })
})
