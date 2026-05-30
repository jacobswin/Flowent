import { BaseEdge, getBezierPath, type EdgeProps } from '@xyflow/react'

export function HandoffEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
}: EdgeProps & { data?: { label?: string } }) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  })

  return (
    <>
      <BaseEdge id={id} path={edgePath} className={`handoff-edge${selected ? ' selected' : ''}`} />
      {data?.label && (
        <foreignObject
          x={labelX - 60}
          y={labelY - 12}
          width={120}
          height={24}
          className="edge-label-container"
        >
          <div className="edge-label">{data.label}</div>
        </foreignObject>
      )}
    </>
  )
}
