import { useState } from 'react'
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react'
import type { ConnectionCreateRequest, EdgeEndpointAnchor, ProcessEdge, ProcessNode } from './canvasTypes'
import type { EdgeLabelAnchor } from './useEdgeLabelEditor'
import { getEdgeLabelCenter } from './render/edgeGeometry'
import type { GraphNode } from './canvasTypes'
import { EDGE_COLOR_SWATCHES, normalizeEdgeColor } from './edgeColors'
import { PROCESS_ELEMENTS, type ProcessElementType } from './processElements'
import { findNearestTargetPort, getPortAnchor } from './routing/ports'
import {
  buildQuickConnectorCreateRequest,
  findQuickConnectorTargetNode,
  getQuickConnectorSourcePortId,
  screenToWorld,
  worldToScreen,
} from './routing/quickConnector'

interface CanvasOverlaysProps {
  hostOrigin: { left: number; top: number }
  viewport: { x: number; y: number; zoom: number }
  labelEditor: {
    openEdgeId: string | null
    anchor: EdgeLabelAnchor | null
    commit: (value: string) => void
    cancel: () => void
    openAt: (edgeId: string, anchor: EdgeLabelAnchor) => void
  }
  edges: ProcessEdge[]
  nodes: ProcessNode[]
  selectedNodeIds: Set<string>
  selectedEdge: ProcessEdge | null
  connectionCreateMenu: ConnectionCreateRequest | null
  edgeContextMenu: { edgeId: string; screenPosition: { x: number; y: number } } | null
  onPickConnectionNodeType: (type: ProcessElementType) => void
  onCancelConnectionCreate: () => void
  onConnect: (
    sourceNodeId: string,
    targetNodeId: string,
    sourcePortId?: string,
    targetPortId?: string,
    anchors?: { sourceAnchor?: EdgeEndpointAnchor; targetAnchor?: EdgeEndpointAnchor },
  ) => void
  onOpenConnectionCreateMenu: (request: ConnectionCreateRequest) => void
  onOpenEdgeContextMenu: (edgeId: string, screenPosition: { x: number; y: number }) => void
  onCloseEdgeContextMenu: () => void
  onUpdateEdgeColor: (edgeId: string, color: string) => void
  onEdgeClick: (edgeId: string, additive: boolean) => void
  onNodeClick: (nodeId: string, additive: boolean) => void
  openEditor: (nodeId: string) => void
  openEdgeEditor: (edgeId: string) => void
  removeSelected: () => void
  nodesById: Map<string, GraphNode>
}

type QuickConnectorDrag = {
  sourceNodeId: string
  sourcePortId: string
  anchorClient: { x: number; y: number }
  currentClient: { x: number; y: number }
  startClient: { x: number; y: number }
  moved: boolean
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function getConnectionMenuPosition(
  request: ConnectionCreateRequest,
  hostOrigin: { left: number; top: number },
): { left: number; top: number } {
  const viewportWidth = typeof window === 'undefined' ? 1280 : window.innerWidth || 1280
  const viewportHeight = typeof window === 'undefined' ? 720 : window.innerHeight || 720
  const menuWidth = 190
  const menuHeight = 252
  const padding = 12
  const horizontalGap = 12
  const verticalOffset = -10

  const anchorX = request.clientPosition?.x ?? request.screenPosition.x + hostOrigin.left
  const anchorY = request.clientPosition?.y ?? request.screenPosition.y + hostOrigin.top
  let left = anchorX + horizontalGap
  if (left + menuWidth > viewportWidth - padding) {
    left = anchorX - menuWidth - horizontalGap
  }

  let top = anchorY + verticalOffset
  if (top + menuHeight > viewportHeight - padding) {
    top = anchorY - menuHeight - Math.abs(verticalOffset)
  }

  return {
    left: clamp(left, padding, viewportWidth - menuWidth - padding),
    top: clamp(top, padding, viewportHeight - menuHeight - padding),
  }
}

function getEdgeContextMenuPosition(
  screenPosition: { x: number; y: number },
  hostOrigin: { left: number; top: number },
): { left: number; top: number } {
  const viewportWidth = typeof window === 'undefined' ? 1280 : window.innerWidth || 1280
  const viewportHeight = typeof window === 'undefined' ? 720 : window.innerHeight || 720
  const menuWidth = 204
  const menuHeight = 156
  const padding = 12
  const gap = 8

  return {
    left: clamp(screenPosition.x + hostOrigin.left + gap, padding, viewportWidth - menuWidth - padding),
    top: clamp(screenPosition.y + hostOrigin.top + gap, padding, viewportHeight - menuHeight - padding),
  }
}

function edgeSwatchStyle(color: string): CSSProperties {
  return { '--edge-color': color } as CSSProperties
}

export function CanvasOverlays({
  hostOrigin,
  viewport,
  labelEditor,
  edges,
  nodes,
  selectedNodeIds,
  selectedEdge,
  connectionCreateMenu,
  edgeContextMenu,
  onPickConnectionNodeType,
  onCancelConnectionCreate,
  onConnect,
  onOpenConnectionCreateMenu,
  onOpenEdgeContextMenu,
  onCloseEdgeContextMenu,
  onUpdateEdgeColor,
  onEdgeClick,
  onNodeClick,
  openEditor,
  openEdgeEditor,
  removeSelected,
  nodesById,
}: CanvasOverlaysProps) {
  const [quickConnectorDrag, setQuickConnectorDrag] = useState<QuickConnectorDrag | null>(null)
  const graphNodes = Array.from(nodesById.values())
  const edgeForContextMenu = edgeContextMenu
    ? edges.find((edge) => edge.id === edgeContextMenu.edgeId) ?? null
    : null
  const edgeForLabelEditor = labelEditor.openEdgeId
    ? edges.find((edge) => edge.id === labelEditor.openEdgeId) ?? null
    : null
  const selectedEdgeCenter = (() => {
    if (!selectedEdge) return null
    return getEdgeLabelCenter(
      {
        id: selectedEdge.id,
        label: selectedEdge.data?.label ?? '',
        sourceNodeId: selectedEdge.source,
        sourcePortId: selectedEdge.sourceHandle ?? 'out',
        sourceAnchor: selectedEdge.data?.sourceAnchor,
        targetNodeId: selectedEdge.target,
        targetPortId: selectedEdge.targetHandle ?? 'in',
        targetAnchor: selectedEdge.data?.targetAnchor,
        fromRole: selectedEdge.data?.fromRole,
        toRole: selectedEdge.data?.toRole,
        artifact: selectedEdge.data?.artifact,
        expectation: selectedEdge.data?.expectation,
        readinessSignal: selectedEdge.data?.readinessSignal,
      },
      nodesById,
    )
  })()

  const openDefaultCreateMenu = (
    node: GraphNode,
    sourcePortId: string,
    pointer?: { screenPosition: { x: number; y: number }; clientPosition: { x: number; y: number } },
  ) => {
    const request = buildQuickConnectorCreateRequest(node, viewport, {
      sourcePortId,
      screenPosition: pointer?.screenPosition,
      clientPosition: pointer?.clientPosition,
    })
    if (request) onOpenConnectionCreateMenu(request)
  }

  const pointerToCanvasScreen = (event: Pick<ReactPointerEvent, 'clientX' | 'clientY'>) => ({
    x: event.clientX - hostOrigin.left,
    y: event.clientY - hostOrigin.top,
  })

  const pointIsInsideNode = (point: { x: number; y: number }, node: GraphNode) =>
    point.x >= node.x &&
    point.x <= node.x + node.width &&
    point.y >= node.y &&
    point.y <= node.y + node.height

  const finishQuickConnectorDrag = (
    drag: QuickConnectorDrag,
    event: ReactPointerEvent<HTMLButtonElement>,
  ) => {
    const sourceNode = nodesById.get(drag.sourceNodeId)
    if (!sourceNode) return

    if (!drag.moved) {
      openDefaultCreateMenu(sourceNode, drag.sourcePortId, {
        screenPosition: pointerToCanvasScreen(event),
        clientPosition: { x: event.clientX, y: event.clientY },
      })
      return
    }

    const screenPoint = pointerToCanvasScreen(event)
    const worldPoint = screenToWorld(screenPoint, viewport)
    if (pointIsInsideNode(worldPoint, sourceNode)) return

    const targetNode = findQuickConnectorTargetNode(graphNodes, worldPoint, drag.sourceNodeId)
    if (targetNode) {
      const targetPort = findNearestTargetPort(targetNode, worldPoint)
      if (targetPort) {
        onConnect(drag.sourceNodeId, targetNode.id, drag.sourcePortId, targetPort.id, {
          targetAnchor: targetPort.anchor,
        })
      }
      return
    }

    const request = buildQuickConnectorCreateRequest(sourceNode, viewport, {
      sourcePortId: drag.sourcePortId,
      worldPosition: worldPoint,
      clientPosition: { x: event.clientX, y: event.clientY },
    })
    if (request) onOpenConnectionCreateMenu(request)
  }

  const selectedQuickConnectorNodes = Array.from(selectedNodeIds)
    .map((nodeId) => nodesById.get(nodeId) ?? null)
    .filter((node): node is GraphNode => Boolean(node && getQuickConnectorSourcePortId(node)))
  const selectedActionNode = (() => {
    if (selectedNodeIds.size !== 1) return null
    const [nodeId] = Array.from(selectedNodeIds)
    return nodesById.get(nodeId) ?? null
  })()

  return (
    <>
      {quickConnectorDrag?.moved && (
        <svg className="quick-connector-preview" aria-hidden="true">
          <path
            d={[
              `M ${quickConnectorDrag.anchorClient.x} ${quickConnectorDrag.anchorClient.y}`,
              `H ${(quickConnectorDrag.anchorClient.x + quickConnectorDrag.currentClient.x) / 2}`,
              `V ${quickConnectorDrag.currentClient.y}`,
              `H ${quickConnectorDrag.currentClient.x}`,
            ].join(' ')}
          />
        </svg>
      )}

      {selectedQuickConnectorNodes.map((node) => {
        const sourcePortId = getQuickConnectorSourcePortId(node)
        if (!sourcePortId) return null
        const anchor = getPortAnchor(node, sourcePortId, 'source')
        const screen = worldToScreen(anchor, viewport)
        const clientAnchor = {
          x: screen.x + hostOrigin.left,
          y: screen.y + hostOrigin.top,
        }
        const label = node.title || node.id

        return (
          <button
            key={`${node.id}:${sourcePortId}`}
            type="button"
            className="node-plus-create-handle"
            aria-label={`Quick connect from ${label}`}
            title="Add next"
            style={{
              left: `${clientAnchor.x}px`,
              top: `${clientAnchor.y}px`,
            }}
            onPointerDown={(event) => {
              if (event.button !== 0) return
              event.preventDefault()
              event.stopPropagation()
              try {
                event.currentTarget.setPointerCapture(event.pointerId)
              } catch {
                // Pointer capture is best-effort for test environments and older browsers.
              }
              setQuickConnectorDrag({
                sourceNodeId: node.id,
                sourcePortId,
                anchorClient: clientAnchor,
                currentClient: { x: event.clientX, y: event.clientY },
                startClient: { x: event.clientX, y: event.clientY },
                moved: false,
              })
            }}
            onPointerMove={(event) => {
              setQuickConnectorDrag((drag) => {
                if (!drag || drag.sourceNodeId !== node.id || drag.sourcePortId !== sourcePortId) {
                  return drag
                }
                const dx = event.clientX - drag.startClient.x
                const dy = event.clientY - drag.startClient.y
                return {
                  ...drag,
                  currentClient: { x: event.clientX, y: event.clientY },
                  moved: drag.moved || Math.hypot(dx, dy) >= 4,
                }
              })
            }}
            onPointerUp={(event) => {
              event.preventDefault()
              event.stopPropagation()
              const drag = quickConnectorDrag
              if (drag && drag.sourceNodeId === node.id && drag.sourcePortId === sourcePortId) {
                finishQuickConnectorDrag(drag, event)
              }
              setQuickConnectorDrag(null)
            }}
            onPointerCancel={() => {
              setQuickConnectorDrag(null)
            }}
          >
            <span aria-hidden="true">+</span>
          </button>
        )
      })}

      {connectionCreateMenu && (
        <div
          className="connection-type-menu"
          role="menu"
          aria-label="Choose next node type"
          style={{
            left: `${getConnectionMenuPosition(connectionCreateMenu, hostOrigin).left}px`,
            top: `${getConnectionMenuPosition(connectionCreateMenu, hostOrigin).top}px`,
          }}
        >
          <div className="connection-type-menu-header">Add next</div>
          <div className="connection-type-menu-options">
            {PROCESS_ELEMENTS.map((element) => (
              <button
                key={element.type}
                type="button"
                role="menuitem"
                className="connection-type-menu-option"
                onClick={() => onPickConnectionNodeType(element.type)}
              >
                <span className="connection-type-menu-icon" aria-hidden="true">
                  {element.label.slice(0, 1)}
                </span>
                <span>{element.label}</span>
              </button>
            ))}
          </div>
          <button
            type="button"
            className="connection-type-menu-cancel"
            onClick={onCancelConnectionCreate}
          >
            Cancel
          </button>
        </div>
      )}

      {selectedActionNode && (
        <div
          className="node-quick-actions"
          role="toolbar"
          aria-label="Node quick actions"
          style={{
            left: `${(selectedActionNode.x + selectedActionNode.width / 2) * viewport.zoom + viewport.x + hostOrigin.left}px`,
            top: `${selectedActionNode.y * viewport.zoom + viewport.y + hostOrigin.top}px`,
          }}
        >
          <button
            type="button"
            aria-label="Edit node"
            onClick={() => openEditor(selectedActionNode.id)}
          >
            Edit
          </button>
          <button
            type="button"
            className="node-quick-delete"
            onClick={removeSelected}
          >
            Delete
          </button>
        </div>
      )}

      {selectedEdge && selectedEdgeCenter && (
        <div
          className="edge-quick-actions"
          role="toolbar"
          aria-label="Connection quick actions"
          style={{
            left: `${selectedEdgeCenter.x * viewport.zoom + viewport.x + hostOrigin.left}px`,
            top: `${selectedEdgeCenter.y * viewport.zoom + viewport.y + hostOrigin.top}px`,
          }}
        >
          <button
            type="button"
            aria-label="Edit connection"
            onClick={() => openEdgeEditor(selectedEdge.id)}
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => {
              labelEditor.openAt(selectedEdge.id, selectedEdgeCenter)
            }}
          >
            Label
          </button>
          <div className="edge-color-swatches" aria-label="Connection color">
            {EDGE_COLOR_SWATCHES.map((swatch) => {
              const selectedColor = normalizeEdgeColor(selectedEdge.data?.color)
              return (
                <button
                  key={swatch.value}
                  type="button"
                  className="edge-color-swatch"
                  aria-label={`Set connection color ${swatch.name}`}
                  aria-pressed={selectedColor === swatch.value}
                  title={swatch.name}
                  style={edgeSwatchStyle(swatch.value)}
                  onClick={() => onUpdateEdgeColor(selectedEdge.id, swatch.value)}
                />
              )
            })}
          </div>
          <button
            type="button"
            className="edge-quick-delete"
            onClick={removeSelected}
          >
            Delete
          </button>
        </div>
      )}

      {edgeContextMenu && edgeForContextMenu && (
        <div
          className="edge-context-menu"
          role="menu"
          aria-label="Connection actions"
          style={{
            left: `${getEdgeContextMenuPosition(edgeContextMenu.screenPosition, hostOrigin).left}px`,
            top: `${getEdgeContextMenuPosition(edgeContextMenu.screenPosition, hostOrigin).top}px`,
          }}
          onContextMenu={(event) => event.preventDefault()}
        >
          <button
            type="button"
            role="menuitem"
            className="edge-context-menu-item"
            onClick={() => {
              labelEditor.openAt(edgeForContextMenu.id, screenToWorld(edgeContextMenu.screenPosition, viewport))
              onCloseEdgeContextMenu()
            }}
          >
            Label
          </button>
          <div className="edge-context-menu-colors" aria-label="Connection color">
            {EDGE_COLOR_SWATCHES.map((swatch) => {
              const selectedColor = normalizeEdgeColor(edgeForContextMenu.data?.color)
              return (
                <button
                  key={swatch.value}
                  type="button"
                  role="menuitem"
                  className="edge-color-swatch"
                  aria-label={`Set connection color ${swatch.name}`}
                  aria-pressed={selectedColor === swatch.value}
                  title={swatch.name}
                  style={edgeSwatchStyle(swatch.value)}
                  onClick={() => onUpdateEdgeColor(edgeForContextMenu.id, swatch.value)}
                />
              )
            })}
          </div>
          <button
            type="button"
            role="menuitem"
            className="edge-context-menu-item edge-context-menu-danger"
            onClick={() => {
              onEdgeClick(edgeForContextMenu.id, false)
              removeSelected()
              onCloseEdgeContextMenu()
            }}
          >
            Delete connector
          </button>
        </div>
      )}

      {labelEditor.openEdgeId && labelEditor.anchor && (() => {
        const screenX = labelEditor.anchor.x * viewport.zoom + viewport.x
        const screenY = labelEditor.anchor.y * viewport.zoom + viewport.y
        const initialLabel = edgeForLabelEditor?.data?.label ?? ''
        return (
          <input
            key={labelEditor.openEdgeId}
            className="edge-label-editor"
            type="text"
            defaultValue={initialLabel}
            autoFocus
            style={{
              left: `${screenX + hostOrigin.left}px`,
              top: `${screenY + hostOrigin.top}px`,
            }}
            onKeyDown={(event: ReactKeyboardEvent<HTMLInputElement>) => {
              if (event.key === 'Enter') {
                labelEditor.commit(event.currentTarget.value)
              } else if (event.key === 'Escape') {
                labelEditor.cancel()
              }
            }}
            onBlur={(event) => {
              const value = event.currentTarget.value
              if (value === initialLabel) {
                labelEditor.cancel()
              } else {
                labelEditor.commit(value)
              }
            }}
            aria-label="Edit connection label"
          />
        )
      })()}

      <ul className="sr-only" aria-label="Connections">
        {edges.map((edge) => {
          const labelText = edge.data?.label ? `, label: ${edge.data.label}` : ', no label'
          return (
            <li key={edge.id}>
              <button
                type="button"
                data-edge-id={edge.id}
                onClick={() => {
                  onEdgeClick(edge.id, false)
                }}
                onContextMenu={(event) => {
                  event.preventDefault()
                  onOpenEdgeContextMenu(edge.id, {
                    x: event.clientX - hostOrigin.left,
                    y: event.clientY - hostOrigin.top,
                  })
                }}
                onKeyDown={(event: ReactKeyboardEvent<HTMLButtonElement>) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                  }
                  if (event.key === 'Enter') {
                    const sourceNode = nodesById.get(edge.source)
                    const targetNode = nodesById.get(edge.target)
                    if (!sourceNode || !targetNode) return
                    const center = getEdgeLabelCenter(
                      {
                        id: edge.id,
                        label: edge.data?.label ?? '',
                        sourceNodeId: edge.source,
                        sourcePortId: edge.sourceHandle ?? 'out',
                        sourceAnchor: edge.data?.sourceAnchor,
                        targetNodeId: edge.target,
                        targetPortId: edge.targetHandle ?? 'in',
                        targetAnchor: edge.data?.targetAnchor,
                        fromRole: edge.data?.fromRole,
                        toRole: edge.data?.toRole,
                        artifact: edge.data?.artifact,
                        expectation: edge.data?.expectation,
                        readinessSignal: edge.data?.readinessSignal,
                      },
                      nodesById,
                    )
                    if (!center) return
                    onEdgeClick(edge.id, false)
                    labelEditor.openAt(edge.id, center)
                  }
                }}
                aria-label={`Connection from ${edge.source} to ${edge.target}${labelText}`}
              >
                Edit label for connection {edge.source} → {edge.target}
              </button>
            </li>
          )
        })}
      </ul>

      <ul className="sr-only" aria-label="Nodes">
        {nodes.map((node) => {
          const finalLabel = (() => {
            const kind = node.data.kind
            switch (kind) {
              case 'start':
              case 'end':
                return node.data.label || node.id
              default:
                return node.data.title || node.id
            }
          })()
          const nodeKind =
            node.data.kind === 'activity'
              ? 'activity'
              : node.data.kind === 'decision'
                ? 'decision'
                : node.data.kind === 'stage'
                  ? 'stage'
                  : node.data.kind === 'bottleneck'
                    ? 'bottleneck'
                    : node.data.kind
          return (
            <li key={node.id}>
              <button
                type="button"
                data-node-id={node.id}
                data-node-kind={nodeKind}
                onFocus={() => {
                  onNodeClick(node.id, false)
                }}
                onClick={() => {
                  onNodeClick(node.id, false)
                }}
                onKeyDown={(event: ReactKeyboardEvent<HTMLButtonElement>) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                  }
                  if (event.key === 'Enter') {
                    onNodeClick(node.id, false)
                    openEditor(node.id)
                  } else if (event.key === 'Delete' || event.key === 'Backspace') {
                    event.preventDefault()
                    removeSelected()
                  }
                }}
                aria-label={finalLabel}
              >
                ·
              </button>
            </li>
          )
        })}
      </ul>
    </>
  )
}
