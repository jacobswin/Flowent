import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'

type TopDockPanelTag = 'section' | 'aside'

interface TopDockPanelProps {
  as?: TopDockPanelTag
  ariaLabel: string
  className?: string
  storageKey: string
  title: string
  subtitle?: string
  badge?: ReactNode
  width?: number
  collapsedWidth?: number
  defaultCollapsed?: boolean
  children: ReactNode
}

function readStoredCollapsed(storageKey: string): boolean | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(storageKey)
    if (raw === null) return null
    return raw === 'true'
  } catch {
    return null
  }
}

function writeStoredCollapsed(storageKey: string, collapsed: boolean): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(storageKey, String(collapsed))
  } catch {
    // Losing collapsed state is harmless; the panel remains usable.
  }
}

export function TopDockPanel({
  as = 'section',
  ariaLabel,
  className = '',
  storageKey,
  title,
  subtitle,
  badge,
  width = 260,
  collapsedWidth = 196,
  defaultCollapsed = true,
  children,
}: TopDockPanelProps) {
  const [collapsed, setCollapsed] = useState(() => readStoredCollapsed(storageKey) ?? defaultCollapsed)
  const PanelTag = as

  useEffect(() => {
    writeStoredCollapsed(storageKey, collapsed)
  }, [collapsed, storageKey])

  return (
    <PanelTag
      className={`top-dock-panel ${className}${collapsed ? ' top-dock-panel-collapsed' : ''}`}
      aria-label={ariaLabel}
      style={{
        '--top-dock-width': `${width}px`,
        '--top-dock-collapsed-width': `${collapsedWidth}px`,
      } as CSSProperties}
    >
      <div className="top-dock-panel-header">
        <div className="top-dock-panel-title-block">
          <span className="top-dock-panel-title">{title}</span>
          {!collapsed && subtitle && <span className="top-dock-panel-subtitle">{subtitle}</span>}
        </div>
        <div className="top-dock-panel-actions">
          {badge && <span className="top-dock-panel-badge">{badge}</span>}
          <button
            type="button"
            className="top-dock-panel-toggle"
            aria-expanded={!collapsed}
            aria-label={`${collapsed ? 'Expand' : 'Collapse'} ${title}`}
            onClick={() => setCollapsed((current) => !current)}
          >
            <span aria-hidden="true">{collapsed ? '+' : '-'}</span>
          </button>
        </div>
      </div>
      {!collapsed && <div className="top-dock-panel-body">{children}</div>}
    </PanelTag>
  )
}
