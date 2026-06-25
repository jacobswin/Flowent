import type { useCanvasState } from './useCanvasState'

interface ToolbarProps {
  onToggleConnector: ReturnType<typeof useCanvasState>['toggleConnectorMode']
  onRemove: ReturnType<typeof useCanvasState>['removeSelected']
  onAutoLayout: () => void
  onUndo: () => void
  onRedo: () => void
  onExport: () => void
  canUndo: boolean
  canRedo: boolean
  hasSelection: boolean
  connectorMode: boolean
}

export function Toolbar({
  onToggleConnector,
  onRemove,
  onAutoLayout,
  onUndo,
  onRedo,
  onExport,
  canUndo,
  canRedo,
  hasSelection,
  connectorMode,
}: ToolbarProps) {
  return (
    <div className="canvas-toolbar" role="toolbar" aria-label="Canvas tools">
      <button
        type="button"
        className={`toolbar-button ${connectorMode ? 'active' : ''}`}
        onClick={onToggleConnector}
        title="Connect: click two nodes or ports (C)"
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <circle cx="4" cy="9" r="2" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="14" cy="9" r="2" stroke="currentColor" strokeWidth="1.5" />
          <line x1="6" y1="9" x2="12" y2="9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <span>Connect</span>
      </button>
      <div className="toolbar-divider" />
      <button
        type="button"
        className="toolbar-button"
        onClick={onAutoLayout}
        title="Auto layout (L)"
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <path d="M3 3v12h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M7 7v4h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span>Layout</span>
      </button>
      <div className="toolbar-divider" />
      <button
        type="button"
        className="toolbar-button"
        onClick={onUndo}
        disabled={!canUndo}
        title="Undo"
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <path d="M4 7h7a4 4 0 110 8H9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M7 4L4 7l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <button
        type="button"
        className="toolbar-button"
        onClick={onRedo}
        disabled={!canRedo}
        title="Redo"
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <path d="M14 7H7a4 4 0 100 8h2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M11 4l3 3-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <div className="toolbar-divider" />
      <button
        type="button"
        className="toolbar-button"
        onClick={onExport}
        title="Export as SVG"
        aria-label="Export map as SVG"
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <path d="M9 2v9M9 11l-3-3M9 11l3-3M3 13h12v3H3z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span>Export</span>
      </button>
      {hasSelection && (
        <>
          <div className="toolbar-divider" />
          <button
            type="button"
            className="toolbar-button danger"
            onClick={onRemove}
            title="Delete selected"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M4 5h10M7 5V4a1 1 0 011-1h2a1 1 0 011 1v1M6 8v5M10 8v5M5 5l1 10a1 1 0 001 1h4a1 1 0 001-1l1-10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>Delete</span>
          </button>
        </>
      )}
    </div>
  )
}
