import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AlignmentChecklist } from './AlignmentChecklist'
import { ProcessElementPalette } from './ProcessElementPalette'
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
    render(<AlignmentChecklist defaultCollapsed={false} diagnostics={diagnostics} onSelectDiagnostic={() => {}} />)

    expect(screen.getByText('Alignment checklist')).toBeInTheDocument()
    expect(screen.getByText('Activity needs responsable roles')).toBeInTheDocument()
    expect(screen.getByText('Add at least one responsable role.')).toBeInTheDocument()
  })

  it('selects the diagnostic target when clicked', () => {
    const onSelectDiagnostic = vi.fn()
    render(<AlignmentChecklist defaultCollapsed={false} diagnostics={diagnostics} onSelectDiagnostic={onSelectDiagnostic} />)

    fireEvent.click(screen.getByRole('button', { name: /activity needs responsable roles/i }))

    expect(onSelectDiagnostic).toHaveBeenCalledWith(diagnostics[0])
  })

  it('defaults collapsed and expands from the top dock title', () => {
    render(<AlignmentChecklist diagnostics={diagnostics} onSelectDiagnostic={() => {}} />)

    expect(screen.queryByRole('button', { name: /activity needs responsable roles/i })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /expand alignment checklist/i }))

    expect(screen.getByRole('button', { name: /activity needs responsable roles/i })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /collapse alignment checklist/i }))

    expect(screen.queryByRole('button', { name: /activity needs responsable roles/i })).not.toBeInTheDocument()
  })

  it('uses fixed top dock panels for elements and alignment', () => {
    render(
      <>
        <ProcessElementPalette onQuickCreate={() => {}} />
        <AlignmentChecklist diagnostics={diagnostics} onSelectDiagnostic={() => {}} />
      </>,
    )

    const elementsPanel = screen.getByLabelText('Process element library')
    const checklistPanel = screen.getByLabelText('Alignment checklist')

    expect(elementsPanel).toHaveClass('top-dock-panel')
    expect(checklistPanel).toHaveClass('top-dock-panel')
    expect(elementsPanel.style.left).toBe('')
    expect(checklistPanel.style.left).toBe('')
  })

  it('keeps checklist position out of persisted floating coordinates', () => {
    render(<AlignmentChecklist diagnostics={diagnostics} onSelectDiagnostic={() => {}} />)

    const panel = screen.getByLabelText('Alignment checklist')

    expect(panel).toHaveClass('top-dock-panel')
    expect(panel.style.left).toBe('')
    expect(panel.style.top).toBe('')
    expect(panel.style.getPropertyValue('--top-dock-width')).toBe('260px')
  })
})
