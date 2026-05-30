import type { Node, Edge } from '@xyflow/react'

export type PortSide = 'top' | 'right' | 'bottom' | 'left'

export type GraphPort = {
  id: string
  side: PortSide
}

export type GraphNodeType = 'activity' | 'decision' | 'start' | 'end'

export type GraphNode = {
  id: string
  type: GraphNodeType
  x: number
  y: number
  width: number
  height: number
  title: string
  summary?: string
  criteria?: string
  roleTags: string[]
  ports: GraphPort[]
}

export type GraphEdge = {
  id: string
  sourceNodeId: string
  sourcePortId: string
  targetNodeId: string
  targetPortId: string
  label: string
}

export type GraphViewport = {
  x: number
  y: number
  zoom: number
}

export type GraphDocument = {
  id: string
  nodes: Map<string, GraphNode>
  edges: Map<string, GraphEdge>
  selectedNodeIds: Set<string>
  selectedEdgeIds: Set<string>
  viewport: GraphViewport
  meta: {
    dirty: boolean
    version: number
  }
}

export type GraphCommand =
  | { type: 'AddNode'; payload: GraphNode }
  | { type: 'AddEdge'; payload: GraphEdge }
  | {
      type: 'UpdateNode'
      payload: {
        id: string
        patch: Partial<Pick<GraphNode, 'title' | 'summary' | 'criteria' | 'roleTags' | 'x' | 'y'>>
      }
    }
  | {
      type: 'SelectNode'
      payload: { id: string; additive: boolean }
    }
  | {
      type: 'MoveNodes'
      payload: { ids: string[]; dx: number; dy: number }
    }
  | {
      type: 'UpdateViewport'
      payload: Partial<GraphViewport>
    }

export type ActivityNodeData = {
  title: string
  summary: string
  roleIds: string[]
  kind: 'activity'
}

export type DecisionNodeData = {
  title: string
  criteria: string
  kind: 'decision'
}

export type StartEndNodeData = {
  label: string
  kind: 'start' | 'end'
}

export type ProcessNodeData = ActivityNodeData | DecisionNodeData | StartEndNodeData

export type ProcessNode = Node<ProcessNodeData>
export type ProcessEdge = Edge<{ label?: string }>
