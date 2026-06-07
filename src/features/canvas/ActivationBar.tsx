import type { BottleneckMetrics } from './diagnostics/bottleneckMetrics'
import { type ActivationState } from './activation/processActivation'

interface ActivationBarProps {
  activation: ActivationState
  eligible: boolean
  reasons: string[]
  bottlenecks?: BottleneckMetrics
  onActivate: () => void
}

/**
 * Small floating bar that shows the map's current activation status and
 * surfaces the Activate action. Activation is the bridge from "I drew a
 * map" to "this map is the agreed current process". We keep the bar
 * minimal so it doesn't crowd the existing palette and focus bar.
 */
export function ActivationBar({ activation, eligible, reasons, bottlenecks, onActivate }: ActivationBarProps) {
  const statusClass = `activation-bar activation-bar-${activation.status}`

  return (
    <section className={statusClass} aria-label="Process activation">
      <div className="activation-bar-status">
        <span className="activation-bar-label">Process status</span>
        <strong>{activationLabel(activation.status)}</strong>
      </div>
      {!eligible && activation.status !== 'activated' && (
        <ul className="activation-bar-reasons">
          {reasons.slice(0, 3).map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      )}
      {activation.activatedAt && (
        <p className="activation-bar-meta">
          Last activated {formatActivatedAt(activation.activatedAt)}
        </p>
      )}
      {bottlenecks && bottlenecks.total > 0 && (
        <div className="activation-bar-metrics" aria-label="Bottleneck metrics">
          <span>{bottlenecks.total} bottlenecks</span>
          <span>·</span>
          <span>{bottlenecks.approved} approved</span>
          <span>·</span>
          <span>{bottlenecks.open} open</span>
        </div>
      )}
      <button
        type="button"
        className="activation-bar-activate"
        onClick={onActivate}
        disabled={!eligible}
        aria-label="Activate map as the agreed process"
        title={eligible
          ? 'Mark this map as the agreed current process'
          : 'Resolve the alignment issues first'}
      >
        {activation.status === 'activated' || activation.status === 'stale' ? 'Re-activate' : 'Activate'}
      </button>
    </section>
  )
}

function activationLabel(status: ActivationState['status']): string {
  switch (status) {
    case 'unactivated':
      return 'Draft'
    case 'ready':
      return 'Ready'
    case 'activated':
      return 'Activated'
    case 'stale':
      return 'Stale — needs review'
  }
}

function formatActivatedAt(iso: string): string {
  // Keep the format short so it fits the bar. We use the ISO date
  // portion so it's locale-agnostic; full local time would invite
  // timezone bugs.
  return iso.slice(0, 10)
}
