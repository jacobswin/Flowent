import type { MutableRefObject } from 'react'
import type { EdgeEndpointAnchor, GraphDocument } from './canvasTypes'
import { getEdgeLabelCenter, getEdgeRoutePoints } from './render/edgeGeometry'

interface RegisterCanvasTestHooksArgs {
  canvasRef: MutableRefObject<{ document: GraphDocument; onConnect: (sourceId: string, targetId: string, sourcePortId?: string, targetPortId?: string, anchors?: { sourceAnchor?: EdgeEndpointAnchor; targetAnchor?: EdgeEndpointAnchor }) => void; selectNodesInRect: (x1: number, y1: number, x2: number, y2: number) => void }>
  getCanvas: () => { document: GraphDocument; onConnect: (sourceId: string, targetId: string, sourcePortId?: string, targetPortId?: string, anchors?: { sourceAnchor?: EdgeEndpointAnchor; targetAnchor?: EdgeEndpointAnchor }) => void; selectNodesInRect: (x1: number, y1: number, x2: number, y2: number) => void }
}

export function registerCanvasTestHooks({ canvasRef, getCanvas }: RegisterCanvasTestHooksArgs): void {
  ;(window as unknown as { __flowentGetEdge?: (id: string) => { id: string; label: string } | null }).__flowentGetEdge = (edgeId: string) => {
    const edges = Array.from(canvasRef.current.document.edges.values())
    const found = edges.find((candidate) => candidate.id === edgeId)
    return found ? { id: found.id, label: found.label ?? '' } : null
  }

  ;(window as unknown as {
    __flowentGetEdgeEndpoints?: (id: string) => {
      id: string
      sourceNodeId: string
      sourcePortId: string
      sourceAnchor?: EdgeEndpointAnchor
      targetNodeId: string
      targetPortId: string
      targetAnchor?: EdgeEndpointAnchor
    } | null
  }).__flowentGetEdgeEndpoints = (edgeId: string) => {
    const found = canvasRef.current.document.edges.get(edgeId)
    return found
      ? {
          id: found.id,
          sourceNodeId: found.sourceNodeId,
          sourcePortId: found.sourcePortId,
          sourceAnchor: found.sourceAnchor,
          targetNodeId: found.targetNodeId,
          targetPortId: found.targetPortId,
          targetAnchor: found.targetAnchor,
        }
      : null
  }

  ;(window as unknown as { __flowentRunMarquee?: (x1: number, y1: number, x2: number, y2: number) => void }).__flowentRunMarquee = (x1: number, y1: number, x2: number, y2: number) => {
    getCanvas().selectNodesInRect(x1, y1, x2, y2)
  }

  ;(window as unknown as { __flowentGetNodeTitle?: (id: string) => { id: string; title: string } | null }).__flowentGetNodeTitle = (nodeId: string) => {
    const node = canvasRef.current.document.nodes.get(nodeId)
    return node ? { id: node.id, title: node.title } : null
  }

  ;(window as unknown as { __flowentGetNodePosition?: (id: string) => { x: number; y: number } | null }).__flowentGetNodePosition = (nodeId: string) => {
    const found = canvasRef.current.document.nodes.get(nodeId)
    return found ? { x: found.x, y: found.y } : null
  }

  ;(window as unknown as {
    __flowentGetNodeBounds?: (id: string) => { x: number; y: number; width: number; height: number } | null
  }).__flowentGetNodeBounds = (nodeId: string) => {
    const found = canvasRef.current.document.nodes.get(nodeId)
    return found ? { x: found.x, y: found.y, width: found.width, height: found.height } : null
  }

  ;(window as unknown as { __flowentGetNodePositions?: () => Record<string, { x: number; y: number }> }).__flowentGetNodePositions = () => {
    const nodes = canvasRef.current.document.nodes
    const map: Record<string, { x: number; y: number }> = {}
    for (const [id, n] of nodes) {
      map[id] = { x: n.x, y: n.y }
    }
    return map
  }

  ;(window as unknown as { __flowentTestAddEdge?: (sourceId: string, targetId: string) => Promise<string | null> }).__flowentTestAddEdge = async (sourceId: string, targetId: string) => {
    const before = canvasRef.current.document
    if (!before.nodes.has(sourceId) || !before.nodes.has(targetId)) return null
    const beforeKeys = new Set(before.edges.keys())
    getCanvas().onConnect(sourceId, targetId, 'out', 'in')
    const deadline = Date.now() + 500
    while (Date.now() < deadline) {
      await new Promise((resolve) => requestAnimationFrame(() => resolve(null)))
      const after = canvasRef.current.document.edges
      for (const [id] of after) {
        if (!beforeKeys.has(id)) return id
      }
    }
    return null
  }

  ;(window as unknown as { __flowentGetEdgeRoutes?: () => Record<string, { x: number; y: number }[]> }).__flowentGetEdgeRoutes = () => {
    const doc = canvasRef.current.document
    const map: Record<string, { x: number; y: number }[]> = {}
    for (const edge of doc.edges.values()) {
      map[edge.id] = getEdgeRoutePoints(edge, doc.nodes) ?? []
    }
    return map
  }

  ;(window as unknown as { __flowentGetViewport?: () => { x: number; y: number; zoom: number } | null }).__flowentGetViewport = () => {
    const v = canvasRef.current.document.viewport
    return { x: v.x, y: v.y, zoom: v.zoom }
  }

  ;(window as unknown as { __flowentGetEdgeLabelCenter?: (id: string) => { x: number; y: number } | null }).__flowentGetEdgeLabelCenter = (edgeId: string) => {
    const doc = canvasRef.current.document
    const edge = doc.edges.get(edgeId)
    if (!edge) return null
    return getEdgeLabelCenter(edge, doc.nodes)
  }
}
