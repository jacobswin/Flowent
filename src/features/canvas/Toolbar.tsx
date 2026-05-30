import type { useCanvasState } from './useCanvasState'

interface ToolbarProps {
  onAddActivity: ReturnType<typeof useCanvasState>['addActivity']
  onAddDecision: ReturnType<typeof useCanvasState>['addDecision']
  onAddEnd: ReturnType<typeof useCanvasState>['addEnd']
  onRemove: ReturnType<typeof useCanvasState>['removeSelected']
  onAutoLayout: () => void
  hasSelection: boolean
}

export function Toolbar({ onAddActivity, onAddDecision, onAddEnd, onRemove, onAutoLayout, hasSelection }: ToolbarProps) {
  return (
    <div className="canvas-toolbar" role="toolbar" aria-label="Canvas tools">
      <button
        type="button"
        className="toolbar-button"
        onClick={() => onAddActivity()}
        title="Add activity"
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <rect x="2" y="4" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.5" />
          <line x1="9" y1="7" x2="9" y2="11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="7" y1="9" x2="11" y2="9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <span>Activity</span>
      </button>
      <button
        type="button"
        className="toolbar-button"
        onClick={() => onAddDecision()}
        title="Add decision"
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <path d="M9 2L16 9L9 16L2 9Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
          <line x1="9" y1="7" x2="9" y2="11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="7" y1="9" x2="11" y2="9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <span>Decision</span>
      </button>
      <button
        type="button"
        className="toolbar-button"
        onClick={() => onAddEnd()}
        title="Add end"
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.5" />
          <rect x="6" y="6" width="6" height="6" rx="1" fill="currentColor" />
        </svg>
        <span>End</span>
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
