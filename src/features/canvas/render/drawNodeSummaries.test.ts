import { describe, expect, it } from 'vitest'
import {
  formatDecisionOutcomeSummary,
  formatStageConditionSummary,
  truncateSummaryLine,
} from './drawNodeSummaries'

describe('drawNodeSummaries helpers', () => {
  it('summarises decision outcomes into a readable single line', () => {
    expect(formatDecisionOutcomeSummary([])).toBe('')
    expect(formatDecisionOutcomeSummary(['Go'])).toBe('Go')
    expect(formatDecisionOutcomeSummary(['Go', 'Hold', 'Re-scope'])).toBe('Go · Hold · Re-scope')
  })

  it('formats stage entry and exit conditions compactly', () => {
    expect(formatStageConditionSummary('', '')).toBe('')
    expect(formatStageConditionSummary('Selected opportunity', '')).toBe('Entry · Selected opportunity')
    expect(formatStageConditionSummary('', 'Approved direction')).toBe('Exit · Approved direction')
    expect(
      formatStageConditionSummary('Selected opportunity', 'Approved direction'),
    ).toBe('Entry · Selected opportunity  →  Exit · Approved direction')
  })

  it('truncates long summary lines to the visual budget', () => {
    expect(truncateSummaryLine('Short', 12)).toBe('Short')
    expect(truncateSummaryLine('This summary line is much too long', 16)).toBe('This summary li…')
  })
})
