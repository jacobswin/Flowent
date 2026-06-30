import { describe, expect, it } from 'vitest'
import {
  describeReviewStatus,
  isReviewStatusValue,
  REVIEW_STATUS_OPTIONS,
} from './reviewStatus'

describe('reviewStatus helpers', () => {
  it('flags valid enum values and rejects everything else', () => {
    for (const option of REVIEW_STATUS_OPTIONS) {
      expect(isReviewStatusValue(option.value)).toBe(true)
    }
    expect(isReviewStatusValue('not-a-status')).toBe(false)
    expect(isReviewStatusValue('')).toBe(false)
  })

  it('describes the enum as a human label', () => {
    expect(describeReviewStatus('approved')).toBe('Approved')
    expect(describeReviewStatus('needs-owner')).toBe('Needs owner')
    expect(describeReviewStatus(undefined)).toBe('Unclear')
  })
})
