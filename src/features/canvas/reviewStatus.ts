import type { ReviewStatus } from './canvasTypes'

export interface ReviewStatusOption {
  value: ReviewStatus
  label: string
}

export const REVIEW_STATUS_OPTIONS: ReviewStatusOption[] = [
  { value: 'unclear', label: 'Unclear' },
  { value: 'disputed', label: 'Disputed' },
  { value: 'needs-owner', label: 'Needs owner' },
  { value: 'approved', label: 'Approved' },
  { value: 'changed-since-approval', label: 'Changed since approval' },
]

export function isReviewStatusValue(value: string): value is ReviewStatus {
  return (
    value === 'unclear' ||
    value === 'disputed' ||
    value === 'needs-owner' ||
    value === 'approved' ||
    value === 'changed-since-approval'
  )
}

export function describeReviewStatus(status: ReviewStatus | undefined): string {
  if (!status) return 'Unclear'
  const match = REVIEW_STATUS_OPTIONS.find((option) => option.value === status)
  return match ? match.label : 'Unclear'
}
