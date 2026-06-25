import type { ProcessMapDiagnostic } from './diagnostics/processMapDiagnostics'
import { FloatingPanel } from './FloatingPanel'

interface AlignmentChecklistProps {
  diagnostics: ProcessMapDiagnostic[]
  onSelectDiagnostic: (diagnostic: ProcessMapDiagnostic) => void
}

export function AlignmentChecklist({ diagnostics, onSelectDiagnostic }: AlignmentChecklistProps) {
  return (
    <FloatingPanel
      as="aside"
      className="alignment-checklist"
      ariaLabel="Alignment checklist"
      storageKey="flowent:floating-panel:alignment-checklist"
      title="Alignment checklist"
      badge={<strong>{diagnostics.length}</strong>}
      width={260}
      defaultPlacement={{ top: 454, right: 18 }}
    >
      {diagnostics.length === 0 ? (
        <p className="alignment-checklist-empty">No alignment gaps found in the current map.</p>
      ) : (
        <ul className="alignment-diagnostic-list">
          {diagnostics.map((diagnostic) => (
            <li key={diagnostic.id}>
              <button
                type="button"
                className={`alignment-diagnostic alignment-diagnostic-${diagnostic.severity}`}
                onClick={() => onSelectDiagnostic(diagnostic)}
                aria-label={`${diagnostic.title}: ${diagnostic.detail}`}
              >
                <span className="alignment-diagnostic-title">{diagnostic.title}</span>
                <span className="alignment-diagnostic-detail">{diagnostic.detail}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </FloatingPanel>
  )
}
