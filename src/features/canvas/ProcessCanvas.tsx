import { useCallback, useEffect, useMemo, useRef } from 'react'
import type { FederatedPointerEvent } from 'pixi.js'
import { Toolbar } from './Toolbar'
import { PropertiesPanel } from './PropertiesPanel'
import { useCanvasState } from './useCanvasState'
import { createPixiStage } from './render/pixiStage'
import { createCanvasLayers, drawGrid } from './render/layers'
import { drawNodes } from './render/drawNodes'
import { drawEdges } from './render/drawEdges'
import { mapKeyToAction } from './engine/keyboard'

export function ProcessCanvas() {
  const canvas = useCanvasState()
  const hostRef = useRef<HTMLDivElement | null>(null)

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      const action = mapKeyToAction({
        key: event.key,
        metaKey: event.metaKey,
        ctrlKey: event.ctrlKey,
        shiftKey: event.shiftKey,
      })

      if (!action) return

      event.preventDefault()

      switch (action) {
        case 'tool-activity':
          canvas.addActivity()
          break
        case 'tool-decision':
          canvas.addDecision()
          break
        case 'tool-start-end':
          canvas.addEnd()
          break
        case 'auto-layout':
          canvas.autoLayout()
          break
        case 'undo':
          canvas.undo()
          break
        case 'redo':
          canvas.redo()
          break
        case 'delete':
          canvas.removeSelected()
          break
      }
    },
    [canvas],
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  const nodesById = useMemo(() => {
    const map = new Map<string, ReturnType<typeof toGraphNode>>()
    for (const node of canvas.nodes) {
      const graphNode = toGraphNode(node)
      map.set(graphNode.id, graphNode)
    }
    return map
  }, [canvas.nodes])

  const graphNodes = useMemo(() => Array.from(nodesById.values()), [nodesById])
  const graphEdges = useMemo(
    () =>
      canvas.edges
        .filter((e) => e.source && e.target)
        .map((e) => ({
          id: e.id,
          sourceNodeId: e.source,
          sourcePortId: e.sourceHandle ?? 'out',
          targetNodeId: e.target,
          targetPortId: e.targetHandle ?? 'in',
          label: e.data?.label ?? '',
        })),
    [canvas.edges],
  )

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    let disposed = false
    let destroy: (() => void) | null = null

    const run = async () => {
      const stage = await createPixiStage(host)
      if (disposed) {
        stage.destroy()
        return
      }

      destroy = stage.destroy

      const layers = createCanvasLayers(stage.root)

      const redraw = () => {
        const width = host.clientWidth
        const height = host.clientHeight

        drawGrid(layers.gridLayer, width, height)
        drawEdges(layers.edgeLayer, graphEdges, nodesById, canvas.selectedEdgeId)
        drawNodes(layers.nodeLayer, graphNodes, canvas.selectedNodeId)

        attachNodeEvents(layers.nodeLayer, canvas)
        attachEdgeEvents(layers.edgeLayer, canvas)
      }

      redraw()

      const ticker = () => redraw()
      stage.app.ticker.add(ticker)

      destroy = () => {
        stage.app.ticker.remove(ticker)
        stage.destroy()
      }
    }

    run().catch(() => {
      // no-op: drawing failures should not crash the app shell
    })

    return () => {
      disposed = true
      destroy?.()
    }
  }, [
    canvas,
    graphEdges,
    graphNodes,
    nodesById,
  ])

  return (
    <div className="canvas-container">
      <div className="canvas-header">
        <h1 className="canvas-title">Flowent</h1>
        <p className="canvas-subtitle">Process maps for aligned product teams</p>
      </div>

      <Toolbar
        onAddActivity={canvas.addActivity}
        onAddDecision={canvas.addDecision}
        onAddEnd={canvas.addEnd}
        onRemove={canvas.removeSelected}
        onAutoLayout={() => canvas.autoLayout()}
        hasSelection={Boolean(canvas.selectedNodeId || canvas.selectedEdgeId)}
      />

      <div ref={hostRef} className="pixi-host" aria-label="Process canvas" />

      <div className="keyboard-hint" aria-hidden="true">
        <span><kbd>A</kbd> Activity</span>
        <span><kbd>D</kbd> Decision</span>
        <span><kbd>L</kbd> Layout</span>
        <span><kbd>⌘Z</kbd> Undo</span>
        <span><kbd>Del</kbd> Delete</span>
      </div>

      <PropertiesPanel
        node={canvas.editorNode}
        edge={canvas.selectedEdge}
        onUpdateNode={canvas.updateNodeData}
        onClose={() => canvas.closeEditor()}
      />
    </div>
  )
}

function attachNodeEvents(
  nodeLayer: {
    children: Array<{
      label?: string
      on?: (event: string, handler: (event: FederatedPointerEvent) => void) => void
    }>
  },
  canvas: ReturnType<typeof useCanvasState>,
): void {
  for (const child of nodeLayer.children) {
    if (!child.label || !child.on) continue

    child.on('pointertap', () => {
      const node = canvas.nodes.find((n) => n.id === child.label)
      if (node) {
        canvas.onNodeClick({} as React.MouseEvent, node)
      }
    })

    child.on('pointerdown', () => {
      const node = canvas.nodes.find((n) => n.id === child.label)
      if (node) {
        canvas.onNodeClick({} as React.MouseEvent, node)
      }
    })

    child.on('doubleclick', () => {
      const node = canvas.nodes.find((n) => n.id === child.label)
      if (node) {
        canvas.openEditor(node.id)
      }
    })
  }
}

function attachEdgeEvents(
  edgeLayer: {
    children: Array<{
      label?: string
      on?: (event: string, handler: (event: FederatedPointerEvent) => void) => void
    }>
  },
  canvas: ReturnType<typeof useCanvasState>,
): void {
  for (const child of edgeLayer.children) {
    if (!child.label || !child.on) continue

    child.on('pointertap', () => {
      const edge = canvas.edges.find((e) => e.id === child.label)
      if (edge) {
        canvas.onEdgeClick({} as React.MouseEvent, edge)
      }
    })
  }
}

function toGraphNode(node: ReturnType<typeof useCanvasState>['nodes'][number]) {
  if (node.data.kind === 'activity') {
    return {
      id: node.id,
      type: 'activity' as const,
      x: node.position.x,
      y: node.position.y,
      width: 220,
      height: 96,
      title: node.data.title,
      summary: node.data.summary,
      roleTags: node.data.roleIds,
      ports: [
        { id: 'in', side: 'top' as const },
        { id: 'out', side: 'bottom' as const },
      ],
    }
  }

  if (node.data.kind === 'decision') {
    return {
      id: node.id,
      type: 'decision' as const,
      x: node.position.x,
      y: node.position.y,
      width: 180,
      height: 108,
      title: node.data.title,
      criteria: node.data.criteria,
      roleTags: [],
      ports: [
        { id: 'in', side: 'top' as const },
        { id: 'yes', side: 'bottom' as const },
        { id: 'no', side: 'right' as const },
      ],
    }
  }

  const isStart = node.data.kind === 'start'

  return {
    id: node.id,
    type: isStart ? ('start' as const) : ('end' as const),
    x: node.position.x,
    y: node.position.y,
    width: 120,
    height: 56,
    title: node.data.label,
    roleTags: [],
    ports: [{ id: isStart ? 'out' : 'in', side: isStart ? ('bottom' as const) : ('top' as const) }],
  }
}
