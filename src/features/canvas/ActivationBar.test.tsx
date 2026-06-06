import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ActivationBar } from './ActivationBar'
import type { ActivationState } from './activation/processActivation'

const base: ActivationState = {
  status: 'unactivated',
  activatedAt: null,
  lastEditedAt: null,
  baselineDiagnosticCount: null,
}

describe('ActivationBar', () => {
  it('shows Draft status when no activation exists', () => {
    render(<ActivationBar activation={base} eligible={false} reasons={['Missing roles']} onActivate={() => {}} />)
    expect(screen.getByText('Draft')).toBeInTheDocument()
    expect(screen.getByText('Missing roles')).toBeInTheDocument()
  })

  it('disables the activate button when not eligible', () => {
    render(<ActivationBar activation={base} eligible={false} reasons={[]} onActivate={() => {}} />)
    expect(screen.getByRole('button', { name: /activate map as the agreed process/i })).toBeDisabled()
  })

  it('enables the activate button when eligible and shows the Re-activate label after activation', () => {
    const activated: ActivationState = {
      status: 'activated',
      activatedAt: '2026-06-04T10:00:00.000Z',
      lastEditedAt: null,
      baselineDiagnosticCount: 0,
    }
    const onActivate = vi.fn()
    render(<ActivationBar activation={activated} eligible={true} reasons={[]} onActivate={onActivate} />)
    const button = screen.getByRole('button', { name: /activate map as the agreed process/i })
    expect(button).not.toBeDisabled()
    expect(button).toHaveTextContent(/re-activate/i)
    fireEvent.click(button)
    expect(onActivate).toHaveBeenCalled()
  })

  it('shows the activation date in the meta line', () => {
    const activated: ActivationState = {
      status: 'stale',
      activatedAt: '2026-06-04T10:00:00.000Z',
      lastEditedAt: null,
      baselineDiagnosticCount: 1,
    }
    render(<ActivationBar activation={activated} eligible={true} reasons={[]} onActivate={() => {}} />)
    expect(screen.getByText(/Last activated 2026-06-04/i)).toBeInTheDocument()
  })
})
