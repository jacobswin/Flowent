import { describe, expect, it } from 'vitest'
import { createEmptyDocument, addEdge, addNode } from '../engine/graphDocument'
import { createGraphNode, createHandoffEdge } from '../processElements'
import * as processMapExporter from './processMapExporter'
import { exportProcessMap, exportProcessMapAsSvg } from './processMapExporter'
import { createExportFilename } from './browserProcessMapExporter'

describe('exportProcessMap', () => {
  it('returns a no-node map with default bounds for an empty doc', () => {
    const doc = createEmptyDocument('doc')
    const map = exportProcessMap(doc)
    expect(map.nodes).toEqual([])
    expect(map.edges).toEqual([])
    expect(map.width).toBe(200)
    expect(map.height).toBe(80)
    expect(map.exportedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('flattens node semantic fields into the exported payload', () => {
    let doc = createEmptyDocument('doc')
    doc = addNode(doc, {
      ...createGraphNode('activity', 'a', { x: 100, y: 200 }),
      roleTags: ['PM', 'Designer'],
      expectations: 'Ready when scope is clear',
    })
    doc = addNode(doc, {
      ...createGraphNode('decision', 'b', { x: 400, y: 200 }),
      criteria: 'Evidence quality',
      owner: 'Tech Lead',
    })
    doc = addEdge(doc, {
      ...createHandoffEdge('edge-1', 'a', 'out', 'b', 'in'),
      fromRole: 'PM',
      toRole: 'Engineer',
      artifact: 'Ready brief',
      expectation: 'Context and owner are present',
    })

    const map = exportProcessMap(doc)
    expect(map.nodes).toHaveLength(2)
    expect(map.nodes[0]?.fields).toMatchObject({
      expectations: 'Ready when scope is clear',
    })
    expect(map.nodes[0]?.roleTags).toEqual(['PM', 'Designer'])
    expect(map.nodes[1]?.fields.owner).toBe('Tech Lead')
    expect(map.edges[0]?.fields).toMatchObject({
      fromRole: 'PM',
      toRole: 'Engineer',
      artifact: 'Ready brief',
      expectation: 'Context and owner are present',
    })
  })
})

describe('exportProcessMapAsSvg', () => {
  it('produces a self-contained SVG with header and edges', () => {
    let doc = createEmptyDocument('doc')
    doc = addNode(doc, createGraphNode('activity', 'a', { x: 100, y: 200 }))
    doc = addNode(doc, createGraphNode('decision', 'b', { x: 400, y: 200 }))
    doc = addEdge(doc, createHandoffEdge('edge-1', 'a', 'out', 'b', 'in'))

    const svg = exportProcessMapAsSvg(doc)
    expect(svg).toMatch(/^<\?xml version="1\.0" encoding="UTF-8"\?>/)
    expect(svg).toMatch(/<svg [^>]+>/)
    expect(svg).toMatch(/<rect [^>]+fill="#ffffff"/)
    expect(svg).toMatch(/<path d="M /)
    expect(svg).toMatch(/<polygon /)
    expect(svg).toMatch(/<\/svg>$/)
  })

  it('escapes special characters in titles and labels', () => {
    let doc = createEmptyDocument('doc')
    doc = addNode(doc, {
      ...createGraphNode('activity', 'a', { x: 0, y: 0 }),
      title: 'A & B <x>',
    })
    const svg = exportProcessMapAsSvg(doc)
    expect(svg).toContain('A &amp; B &lt;x&gt;')
  })

  it('exports the swimlane surface and derived role and work product cards', () => {
    let doc = createEmptyDocument('doc')
    doc = addNode(doc, {
      ...createGraphNode('activity', 'a', { x: 620, y: 222 }),
      roleTags: ['Product manager'],
    })
    doc = {
      ...doc,
      processAssets: {
        ...doc.processAssets,
        workProducts: {
          brief: {
            id: 'brief',
            title: 'Product brief',
            state: 'Draft',
            description: '',
            producerNodeIds: [],
            consumerNodeIds: [],
            handoffEdgeIds: [],
            guidanceIds: [],
            activityLinks: [{ id: 'brief-input', nodeId: 'a', relation: 'input', maturity: 'Draft' }],
          },
        },
      },
      meta: { ...doc.meta, layoutProfile: 'swimlane' },
    }

    const svg = exportProcessMapAsSvg(doc)

    expect(svg).toContain('>Role<')
    expect(svg).toContain('>Input<')
    expect(svg).toContain('>Activity<')
    expect(svg).toContain('>Output<')
    expect(svg).toContain('Product manager')
    expect(svg).toContain('Product brief')
  })
})

describe('export formats', () => {
  it('uses the map title in an export filename without dropping non-Latin names', () => {
    expect(createExportFilename('DVP 偏差流程', 'svg', new Date('2026-07-14T10:00:00Z')))
      .toBe('flowent-dvp-偏差流程-20260714T100000.svg')
  })

  it('describes the file extension and MIME type for each supported format', () => {
    const getExportFileSpec = (processMapExporter as typeof processMapExporter & {
      getExportFileSpec?: (format: 'svg' | 'pdf' | 'png' | 'jpg' | 'json') => { extension: string; mimeType: string }
    }).getExportFileSpec

    expect(typeof getExportFileSpec).toBe('function')
    if (!getExportFileSpec) return

    expect(getExportFileSpec('svg')).toEqual({ extension: 'svg', mimeType: 'image/svg+xml' })
    expect(getExportFileSpec('pdf')).toEqual({ extension: 'pdf', mimeType: 'application/pdf' })
    expect(getExportFileSpec('png')).toEqual({ extension: 'png', mimeType: 'image/png' })
    expect(getExportFileSpec('jpg')).toEqual({ extension: 'jpg', mimeType: 'image/jpeg' })
    expect(getExportFileSpec('json')).toEqual({ extension: 'flowent.json', mimeType: 'application/json' })
  })

  it('captures a versioned complete Flowent map backup', () => {
    const createFlowentMapBackup = (processMapExporter as typeof processMapExporter & {
      createFlowentMapBackup?: (doc: ReturnType<typeof createEmptyDocument>) => {
        format: string
        version: number
        document: { nodes: Record<string, unknown>; processAssets: unknown; viewport: unknown }
      }
    }).createFlowentMapBackup

    expect(typeof createFlowentMapBackup).toBe('function')
    if (!createFlowentMapBackup) return

    let doc = createEmptyDocument('backup')
    doc = addNode(doc, createGraphNode('activity', 'activity-1', { x: 180, y: 120 }))
    const backup = createFlowentMapBackup(doc)

    expect(backup.format).toBe('flowent-map')
    expect(backup.version).toBe(1)
    expect(backup.document.nodes['activity-1']).toBeDefined()
    expect(backup.document.processAssets).toEqual(doc.processAssets)
    expect(backup.document.viewport).toEqual(doc.viewport)
  })
})
