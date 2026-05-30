import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { DecisionNodeData } from '../canvasTypes'

export function DecisionNode({ data, selected }: NodeProps & { data: DecisionNodeData }) {
  return (
    <div className={`canvas-node decision-node${selected ? ' selected' : ''}`}>
      <Handle type="target" position={Position.Top} className="canvas-handle" />
      <div className="node-label">Decision</div>
      <div className="node-title">{data.title}</div>
      {data.criteria && <div className="node-criteria">{data.criteria}</div>}
      <Handle type="source" position={Position.Bottom} className="canvas-handle" id="yes" />
      <Handle type="source" position={Position.Right} className="canvas-handle" id="no" />
    </div>
  )
}
