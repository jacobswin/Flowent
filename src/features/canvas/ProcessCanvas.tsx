import { useCallback, useEffect, useMemo, useRef } from 'react'
import type { FederatedPointerEvent } from 'pixi.js'
import { Graphics } from 'pixi.js'
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
        case 'zoom-in':
          canvas.zoomIn()
          break
        case 'zoom-out':
          canvas.zoomOut()
          break
        case 'zoom-reset':
          canvas.zoomReset()
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
      let isMarqueeDragging = false
      let marqueeStartX = 0
      let marqueeStartY = 0

      // Marquee rectangle graphics
      const marqueeRect = new Graphics()
      marqueeRect.visible = false
      layers.overlayLayer.addChild(marqueeRect)

      // Handle marquee on canvas background
      const hitArea = new Graphics()
      hitArea.rect(0, 0, host.clientWidth, host.clientHeight)
      hitArea.fill({ color: 0x000000, alpha: 0.001 }) // Nearly invisible hit area
      hitArea.eventMode = 'static'
      hitArea.cursor = 'default'
      layers.overlayLayer.addChild(hitArea)

      let isPanning = false
      let panStartX = 0
      let panStartY = 0
      let spaceDown = false

      window.addEventListener('keydown', (e) => {
        if (e.code === 'Space' && !e.repeat) {
          spaceDown = true
          hitArea.cursor = 'grab'
        }
      })

      window.addEventListener('keyup', (e) => {
        if (e.code === 'Space') {
          spaceDown = false
          hitArea.cursor = 'default'
        }
      })

      hitArea.on('pointerdown', (event: FederatedPointerEvent) => {
        if (spaceDown) {
          isPanning = true
          panStartX = event.globalX
          panStartY = event.globalY
          hitArea.cursor = 'grabbing'
          return
        }

        isMarqueeDragging = true
        marqueeStartX = event.globalX
        marqueeStartY = event.globalY
        marqueeRect.visible = true
        canvas.onPaneClick()
      })

      hitArea.on('globalpointermove', (event: FederatedPointerEvent) => {
        if (isPanning) {
          const dx = event.globalX - panStartX
          const dy = event.globalY - panStartY
          canvas.panBy(dx, dy)
          panStartX = event.globalX
          panStartY = event.globalY
          return
        }

        if (!isMarqueeDragging) return

        const x1 = Math.min(marqueeStartX, event.globalX)
        const y1 = Math.min(marqueeStartY, event.globalY)
        const x2 = Math.max(marqueeStartX, event.globalX)
        const y2 = Math.max(marqueeStartY, event.globalY)

        marqueeRect.clear()
        marqueeRect.rect(x1, y1, x2 - x1, y2 - y1)
        marqueeRect.fill({ color: 0x0071e3, alpha: 0.1 })
        marqueeRect.stroke({ color: 0x0071e3, alpha: 0.4, width: 1 })
      })

      hitArea.on('pointerup', (event: FederatedPointerEvent) => {
        if (isPanning) {
          isPanning = false
          hitArea.cursor = spaceDown ? 'grab' : 'default'
          return
        }

        if (!isMarqueeDragging) return
        isMarqueeDragging = false
        marqueeRect.visible = false

        const x1 = Math.min(marqueeStartX, event.globalX)
        const y1 = Math.min(marqueeStartY, event.globalY)
        const x2 = Math.max(marqueeStartX, event.globalX)
        const y2 = Math.max(marqueeStartY, event.globalY)

        // Only marquee if dragged more than 5px
        if (Math.abs(x2 - x1) < 5 && Math.abs(y2 - y1) < 5) return

        // Select nodes within marquee
        canvas.selectNodesInRect(x1, y1, x2, y2)
      })

      hitArea.on('pointerupoutside', () => {
        isPanning = false
        isMarqueeDragging = false
        marqueeRect.visible = false
      })

      const redraw = () => {
        const width = host.clientWidth
        const height = host.clientHeight

        // Apply viewport transform
        stage.root.x = canvas.viewport.x
        stage.root.y = canvas.viewport.y
        stage.root.scale.set(canvas.viewport.zoom)

        // Update hit area size
        hitArea.clear()
        hitArea.rect(0, 0, width / canvas.viewport.zoom, height / canvas.viewport.zoom)
        hitArea.fill({ color: 0x000000, alpha: 0.001 })

        drawGrid(layers.gridLayer, width / canvas.viewport.zoom, height / canvas.viewport.zoom)
        drawEdges(layers.edgeLayer, graphEdges, nodesById, null)
        drawNodes(layers.nodeLayer, graphNodes, canvas.selectedNodeIds)

        // Attach events to nodes and ports
        for (const child of layers.nodeLayer.children) {
          const label = (child as { label?: string }).label
          if (!label) continue

          // Remove existing listeners to avoid duplicates
          child.removeAllListeners()

          // Check if this is a port
          if (label.startsWith('port:')) {
            let portDragging = false
            let portStartX = 0
            let portStartY = 0
            let sourceNodeId = ''

            // Find parent node
            const parent = child.parent
            if (parent && 'label' in parent) {
              sourceNodeId = (parent as { label: string }).label
            }

            child.on('pointerdown', (event: FederatedPointerEvent) => {
              portDragging = true
              portStartX = event.globalX
              portStartY = event.globalY
            })

            child.on('globalpointermove', (event: FederatedPointerEvent) => {
              if (!portDragging) return

              // Draw temporary connection line
              layers.overlayLayer.children.forEach((c) => {
                if ((c as { label?: string }).label === 'temp-connection') {
                  layers.overlayLayer.removeChild(c)
                }
              })

              const tempLine = new Graphics()
              tempLine.label = 'temp-connection'
              tempLine.stroke({ color: 0x0071e3, width: 2, alpha: 0.6 })
              tempLine.moveTo(portStartX, portStartY)
              tempLine.lineTo(event.globalX, event.globalY)
              layers.overlayLayer.addChild(tempLine)
            })

            child.on('pointerup', (event: FederatedPointerEvent) => {
              if (!portDragging) return
              portDragging = false

              // Remove temporary line
              layers.overlayLayer.children.forEach((c) => {
                if ((c as { label?: string }).label === 'temp-connection') {
                  layers.overlayLayer.removeChild(c)
                }
              })

              // Find target node under cursor
              const targetNode = findNodeAtPosition(
                event.globalX,
                event.globalY,
                graphNodes,
                sourceNodeId,
              )

              if (targetNode) {
                canvas.onConnect(sourceNodeId, targetNode.id)
              }
            })

            child.on('pointerupoutside', () => {
              portDragging = false
              layers.overlayLayer.children.forEach((c) => {
                if ((c as { label?: string }).label === 'temp-connection') {
                  layers.overlayLayer.removeChild(c)
                }
              })
            })

            continue
          }

          // Node event handling
          child.on('pointertap', (event: FederatedPointerEvent) => {
            const now = Date.now()
            const timeSinceLastClick = now - lastClickTime
            const isSameNode = lastClickNodeId === label

            if (timeSinceLastClick < 300 && isSameNode) {
              // Double click - open editor
              canvas.openEditor(label)
            } else {
              // Single click - select
              const additive = event.shiftKey || event.ctrlKey || event.metaKey
              canvas.onNodeClick(label, additive)
            }

            lastClickTime = now
            lastClickNodeId = label
          })

          // Drag support for node
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

function findNodeAtPosition(
  x: number,
  y: number,
  nodes: ReturnType<typeof toGraphNode>[],
  excludeNodeId: string,
): ReturnType<typeof toGraphNode> | null {
  for (const node of nodes) {
    if (node.id === excludeNodeId) continue
    if (
      x >= node.x &&
      x <= node.x + node.width &&
      y >= node.y &&
      y <= node.y + node.height
    ) {
      return node
    }
  }
  return null
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
