import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
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
  afterEach(() => {
    window.localStorage.clear()
  })

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

  it('collapses and expands the floating checklist panel', () => {
    render(<AlignmentChecklist diagnostics={diagnostics} onSelectDiagnostic={() => {}} />)

    fireEvent.click(screen.getByRole('button', { name: /collapse alignment checklist/i }))

    expect(screen.queryByRole('button', { name: /activity needs responsable roles/i })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /expand alignment checklist/i }))

    expect(screen.getByRole('button', { name: /activity needs responsable roles/i })).toBeInTheDocument()
  })

  it('can be moved by dragging the panel title', () => {
    render(<AlignmentChecklist diagnostics={diagnostics} onSelectDiagnostic={() => {}} />)

    const panel = screen.getByLabelText('Alignment checklist')
    const title = screen.getByText('Alignment checklist')
    const initialLeft = Number.parseFloat(panel.style.left)
    const initialTop = Number.parseFloat(panel.style.top)

    fireEvent.pointerDown(title, { clientX: 900, clientY: 460, pointerId: 1, button: 0 })
    fireEvent.pointerMove(title, { clientX: 700, clientY: 520, pointerId: 1, button: 0 })
    fireEvent.pointerUp(title, { clientX: 700, clientY: 520, pointerId: 1, button: 0 })

    expect(Number.parseFloat(panel.style.left)).toBeLessThan(initialLeft)
    expect(Number.parseFloat(panel.style.top)).toBeGreaterThan(initialTop)
  })
})
