export type KeyEventLike = {
  key: string
  metaKey: boolean
  ctrlKey: boolean
  shiftKey: boolean
}

export type CanvasAction =
  | 'tool-activity'
  | 'tool-decision'
  | 'tool-start-end'
  | 'tool-connector'
  | 'tool-select'
  | 'auto-layout'
  | 'undo'
  | 'redo'
  | 'delete'
  | 'zoom-in'
  | 'zoom-out'
  | 'zoom-reset'
  | null

export function mapKeyToAction(event: KeyEventLike): CanvasAction {
  const key = event.key.toLowerCase()
  const hasMeta = event.metaKey || event.ctrlKey

  if (hasMeta && key === 'z' && event.shiftKey) {
    return 'redo'
  }

  if (hasMeta && key === 'z') {
    return 'undo'
  }

  if (event.ctrlKey && key === 'y') {
    return 'redo'
  }

  if (!hasMeta && key === 'a') {
    return 'tool-activity'
  }

  if (!hasMeta && key === 'd') {
    return 'tool-decision'
  }

  if (!hasMeta && key === 's') {
    return 'tool-start-end'
  }

  if (!hasMeta && key === 'c') {
    return 'tool-connector'
  }

  if (!hasMeta && key === 'v') {
    return 'tool-select'
  }

  if (!hasMeta && key === 'l') {
    return 'auto-layout'
  }

  if (!hasMeta && (key === 'delete' || key === 'backspace')) {
    return 'delete'
  }

  if (!hasMeta && (key === '+' || key === '=')) {
    return 'zoom-in'
  }

  if (!hasMeta && key === '-') {
    return 'zoom-out'
  }

  if (!hasMeta && key === '0') {
    return 'zoom-reset'
  }

  return null
}
