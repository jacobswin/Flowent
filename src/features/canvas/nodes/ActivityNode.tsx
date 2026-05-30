import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { ActivityNodeData } from '../canvasTypes'

export function ActivityNode({ data, selected }: NodeProps & { data: ActivityNodeData }) {
  return (
    <div className={`canvas-node activity-node${selected ? ' selected' : ''}`}>
      <Handle type="target" position={Position.Top} className="canvas-handle" />
      <div className="node-label">Activity</div>
      <div className="node-title">{data.title}</div>
      {data.summary && <div className="node-summary">{data.summary}</div>}
      <Handle type="source" position={Position.Bottom} className="canvas-handle" />
    </div>
  )
}
