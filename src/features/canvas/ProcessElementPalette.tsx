import { PROCESS_ELEMENTS, type ProcessElementType } from './processElements'
import { TopDockPanel } from './TopDockPanel'

interface ProcessElementPaletteProps {
  onQuickCreate: (type: ProcessElementType) => void
  defaultCollapsed?: boolean
}

const DRAG_MIME_TYPE = 'application/x-flowent-process-element'

export function ProcessElementPalette({ onQuickCreate, defaultCollapsed = true }: ProcessElementPaletteProps) {
  return (
    <TopDockPanel
      className="process-element-palette"
      ariaLabel="Process element library"
      storageKey="flowent:top-dock:process-elements:collapsed"
      title="Elements"
      subtitle="Click to quick-create · drag to place"
      width={260}
      collapsedWidth={220}
      defaultCollapsed={defaultCollapsed}
    >
      <div className="process-element-list">
        {PROCESS_ELEMENTS.map((element) => (
          <button
            key={element.type}
            type="button"
            className={`process-element-button process-element-${element.type}`}
            draggable
            onClick={() => onQuickCreate(element.type)}
            onDragStart={(event) => {
              event.dataTransfer.effectAllowed = 'copy'
              event.dataTransfer.setData(DRAG_MIME_TYPE, element.type)
            }}
            aria-label={`${element.label}: ${element.description}`}
            title={element.description}
          >
            <span className="process-element-icon" aria-hidden="true">
              {getElementGlyph(element.type)}
            </span>
            <span className="process-element-copy">
              <span className="process-element-label">{element.label}</span>
              <span className="process-element-description">{element.description}</span>
            </span>
            {element.shortcut && <kbd>{element.shortcut}</kbd>}
          </button>
        ))}
      </div>
    </TopDockPanel>
  )
}

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

function getElementGlyph(type: ProcessElementType): string {
  switch (type) {
    case 'stage':
      return '▦'
    case 'activity':
      return '▭'
    case 'decision':
      return '◇'
    case 'bottleneck':
      return '⚠'
    case 'end':
      return '●'
  }
}
