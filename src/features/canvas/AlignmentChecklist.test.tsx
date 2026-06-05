import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AlignmentChecklist } from './AlignmentChecklist'
import type { ProcessMapDiagnostic } from './diagnostics/processMapDiagnostics'

const diagnostics: ProcessMapDiagnostic[] = [
  {
    id: 'node-a-missing-role',
    targetType: 'node',
    targetId: 'a',
    severity: 'warning',
    title: 'Activity needs responsable roles',
    detail: 'Add at least one responsable role.',
  },
]

describe('AlignmentChecklist', () => {
  it('renders diagnostics as alignment work, not diagram feedback', () => {
    render(<AlignmentChecklist diagnostics={diagnostics} onSelectDiagnostic={() => {}} />)

    expect(screen.getByText('Alignment checklist')).toBeInTheDocument()
    expect(screen.getByText('Activity needs responsable roles')).toBeInTheDocument()
    expect(screen.getByText('Add at least one responsable role.')).toBeInTheDocument()
  })

  it('selects the diagnostic target when clicked', () => {
    const onSelectDiagnostic = vi.fn()
    render(<AlignmentChecklist diagnostics={diagnostics} onSelectDiagnostic={onSelectDiagnostic} />)

    fireEvent.click(screen.getByRole('button', { name: /activity needs responsable roles/i }))

    expect(onSelectDiagnostic).toHaveBeenCalledWith(diagnostics[0])
  })
})
