import { useEffect, useId, useRef, useState } from 'react'
import { ArrowRight, Download, FileCode2, FileImage, FileText, Rows3, Sparkles } from 'lucide-react'
import type { useCanvasState } from './useCanvasState'
import type { ProcessMapExportFormat } from './export/processMapExporter'

const ZOOM_PRESETS = [25, 50, 75, 100, 125, 150, 175, 200]
const MIN_ZOOM_PERCENT = 5
const MAX_ZOOM_PERCENT = 500

function clampZoomPercent(value: number): number {
  if (!Number.isFinite(value)) return 100
  return Math.min(Math.max(Math.round(value), MIN_ZOOM_PERCENT), MAX_ZOOM_PERCENT)
}

interface ToolbarProps {
  onRemove: ReturnType<typeof useCanvasState>['removeSelected']
  onApplyFlowLayout: () => void
  onApplySwimlaneLayout: () => void
  onUndo: () => void
  onRedo: () => void
  onExport: (format: ProcessMapExportFormat) => void
  onZoomIn: () => void
  onZoomOut: () => void
  onZoomReset: () => void
  onZoomSet: (percent: number) => void
  onOpenAiGenerate: () => void
  canUndo: boolean
  canRedo: boolean
  hasSelection: boolean
  zoomPercent: number
}

export function Toolbar({
  onRemove,
  onApplyFlowLayout,
  onApplySwimlaneLayout,
  onUndo,
  onRedo,
  onExport,
  onZoomIn,
  onZoomOut,
  onZoomReset,
  onZoomSet,
  onOpenAiGenerate,
  canUndo,
  canRedo,
  hasSelection,
  zoomPercent,
}: ToolbarProps) {
  const zoomMenuId = useId()
  const zoomMenuRef = useRef<HTMLDivElement | null>(null)
  const exportMenuId = useId()
  const exportMenuRef = useRef<HTMLDivElement | null>(null)
  const [zoomMenuOpen, setZoomMenuOpen] = useState(false)
  const [exportMenuOpen, setExportMenuOpen] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const [customZoom, setCustomZoom] = useState(String(zoomPercent))

  useEffect(() => {
    if (!zoomMenuOpen && !exportMenuOpen) return
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (
        zoomMenuRef.current?.contains(event.target as Node) ||
        exportMenuRef.current?.contains(event.target as Node)
      ) return
      setZoomMenuOpen(false)
      setExportMenuOpen(false)
    }
    document.addEventListener('pointerdown', closeOnOutsidePointer)
    return () => document.removeEventListener('pointerdown', closeOnOutsidePointer)
  }, [zoomMenuOpen, exportMenuOpen])

  useEffect(() => {
    if (!zoomMenuOpen && !exportMenuOpen) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setZoomMenuOpen(false)
      setExportMenuOpen(false)
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [zoomMenuOpen, exportMenuOpen])

  const applyZoomPercent = (percent: number) => {
    const nextPercent = clampZoomPercent(percent)
    onZoomSet(nextPercent)
    setCustomZoom(String(nextPercent))
    setZoomMenuOpen(false)
  }

  const applyCustomZoom = () => {
    const parsed = Number.parseFloat(customZoom)
    if (!Number.isFinite(parsed)) return
    applyZoomPercent(parsed)
  }

  const toggleZoomMenu = () => {
    if (!zoomMenuOpen) setCustomZoom(String(zoomPercent))
    setExportMenuOpen(false)
    setZoomMenuOpen((current) => !current)
  }

  const selectExportFormat = async (format: ProcessMapExportFormat) => {
    setExportMenuOpen(false)
    setExportError(null)
    try {
      await onExport(format)
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'Flowent could not export this map.')
    }
  }

  return (
    <div className="canvas-toolbar" role="toolbar" aria-label="Canvas tools">
      <button
        type="button"
        className="toolbar-button toolbar-layout-button"
        onClick={onApplyFlowLayout}
        title="Flow layout (L)"
        aria-label="Flow layout"
      >
        <ArrowRight size={18} strokeWidth={1.8} aria-hidden="true" />
        <span className="toolbar-button-label">Flow</span>
      </button>
      <button
        type="button"
        className="toolbar-button toolbar-layout-button"
        onClick={onApplySwimlaneLayout}
        title="Swimlane layout"
        aria-label="Swimlane layout"
      >
        <Rows3 size={18} strokeWidth={1.8} aria-hidden="true" />
        <span className="toolbar-button-label">Swimlane</span>
      </button>
      <div className="toolbar-divider" />
      <button
        type="button"
        className="toolbar-button"
        onClick={onOpenAiGenerate}
        title="Generate with AI"
        aria-label="Generate with AI"
      >
        <Sparkles size={18} strokeWidth={1.8} aria-hidden="true" />
        <span className="toolbar-button-label">AI</span>
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
      <div ref={exportMenuRef} className="toolbar-export">
        <button
          type="button"
          className="toolbar-button"
          onClick={() => {
            setZoomMenuOpen(false)
            setExportError(null)
            setExportMenuOpen((current) => !current)
          }}
          title="Export map"
          aria-label="Export map"
          aria-haspopup="menu"
          aria-expanded={exportMenuOpen}
          aria-controls={exportMenuOpen ? exportMenuId : undefined}
        >
          <Download size={18} strokeWidth={1.8} aria-hidden="true" />
          <span className="toolbar-button-label">Export</span>
        </button>
        {exportMenuOpen && (
          <div className="toolbar-export-menu" role="menu" id={exportMenuId} aria-label="Export format">
            <button type="button" role="menuitem" onClick={() => selectExportFormat('svg')}><FileCode2 size={15} aria-hidden="true" />SVG</button>
            <button type="button" role="menuitem" onClick={() => selectExportFormat('pdf')}><FileText size={15} aria-hidden="true" />PDF</button>
            <button type="button" role="menuitem" onClick={() => selectExportFormat('png')}><FileImage size={15} aria-hidden="true" />PNG</button>
            <button type="button" role="menuitem" onClick={() => selectExportFormat('jpg')}><FileImage size={15} aria-hidden="true" />JPG</button>
            <button type="button" role="menuitem" onClick={() => selectExportFormat('json')}><FileCode2 size={15} aria-hidden="true" />Flowent JSON</button>
          </div>
        )}
        {exportError && <p className="toolbar-export-error" role="alert">{exportError}</p>}
      </div>
      <div className="toolbar-divider" />
      <div className="toolbar-zoom" aria-label="Zoom controls">
        <button type="button" className="toolbar-button toolbar-icon-button" onClick={onZoomOut} title="Zoom out" aria-label="Zoom out">
          -
        </button>
        <button
          type="button"
          className="toolbar-zoom-reset"
          onClick={toggleZoomMenu}
          onDoubleClick={onZoomReset}
          title="Choose zoom level"
          aria-label={`Zoom level ${zoomPercent}%`}
          aria-haspopup="menu"
          aria-expanded={zoomMenuOpen}
          aria-controls={zoomMenuOpen ? zoomMenuId : undefined}
        >
          {zoomPercent}%
        </button>
        {zoomMenuOpen && (
          <div ref={zoomMenuRef} className="toolbar-zoom-menu" role="menu" id={zoomMenuId} aria-label="Zoom level">
            <div className="toolbar-zoom-presets">
              {ZOOM_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  role="menuitem"
                  className={preset === zoomPercent ? 'active' : undefined}
                  onClick={() => applyZoomPercent(preset)}
                >
                  {preset}%
                </button>
              ))}
            </div>
            <form
              className="toolbar-zoom-custom"
              onSubmit={(event) => {
                event.preventDefault()
                applyCustomZoom()
              }}
            >
              <label htmlFor={`${zoomMenuId}-custom`}>Custom</label>
              <div className="toolbar-zoom-custom-row">
                <input
                  id={`${zoomMenuId}-custom`}
                  type="number"
                  min={MIN_ZOOM_PERCENT}
                  max={MAX_ZOOM_PERCENT}
                  step={1}
                  value={customZoom}
                  aria-label="Custom zoom percentage"
                  onChange={(event) => setCustomZoom(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Escape') setZoomMenuOpen(false)
                  }}
                />
                <span aria-hidden="true">%</span>
                <button type="button" aria-label="Apply custom zoom" onClick={applyCustomZoom}>Apply</button>
              </div>
            </form>
          </div>
        )}
        <button type="button" className="toolbar-button toolbar-icon-button" onClick={onZoomIn} title="Zoom in" aria-label="Zoom in">
          +
        </button>
      </div>
      {hasSelection && (
        <>
          <div className="toolbar-divider" />
          <button
            type="button"
            className="toolbar-button danger"
            onClick={onRemove}
            title="Delete selected"
            aria-label="Delete selected"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M4 5h10M7 5V4a1 1 0 011-1h2a1 1 0 011 1v1M6 8v5M10 8v5M5 5l1 10a1 1 0 001 1h4a1 1 0 001-1l1-10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="toolbar-button-label">Delete</span>
          </button>
        </>
      )}
    </div>
  )
}
