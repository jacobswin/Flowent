import { useCallback, useEffect, useMemo, useRef } from 'react'
import type { FederatedPointerEvent } from 'pixi.js'
import type { ProcessNode } from './canvasTypes'
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

  const graphNodes = useMemo(
    () => canvas.nodes.map(toGraphNode),
    [canvas.nodes],
  )

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

  const nodesById = useMemo(() => {
    const map = new Map<string, ReturnType<typeof toGraphNode>>()
    for (const node of graphNodes) {
      map.set(node.id, node)
    }
    return map
  }, [graphNodes])

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

      let lastClickTime = 0
      let lastClickNodeId: string | null = null

      const redraw = () => {
        const width = host.clientWidth
        const height = host.clientHeight

        drawGrid(layers.gridLayer, width, height)
        drawEdges(layers.edgeLayer, graphEdges, nodesById, null)
        drawNodes(layers.nodeLayer, graphNodes, canvas.selectedNodeIds)

        // Attach events to nodes
        for (const child of layers.nodeLayer.children) {
          const nodeId = (child as { label?: string }).label
          if (!nodeId) continue

          // Remove existing listeners to avoid duplicates
          child.removeAllListeners()

          // Single click - select
          child.on('pointertap', (event: FederatedPointerEvent) => {
            const now = Date.now()
            const timeSinceLastClick = now - lastClickTime
            const isSameNode = lastClickNodeId === nodeId

            if (timeSinceLastClick < 300 && isSameNode) {
              // Double click - open editor
              canvas.openEditor(nodeId)
            } else {
              // Single click - select
              const additive = event.shiftKey || event.ctrlKey || event.metaKey
              canvas.onNodeClick(nodeId, additive)
            }

            lastClickTime = now
            lastClickNodeId = nodeId
          })

          // Drag support
          let dragging = false
          let startX = 0
          let startY = 0

          child.on('pointerdown', (event: FederatedPointerEvent) => {
            dragging = true
            startX = event.globalX
            startY = event.globalY
          })

          child.on('globalpointermove', (event: FederatedPointerEvent) => {
            if (!dragging) return

            const dx = event.globalX - startX
            const dy = event.globalY - startY

            if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
              canvas.moveSelectedNodes(dx, dy)
              startX = event.globalX
              startY = event.globalY
            }
          })

          child.on('pointerup', () => {
            dragging = false
          })

          child.on('pointerupoutside', () => {
            dragging = false
          })
        }
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
        hasSelection={canvas.selectedNodeIds.size > 0}
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
        edge={null}
        onUpdateNode={canvas.updateNodeData}
        onClose={() => canvas.closeEditor()}
      />
    </div>
  )
}

function toGraphNode(node: ProcessNode) {
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
