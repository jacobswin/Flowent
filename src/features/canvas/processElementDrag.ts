import type { ProcessElementType } from './processElements'

export const DRAG_MIME_TYPE = 'application/x-flowent-process-element'

export function hasDraggedProcessElement(dataTransfer: DataTransfer): boolean {
  return Array.from(dataTransfer.types).includes(DRAG_MIME_TYPE)
}

export function readDraggedProcessElement(dataTransfer: DataTransfer): ProcessElementType | null {
  const raw = dataTransfer.getData(DRAG_MIME_TYPE)
  if (raw === 'stage' || raw === 'activity' || raw === 'decision' || raw === 'bottleneck' || raw === 'end') {
    return raw
  }
  return null
}
