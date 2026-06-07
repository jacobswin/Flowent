import type { GraphDocument } from '../canvasTypes'

export interface BottleneckMetrics {
  /** Number of bottleneck nodes in the doc. */
  total: number
  /** Bottlenecks with reviewStatus === 'approved'. */
  approved: number
  /** Bottlenecks with reviewStatus in {undefined, 'unclear', 'disputed', 'needs-owner', 'changed-since-approval'}. */
  open: number
  /** open / total, or 0 when total is 0. */
  openRatio: number
}

export function getBottleneckMetrics(doc: GraphDocument): BottleneckMetrics {
  let total = 0
  let approved = 0
  for (const node of doc.nodes.values()) {
    if (node.type !== 'bottleneck') continue
    total++
    if (node.reviewStatus === 'approved') approved++
  }
  const open = total - approved
  const openRatio = total === 0 ? 0 : open / total
  return { total, approved, open, openRatio }
}
