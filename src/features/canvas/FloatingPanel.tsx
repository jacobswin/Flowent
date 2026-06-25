import { useEffect, useRef, useState } from 'react'
import type { ReactNode, PointerEvent as ReactPointerEvent } from 'react'

type FloatingPanelTag = 'section' | 'aside'

interface FloatingPanelProps {
  as?: FloatingPanelTag
  ariaLabel: string
  className: string
  storageKey: string
  title: string
  subtitle?: string
  badge?: ReactNode
  width: number
  defaultPlacement: { top: number; right: number }
  children: ReactNode
}

type FloatingPanelStoredState = {
  x: number
  y: number
  collapsed: boolean
}

type FloatingPanelPosition = {
  x: number
  y: number
}

const VIEWPORT_PADDING = 12
const COLLAPSED_WIDTH = 196
const MIN_VISIBLE_PANEL_HEIGHT = 44

function getViewportSize(): { width: number; height: number } {
  if (typeof window === 'undefined') return { width: 1280, height: 720 }
  return {
    width: window.innerWidth || 1280,
    height: window.innerHeight || 720,
  }
}

function getDefaultPosition(width: number, defaultPlacement: { top: number; right: number }): FloatingPanelPosition {
  const viewport = getViewportSize()
  return clampPosition({
    x: viewport.width - width - defaultPlacement.right,
    y: defaultPlacement.top,
  }, width)
}

function clampPosition(position: FloatingPanelPosition, width: number): FloatingPanelPosition {
  const viewport = getViewportSize()
  const maxX = Math.max(VIEWPORT_PADDING, viewport.width - width - VIEWPORT_PADDING)
  const maxY = Math.max(VIEWPORT_PADDING, viewport.height - MIN_VISIBLE_PANEL_HEIGHT - VIEWPORT_PADDING)

  return {
    x: Math.min(Math.max(VIEWPORT_PADDING, position.x), maxX),
    y: Math.min(Math.max(VIEWPORT_PADDING, position.y), maxY),
  }
}

function readStoredPanelState(storageKey: string): FloatingPanelStoredState | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(storageKey)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<FloatingPanelStoredState>
    if (typeof parsed.x !== 'number' || typeof parsed.y !== 'number' || typeof parsed.collapsed !== 'boolean') {
      return null
    }
    return { x: parsed.x, y: parsed.y, collapsed: parsed.collapsed }
  } catch {
    return null
  }
}

function writeStoredPanelState(storageKey: string, state: FloatingPanelStoredState): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(state))
  } catch {
    // Losing panel placement is harmless; keep the canvas usable.
  }
}

export function FloatingPanel({
  as = 'section',
  ariaLabel,
  className,
  storageKey,
  title,
  subtitle,
  badge,
  width,
  defaultPlacement,
  children,
}: FloatingPanelProps) {
  const storedState = readStoredPanelState(storageKey)
  const [collapsed, setCollapsed] = useState(storedState?.collapsed ?? false)
  const [position, setPosition] = useState<FloatingPanelPosition>(() => {
    const panelWidth = storedState?.collapsed ? COLLAPSED_WIDTH : width
    return storedState
      ? clampPosition({ x: storedState.x, y: storedState.y }, panelWidth)
      : getDefaultPosition(width, defaultPlacement)
  })
  const [dragging, setDragging] = useState(false)
  const dragRef = useRef<{
    startClientX: number
    startClientY: number
    startPosition: FloatingPanelPosition
  } | null>(null)

  const panelWidth = collapsed ? COLLAPSED_WIDTH : width
  const PanelTag = as

  useEffect(() => {
    writeStoredPanelState(storageKey, { x: position.x, y: position.y, collapsed })
  }, [collapsed, position, storageKey])

  const toggleCollapsed = () => {
    const nextCollapsed = !collapsed
    setCollapsed(nextCollapsed)
    setPosition((current) => clampPosition(current, nextCollapsed ? COLLAPSED_WIDTH : width))
  }

  const startDrag = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0) return
    const target = event.target
    if (target instanceof HTMLElement && target.closest('button, input, textarea, select, a')) {
      return
    }

    event.preventDefault()
    dragRef.current = {
      startClientX: event.clientX,
      startClientY: event.clientY,
      startPosition: position,
    }
    setDragging(true)
    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      // Pointer capture is not available in every test/browser surface.
    }
  }

  const updateDrag = (event: ReactPointerEvent<HTMLElement>) => {
    if (!dragRef.current) return

    const dx = event.clientX - dragRef.current.startClientX
    const dy = event.clientY - dragRef.current.startClientY
    setPosition(clampPosition({
      x: dragRef.current.startPosition.x + dx,
      y: dragRef.current.startPosition.y + dy,
    }, panelWidth))
  }

  const endDrag = (event: ReactPointerEvent<HTMLElement>) => {
    if (!dragRef.current) return
    dragRef.current = null
    setDragging(false)
    try {
      event.currentTarget.releasePointerCapture(event.pointerId)
    } catch {
      // Ignore release errors from environments without pointer capture.
    }
  }

  return (
    <PanelTag
      className={`floating-panel ${className}${collapsed ? ' floating-panel-collapsed' : ''}${dragging ? ' floating-panel-dragging' : ''}`}
      aria-label={ariaLabel}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: `${panelWidth}px`,
      }}
    >
      <div
        className="floating-panel-header"
        onPointerDown={startDrag}
        onPointerMove={updateDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <div className="floating-panel-title-block">
          <span className="floating-panel-title">{title}</span>
          {!collapsed && subtitle && <span className="floating-panel-subtitle">{subtitle}</span>}
        </div>
        <div className="floating-panel-actions">
          {badge && <span className="floating-panel-badge">{badge}</span>}
          <button
            type="button"
            className="floating-panel-collapse"
            aria-label={`${collapsed ? 'Expand' : 'Collapse'} ${title}`}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={toggleCollapsed}
          >
            <span aria-hidden="true">{collapsed ? '+' : '-'}</span>
          </button>
        </div>
      </div>

      {!collapsed && <div className="floating-panel-body">{children}</div>}
    </PanelTag>
  )
}
