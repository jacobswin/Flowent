import { describe, expect, it, vi } from 'vitest'
import type { Graphics } from 'pixi.js'
import type { GraphDocument, GraphEdge, GraphNode } from './canvasTypes'
import { createEmptyDocument, addNode } from './engine/graphDocument'
import { createGraphNode } from './processElements'
import { registerCanvasNativeHandlers } from './registerCanvasNativeHandlers'
import { getPortPosition } from './render/drawEdges'
import { getEdgeLabelCenter } from './render/edgeGeometry'

function setElementRect(element: Element, rect: { left: number; top: number; width: number; height: number }) {
  Object.defineProperty(element, 'getBoundingClientRect', {
    configurable: true,
    value: () => ({
      x: rect.left,
      y: rect.top,
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
      right: rect.left + rect.width,
      bottom: rect.top + rect.height,
      toJSON: () => rect,
    }),
  })
}

function createMarqueeRectStub(): Graphics {
  const marqueeRect = {
    visible: false,
    clear: vi.fn(),
    rect: vi.fn().mockReturnThis(),
    fill: vi.fn().mockReturnThis(),
    stroke: vi.fn().mockReturnThis(),
  }

  return marqueeRect as unknown as Graphics
}

function createDocumentWithNodes(nodes: GraphNode[]): GraphDocument {
  return nodes.reduce((document, node) => addNode(document, node), createEmptyDocument('native-handler-test'))
}

function createHarness(args: {
  documentNodes: GraphNode[]
  graphNodes: GraphNode[]
  graphEdges?: GraphEdge[]
  connectorMode?: boolean
  rect?: { left: number; top: number; width: number; height: number }
}) {
  const host = document.createElement('div')
  const pixiCanvasEl = document.createElement('canvas')
  host.appendChild(pixiCanvasEl)

  const rect = args.rect ?? { left: 0, top: 0, width: 1200, height: 900 }
  setElementRect(host, rect)
  setElementRect(pixiCanvasEl, rect)

  const startConnection = vi.fn()
  const onConnect = vi.fn()
  const onNodeClick = vi.fn()
  const onEdgeClick = vi.fn()
  const openEditor = vi.fn()
  const openConnectionCreateMenu = vi.fn()
  const cancelConnection = vi.fn()
  const selectNodesInRect = vi.fn()
  const onPaneClick = vi.fn()
  const zoomAt = vi.fn()
  const panBy = vi.fn()
  const moveSelectedNodes = vi.fn()
  const graphNodesRef = { current: args.graphNodes }

  const canvas = {
    document: createDocumentWithNodes(args.documentNodes),
    viewport: { x: 0, y: 0, zoom: 1 },
    connectorMode: args.connectorMode ?? false,
    selectNodesInRect,
    onPaneClick,
    zoomAt,
    panBy,
    moveSelectedNodes,
    onNodeClick,
    onEdgeClick,
    openEditor,
    onConnect,
    startConnection,
    openConnectionCreateMenu,
    cancelConnection,
  }

  const registration = registerCanvasNativeHandlers({
    host,
    pixiCanvasEl,
    hitArea: { cursor: 'default' } as Graphics,
    marqueeRect: createMarqueeRectStub(),
    graphNodesRef,
    graphEdgesRef: { current: args.graphEdges ?? [] },
    getCanvas: () => canvas,
  })

  return {
    host,
    pixiCanvasEl,
    startConnection,
    onConnect,
    onNodeClick,
    openEditor,
    openConnectionCreateMenu,
    cancelConnection,
    onPaneClick,
    selectNodesInRect,
    zoomAt,
    panBy,
    graphNodesRef,
    destroy: registration.destroy,
  }
}

describe('registerCanvasNativeHandlers', () => {
  it('starts a connection from the derived graph-model port position', () => {
    const rawNode = createGraphNode('activity', 'activity-1', { x: 40, y: 40 })
    const projectedNode = {
      ...rawNode,
      x: 240,
      y: 180,
    }
    const port = getPortPosition(projectedNode, 'out')
    const harness = createHarness({
      documentNodes: [rawNode],
      graphNodes: [projectedNode],
    })

    try {
      harness.pixiCanvasEl.dispatchEvent(
        new MouseEvent('pointerdown', {
          bubbles: true,
          button: 0,
          clientX: port.x,
          clientY: port.y,
        }),
      )

      expect(harness.startConnection).toHaveBeenCalledWith('activity-1', 'out')
    } finally {
      harness.destroy()
    }
  })

  it('selects a node when clicking an arbitrary boundary point without dragging', () => {
    const node = createGraphNode('activity', 'activity-1', { x: 200, y: 120 })
    const harness = createHarness({
      documentNodes: [node],
      graphNodes: [node],
    })

    try {
      harness.pixiCanvasEl.dispatchEvent(
        new MouseEvent('pointerdown', {
          bubbles: true,
          button: 0,
          clientX: node.x + 32,
          clientY: node.y + 1,
        }),
      )
      harness.pixiCanvasEl.dispatchEvent(
        new MouseEvent('pointerup', {
          bubbles: true,
          button: 0,
          clientX: node.x + 32,
          clientY: node.y + 1,
        }),
      )

      expect(harness.onNodeClick).toHaveBeenCalledWith('activity-1', false)
      expect(harness.startConnection).not.toHaveBeenCalled()
    } finally {
      harness.destroy()
    }
  })

  it('does not clear selection when the node hit model catches up before pointerup', () => {
    const node = createGraphNode('activity', 'activity-1', { x: 200, y: 120 })
    const harness = createHarness({
      documentNodes: [node],
      graphNodes: [],
    })

    try {
      harness.pixiCanvasEl.dispatchEvent(
        new MouseEvent('pointerdown', {
          bubbles: true,
          button: 0,
          clientX: node.x + 48,
          clientY: node.y + 48,
        }),
      )

      // A layout switch can leave the native hit model one frame behind.
      // Once it catches up, releasing over the activity must not be treated
      // as a blank-canvas click that clears the Pixi selection.
      harness.graphNodesRef.current = [node]
      harness.pixiCanvasEl.dispatchEvent(
        new MouseEvent('pointerup', {
          bubbles: true,
          button: 0,
          clientX: node.x + 48,
          clientY: node.y + 48,
        }),
      )

      expect(harness.onPaneClick).not.toHaveBeenCalled()
    } finally {
      harness.destroy()
    }
  })

  it('prefers the topmost derived graph node when overlapping ports share a hit point', () => {
    const lowerNode = createGraphNode('activity', 'activity-under', { x: 200, y: 120 })
    const topNode = createGraphNode('activity', 'activity-top', { x: 200, y: 120 })
    const port = getPortPosition(topNode, 'out')
    const harness = createHarness({
      documentNodes: [topNode, lowerNode],
      graphNodes: [lowerNode, topNode],
    })

    try {
      harness.pixiCanvasEl.dispatchEvent(
        new MouseEvent('pointerdown', {
          bubbles: true,
          button: 0,
          clientX: port.x,
          clientY: port.y,
        }),
      )

      expect(harness.startConnection).toHaveBeenCalledWith('activity-top', 'out')
    } finally {
      harness.destroy()
    }
  })

  it('connects node bodies in connector mode using the preferred out-to-in ports', () => {
    const sourceNode = createGraphNode('activity', 'activity-source', { x: 200, y: 120 })
    const targetNode = createGraphNode('activity', 'activity-target', { x: 520, y: 120 })
    const harness = createHarness({
      documentNodes: [sourceNode, targetNode],
      graphNodes: [sourceNode, targetNode],
      connectorMode: true,
    })

    try {
      harness.pixiCanvasEl.dispatchEvent(
        new MouseEvent('pointerdown', {
          bubbles: true,
          button: 0,
          clientX: sourceNode.x + 48,
          clientY: sourceNode.y + 48,
        }),
      )
      harness.host.dispatchEvent(
        new MouseEvent('pointerdown', {
          bubbles: true,
          button: 0,
          clientX: targetNode.x + 48,
          clientY: targetNode.y + 48,
        }),
      )

      expect(harness.startConnection).toHaveBeenCalledWith('activity-source', 'out')
      expect(harness.onConnect).toHaveBeenCalledWith(
        'activity-source',
        'activity-target',
        'out',
        'in',
      )
    } finally {
      harness.destroy()
    }
  })

  it('connects from one endpoint to another node endpoint, even when the target endpoint is not an input', () => {
    const sourceNode = createGraphNode('activity', 'activity-source', { x: 200, y: 120 })
    const targetNode = createGraphNode('activity', 'activity-target', { x: 520, y: 120 })
    const sourcePort = getPortPosition(sourceNode, 'out')
    const targetPort = getPortPosition(targetNode, 'out')
    const harness = createHarness({
      documentNodes: [sourceNode, targetNode],
      graphNodes: [sourceNode, targetNode],
    })

    try {
      harness.pixiCanvasEl.dispatchEvent(
        new MouseEvent('pointerdown', {
          bubbles: true,
          button: 0,
          clientX: sourcePort.x,
          clientY: sourcePort.y,
        }),
      )
      harness.pixiCanvasEl.dispatchEvent(
        new MouseEvent('pointerdown', {
          bubbles: true,
          button: 0,
          clientX: targetPort.x,
          clientY: targetPort.y,
        }),
      )

      expect(harness.onConnect).toHaveBeenCalledWith(
        'activity-source',
        'activity-target',
        'out',
        'out',
        {
          sourceAnchor: { side: 'right', offset: 0.5 },
          targetAnchor: { side: 'right', offset: 0.5 },
        },
      )
    } finally {
      harness.destroy()
    }
  })

  it('connects from arbitrary points on node edges and preserves edge offsets', () => {
    const sourceNode = createGraphNode('activity', 'activity-source', { x: 200, y: 120 })
    const targetNode = createGraphNode('activity', 'activity-target', { x: 560, y: 300 })
    const sourcePoint = {
      x: sourceNode.x + sourceNode.width * 0.25,
      y: sourceNode.y,
    }
    const targetPoint = {
      x: targetNode.x + targetNode.width * 0.7,
      y: targetNode.y + targetNode.height,
    }
    const harness = createHarness({
      documentNodes: [sourceNode, targetNode],
      graphNodes: [sourceNode, targetNode],
    })

    try {
      harness.pixiCanvasEl.dispatchEvent(
        new MouseEvent('pointerdown', {
          bubbles: true,
          button: 0,
          clientX: sourcePoint.x,
          clientY: sourcePoint.y,
        }),
      )
      harness.pixiCanvasEl.dispatchEvent(
        new MouseEvent('pointermove', {
          bubbles: true,
          button: 0,
          clientX: targetPoint.x,
          clientY: targetPoint.y,
        }),
      )
      harness.pixiCanvasEl.dispatchEvent(
        new MouseEvent('pointerup', {
          bubbles: true,
          button: 0,
          clientX: targetPoint.x,
          clientY: targetPoint.y,
        }),
      )

      expect(harness.onConnect).toHaveBeenCalledWith(
        'activity-source',
        'activity-target',
        'top',
        'bottom',
        {
          sourceAnchor: { side: 'top', offset: 0.25 },
          targetAnchor: { side: 'bottom', offset: 0.7 },
        },
      )
    } finally {
      harness.destroy()
    }
  })

  it('keeps node double-click as selection-only instead of opening the editor', () => {
    const node = createGraphNode('activity', 'activity-1', { x: 200, y: 120 })
    const harness = createHarness({
      documentNodes: [node],
      graphNodes: [node],
    })

    try {
      for (let i = 0; i < 2; i += 1) {
        harness.pixiCanvasEl.dispatchEvent(
          new MouseEvent('pointerdown', {
            bubbles: true,
            button: 0,
            clientX: node.x + 48,
            clientY: node.y + 48,
          }),
        )
      }

      expect(harness.openEditor).not.toHaveBeenCalled()
    } finally {
      harness.destroy()
    }
  })

  it('does not clear selection by treating an edge click as a pane click', () => {
    const sourceNode = createGraphNode('activity', 'activity-source', { x: 200, y: 120 })
    const targetNode = createGraphNode('activity', 'activity-target', { x: 520, y: 120 })
    const edge: GraphEdge = {
      id: 'edge-1',
      sourceNodeId: sourceNode.id,
      sourcePortId: 'out',
      targetNodeId: targetNode.id,
      targetPortId: 'in',
      label: '',
    }
    const center = getEdgeLabelCenter(edge, new Map([
      [sourceNode.id, sourceNode],
      [targetNode.id, targetNode],
    ]))
    if (!center) throw new Error('missing edge center')
    const harness = createHarness({
      documentNodes: [sourceNode, targetNode],
      graphNodes: [sourceNode, targetNode],
      graphEdges: [edge],
    })

    try {
      harness.pixiCanvasEl.dispatchEvent(
        new MouseEvent('pointerdown', {
          bubbles: true,
          button: 0,
          clientX: center.x,
          clientY: center.y,
        }),
      )
      harness.pixiCanvasEl.dispatchEvent(
        new MouseEvent('pointerup', {
          bubbles: true,
          button: 0,
          clientX: center.x,
          clientY: center.y,
        }),
      )

      expect(harness.onPaneClick).not.toHaveBeenCalled()
    } finally {
      harness.destroy()
    }
  })

  it('sets the canvas title to the full node name while hovering a node', () => {
    const node = {
      ...createGraphNode('activity', 'activity-1', { x: 200, y: 120 }),
      title: 'Coordinate enterprise-scale compliance readiness review',
    }
    const harness = createHarness({
      documentNodes: [node],
      graphNodes: [node],
    })

    try {
      harness.pixiCanvasEl.dispatchEvent(
        new MouseEvent('pointermove', {
          bubbles: true,
          button: 0,
          clientX: node.x + 48,
          clientY: node.y + 48,
        }),
      )
      expect(harness.pixiCanvasEl.title).toBe(node.title)

      harness.pixiCanvasEl.dispatchEvent(
        new MouseEvent('pointermove', {
          bubbles: true,
          button: 0,
          clientX: node.x + node.width + 80,
          clientY: node.y + node.height + 80,
        }),
      )
      expect(harness.pixiCanvasEl.title).toBe('')
    } finally {
      harness.destroy()
    }
  })

  it('does not create a connection when the second endpoint belongs to the source node', () => {
    const sourceNode = createGraphNode('activity', 'activity-source', { x: 200, y: 120 })
    const sourceOut = getPortPosition(sourceNode, 'out')
    const sourceIn = getPortPosition(sourceNode, 'in')
    const harness = createHarness({
      documentNodes: [sourceNode],
      graphNodes: [sourceNode],
    })

    try {
      harness.pixiCanvasEl.dispatchEvent(
        new MouseEvent('pointerdown', {
          bubbles: true,
          button: 0,
          clientX: sourceOut.x,
          clientY: sourceOut.y,
        }),
      )
      harness.pixiCanvasEl.dispatchEvent(
        new MouseEvent('pointerdown', {
          bubbles: true,
          button: 0,
          clientX: sourceIn.x,
          clientY: sourceIn.y,
        }),
      )

      expect(harness.onConnect).not.toHaveBeenCalled()
      expect(harness.cancelConnection).toHaveBeenCalled()
    } finally {
      harness.destroy()
    }
  })

  it('opens the connected-node type menu when a right-side endpoint connection is released on blank canvas', () => {
    const sourceNode = createGraphNode('activity', 'activity-source', { x: 200, y: 120 })
    const sourcePort = getPortPosition(sourceNode, 'out')
    const harness = createHarness({
      documentNodes: [sourceNode],
      graphNodes: [sourceNode],
    })

    try {
      harness.pixiCanvasEl.dispatchEvent(
        new MouseEvent('pointerdown', {
          bubbles: true,
          button: 0,
          clientX: sourcePort.x,
          clientY: sourcePort.y,
        }),
      )
      harness.pixiCanvasEl.dispatchEvent(
        new MouseEvent('pointerdown', {
          bubbles: true,
          button: 0,
          clientX: 720,
          clientY: 360,
        }),
      )
      harness.pixiCanvasEl.dispatchEvent(
        new MouseEvent('pointerup', {
          bubbles: true,
          button: 0,
          clientX: 720,
          clientY: 360,
        }),
      )

      expect(harness.openConnectionCreateMenu).toHaveBeenCalledWith({
        sourceNodeId: 'activity-source',
        sourcePortId: 'out',
        sourceAnchor: { side: 'right', offset: 0.5 },
        worldPosition: { x: 720, y: 360 },
        screenPosition: { x: 720, y: 360 },
        clientPosition: { x: 720, y: 360 },
      })
      expect(harness.onPaneClick).not.toHaveBeenCalled()
      expect(harness.cancelConnection).toHaveBeenCalled()
    } finally {
      harness.destroy()
    }
  })

  it('pans the whiteboard when dragging empty canvas with the primary mouse button', () => {
    const harness = createHarness({
      documentNodes: [],
      graphNodes: [],
    })

    try {
      harness.host.dispatchEvent(
        new MouseEvent('pointerdown', {
          bubbles: true,
          button: 0,
          clientX: 400,
          clientY: 300,
        }),
      )
      harness.pixiCanvasEl.dispatchEvent(
        new MouseEvent('pointermove', {
          bubbles: true,
          button: 0,
          clientX: 460,
          clientY: 335,
        }),
      )
      harness.pixiCanvasEl.dispatchEvent(
        new MouseEvent('pointerup', {
          bubbles: true,
          button: 0,
          clientX: 460,
          clientY: 335,
        }),
      )

      expect(harness.panBy).toHaveBeenCalledWith(60, 35)
      expect(harness.selectNodesInRect).not.toHaveBeenCalled()
      expect(harness.onPaneClick).not.toHaveBeenCalled()
    } finally {
      harness.destroy()
    }
  })

  it('keeps Shift-drag as marquee selection instead of panning', () => {
    const harness = createHarness({
      documentNodes: [],
      graphNodes: [],
    })

    try {
      harness.pixiCanvasEl.dispatchEvent(
        new MouseEvent('pointerdown', {
          bubbles: true,
          button: 0,
          shiftKey: true,
          clientX: 40,
          clientY: 50,
        }),
      )
      harness.pixiCanvasEl.dispatchEvent(
        new MouseEvent('pointermove', {
          bubbles: true,
          button: 0,
          shiftKey: true,
          clientX: 120,
          clientY: 140,
        }),
      )
      harness.pixiCanvasEl.dispatchEvent(
        new MouseEvent('pointerup', {
          bubbles: true,
          button: 0,
          shiftKey: true,
          clientX: 120,
          clientY: 140,
        }),
      )

      expect(harness.panBy).not.toHaveBeenCalled()
      expect(harness.selectNodesInRect).toHaveBeenCalledWith(40, 50, 120, 140)
    } finally {
      harness.destroy()
    }
  })

  it('zooms at canvas-local mouse coordinates when the host is offset', () => {
    const harness = createHarness({
      documentNodes: [],
      graphNodes: [],
      rect: { left: 260, top: 40, width: 1200, height: 900 },
    })

    try {
      harness.host.dispatchEvent(
        new WheelEvent('wheel', {
          bubbles: true,
          cancelable: true,
          deltaY: -120,
          deltaMode: 1,
          clientX: 660,
          clientY: 340,
        }),
      )

      expect(harness.zoomAt).toHaveBeenCalledWith(1.25, 400, 300)
    } finally {
      harness.destroy()
    }
  })
})
