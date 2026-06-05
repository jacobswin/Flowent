import type { ProcessMapDiagnostic } from './diagnostics/processMapDiagnostics'

interface AlignmentChecklistProps {
  diagnostics: ProcessMapDiagnostic[]
  onSelectDiagnostic: (diagnostic: ProcessMapDiagnostic) => void
}

export function AlignmentChecklist({ diagnostics, onSelectDiagnostic }: AlignmentChecklistProps) {
  return (
    <aside className="alignment-checklist" aria-label="Alignment checklist">
      <div className="alignment-checklist-header">
        <span>Alignment checklist</span>
        <strong>{diagnostics.length}</strong>
      </div>
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
    </aside>
  )
}
