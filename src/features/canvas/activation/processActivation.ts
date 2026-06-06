import type { GraphDocument, ReviewStatus } from '../canvasTypes'
import { getProcessMapDiagnostics } from '../diagnostics/processMapDiagnostics'

export type ActivationStatus = 'unactivated' | 'ready' | 'activated' | 'stale'

export interface ActivationState {
  status: ActivationStatus
  /** ISO timestamp the map was last activated. null until first activation. */
  activatedAt: string | null
  /** ISO timestamp of the last in-document edit. */
  lastEditedAt: string | null
  /** Number of alignment diagnostics at activation time (frozen). null until first activation. */
  baselineDiagnosticCount: number | null
}

export const DEFAULT_ACTIVATION: ActivationState = {
  status: 'unactivated',
  activatedAt: null,
  lastEditedAt: null,
  baselineDiagnosticCount: null,
}

/**
 * Map a doc's "dirty" flag plus the saved activation metadata to a
 * user-visible activation status. If the doc has never been activated
 * the status is `unactivated`. After activation, edits push it to
 * `stale` until the user re-activates.
 */
export function deriveActivationStatus(
  doc: GraphDocument,
  saved: ActivationState | null,
): ActivationState {
  if (saved === null) {
    return { ...DEFAULT_ACTIVATION }
  }

  // Edits happened after activation → map is stale.
  if (saved.activatedAt && doc.meta.dirty) {
    return { ...saved, status: 'stale' }
  }

  return saved
}

export function isActivationEligible(doc: GraphDocument): { eligible: boolean; reasons: string[] } {
  const diagnostics = getProcessMapDiagnostics(doc)
  const blocking = diagnostics.filter((diagnostic) => diagnostic.severity === 'warning')
  const reasons: string[] = []
  for (const diagnostic of blocking) {
    reasons.push(diagnostic.title)
  }
  return { eligible: blocking.length === 0, reasons }
}

/**
 * Capture the activation snapshot that gets persisted to the server. We
 * keep the timestamp in ISO 8601 so consumers can render it without
 * picking a locale or doing timezone math.
 */
export function buildActivationSnapshot(
  doc: GraphDocument,
  previous: ActivationState,
): ActivationState {
  const diagnostics = getProcessMapDiagnostics(doc)
  return {
    status: 'activated',
    activatedAt: new Date().toISOString(),
    lastEditedAt: previous.lastEditedAt,
    baselineDiagnosticCount: diagnostics.length,
  }
}

/**
 * Human label for the activation status, used by ActivationBar and the
 * status-bar indicator. The user-facing copy is intentionally short so
 * it fits the status bar.
 */
export function describeActivationStatus(state: ActivationState): string {
  switch (state.status) {
    case 'unactivated':
      return 'Draft — not yet the agreed process'
    case 'ready':
      return 'Ready to activate'
    case 'activated':
      return 'Activated — this is the agreed process'
    case 'stale':
      return 'Stale — edited since activation'
  }
}

/** Helper: is this review status one that counts as approved? */
export function isReviewApproved(status: ReviewStatus | undefined): boolean {
  return status === 'approved'
}
