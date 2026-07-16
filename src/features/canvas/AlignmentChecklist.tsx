import type { ProcessMapDiagnostic } from './diagnostics/processMapDiagnostics'
import { TopDockPanel } from './TopDockPanel'

interface AlignmentChecklistProps {
  diagnostics: ProcessMapDiagnostic[]
  onSelectDiagnostic: (diagnostic: ProcessMapDiagnostic) => void
  defaultCollapsed?: boolean
}

export function AlignmentChecklist({ diagnostics, onSelectDiagnostic, defaultCollapsed = true }: AlignmentChecklistProps) {
  return (
    <TopDockPanel
      as="aside"
      className="alignment-checklist"
      ariaLabel="Alignment checklist"
      storageKey="flowent:top-dock:alignment-checklist:collapsed"
      title="Alignment"
      badge={<strong>{diagnostics.length}</strong>}
      width={260}
      collapsedWidth={212}
      collapsedMinWidth={134}
      collapsedWeight={1.15}
      compactTitle="Align"
      defaultCollapsed={defaultCollapsed}
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
    </TopDockPanel>
  )
}
