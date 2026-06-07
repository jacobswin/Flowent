import { useCallback, useState } from 'react'

export interface EdgeLabelAnchor {
  x: number
  y: number
}

interface EdgeLabelEditorApi {
  openEdgeId: string | null
  anchor: EdgeLabelAnchor | null
  openAt: (edgeId: string, anchor: EdgeLabelAnchor) => void
  commit: (value: string) => void
  cancel: () => void
}

export function useEdgeLabelEditor(
  onCommit?: (edgeId: string, value: string) => void,
): EdgeLabelEditorApi {
  const [openEdgeId, setOpenEdgeId] = useState<string | null>(null)
  const [anchor, setAnchor] = useState<EdgeLabelAnchor | null>(null)

  const openAt = useCallback((edgeId: string, anchorPosition: EdgeLabelAnchor) => {
    setOpenEdgeId(edgeId)
    setAnchor(anchorPosition)
  }, [])

  const commit = useCallback(
    (value: string) => {
      if (!openEdgeId) return
      onCommit?.(openEdgeId, value)
      setOpenEdgeId(null)
      setAnchor(null)
    },
    [openEdgeId, onCommit],
  )

  const cancel = useCallback(() => {
    setOpenEdgeId(null)
    setAnchor(null)
  }, [])

  return { openEdgeId, anchor, openAt, commit, cancel }
}
