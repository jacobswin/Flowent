import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { StartEndNodeData } from '../canvasTypes'

export function StartEndNode({ data, selected }: NodeProps & { data: StartEndNodeData }) {
  const isStart = data.kind === 'start'

  return (
    <div className={`canvas-node start-end-node ${data.kind}${selected ? ' selected' : ''}`}>
      {!isStart && <Handle type="target" position={Position.Top} className="canvas-handle" />}
      <div className="node-label">{data.label}</div>
      {isStart && <Handle type="source" position={Position.Bottom} className="canvas-handle" />}
    </div>
  )
}
