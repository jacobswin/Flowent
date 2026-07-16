import { useMemo } from 'react'
import type { GraphEdge, GraphNode, ProcessEdge, ProcessNode } from './canvasTypes'
import { toGraphNode } from './nodeProjection'

interface UseCanvasGraphModelArgs {
  nodes: ProcessNode[]
  edges: ProcessEdge[]
}

export interface CanvasGraphModel {
  graphNodes: GraphNode[]
  graphEdges: GraphEdge[]
  nodesById: Map<string, GraphNode>
}

export function useCanvasGraphModel(args: UseCanvasGraphModelArgs): CanvasGraphModel {
  const { nodes, edges } = args

  const graphNodes = useMemo(
    () => nodes.map(toGraphNode),
    [nodes],
  )

  const graphEdges = useMemo(
    () =>
      edges
        .filter((edge) => edge.source && edge.target)
        .map((edge) => ({
          id: edge.id,
          sourceNodeId: edge.source,
          sourcePortId: edge.sourceHandle ?? 'out',
          sourceAnchor: edge.data?.sourceAnchor,
          targetNodeId: edge.target,
          targetPortId: edge.targetHandle ?? 'in',
          targetAnchor: edge.data?.targetAnchor,
          label: edge.data?.label ?? '',
          color: edge.data?.color,
          fromRole: edge.data?.fromRole ?? '',
          toRole: edge.data?.toRole ?? '',
          artifact: edge.data?.artifact ?? '',
          readinessSignal: edge.data?.readinessSignal ?? '',
          expectation: edge.data?.expectation ?? '',
          reviewStatus: edge.data?.reviewStatus,
          workProductIds: edge.data?.workProductIds ?? [],
          assetSummary: edge.data?.assetSummary,
        })),
    [edges],
  )

  const nodesById = useMemo(() => {
    const map = new Map<string, GraphNode>()
    for (const node of graphNodes) {
      map.set(node.id, node)
    }
    return map
  }, [graphNodes])

  return {
    graphNodes,
    graphEdges,
    nodesById,
  }
}
