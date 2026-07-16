import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ActivationBar } from './ActivationBar'
import type { ActivationState } from './activation/processActivation'
import type { ProcessIntelligenceReport } from './diagnostics/processIntelligence'

const base: ActivationState = {
  status: 'unactivated',
  activatedAt: null,
  lastEditedAt: null,
  baselineDiagnosticCount: null,
}

const measuredProcess: ProcessIntelligenceReport = {
  profile: 'saas',
  measurementsComplete: true,
  dataGaps: [],
  metrics: {
    totalMinutesP50: 80,
    totalMinutesP90: 130,
    valueAddMinutesP50: 10,
    waitMinutesP50: 50,
    reworkMinutesP50: 20,
    processCycleEfficiency: 0.125,
    waitShare: 0.625,
    reworkShare: 0.25,
    verdict: 'typical',
    throughputPerHour: 6,
  },
  findings: [{
    rule: 'R1', severity: 'high', title: 'Slow stage: Wait for review',
    detail: 'P50 50 min versus value-add mean 10 min.', nodeIds: ['wait-review'], impactMinutesP50: 50,
  }],
}

describe('ActivationBar', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shows Draft status when no activation exists', () => {
    render(<ActivationBar activation={base} eligible={false} reasons={['Missing roles']} onActivate={() => {}} />)
    expect(screen.getByText('Draft')).toBeInTheDocument()
    expect(screen.getByText('Missing roles')).toBeInTheDocument()
  })

  it('renders repeated activation reasons without duplicate React keys', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    render(
      <ActivationBar
        activation={base}
        eligible={false}
        reasons={['Activity needs responsible roles', 'Activity needs responsible roles']}
        onActivate={() => {}}
      />,
    )

    expect(screen.getAllByText('Activity needs responsible roles')).toHaveLength(2)
    expect(consoleError.mock.calls.filter(([message]) => String(message).includes('same key'))).toHaveLength(0)
  })

  it('shows bottleneck metrics when at least one bottleneck exists', () => {
    render(
      <ActivationBar
        activation={base}
        eligible={false}
        reasons={[]}
        bottlenecks={{ total: 3, approved: 1, open: 2, openRatio: 2 / 3 }}
        onActivate={() => {}}
      />,
    )
    expect(screen.getByText(/3 bottlenecks/i)).toBeInTheDocument()
    expect(screen.getByText(/1 approved/i)).toBeInTheDocument()
    expect(screen.getByText(/2 open/i)).toBeInTheDocument()
  })

  it('shows process intelligence metrics and lets a finding select its activity', () => {
    const onSelectProcessFinding = vi.fn()
    render(
      <ActivationBar
        activation={base}
        eligible={false}
        reasons={[]}
        processIntelligence={measuredProcess}
        onSelectProcessFinding={onSelectProcessFinding}
        onActivate={() => {}}
      />,
    )

    expect(screen.getByText('Process intelligence')).toBeInTheDocument()
    expect(screen.getByText('P50 80 min')).toBeInTheDocument()
    expect(screen.getByText('P90 130 min')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /slow stage: wait for review/i }))
    expect(onSelectProcessFinding).toHaveBeenCalledWith(measuredProcess.findings[0])
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
