import { describe, expect, it } from 'vitest'
import {
  getSelectedEdgeMetadataLines,
  truncateMetadataLine,
} from './drawEdgeMetadata'

describe('drawEdgeMetadata helpers', () => {
  it('returns no lines when an edge has no semantic handoff metadata', () => {
    expect(getSelectedEdgeMetadataLines({})).toEqual([])
  })

  it('renders a role handoff line when fromRole and toRole exist', () => {
    expect(
      getSelectedEdgeMetadataLines({ fromRole: 'PM', toRole: 'Engineer' }),
    ).toEqual(['PM → Engineer'])
  })

  it('adds artifact as the next line when present', () => {
    expect(
      getSelectedEdgeMetadataLines({
        fromRole: 'PM',
        toRole: 'Engineer',
        artifact: 'Ready brief',
      }),
    ).toEqual(['PM → Engineer', 'Ready brief'])
  })

  it('falls back to readiness signal when no artifact exists', () => {
    expect(
      getSelectedEdgeMetadataLines({
        fromRole: 'PM',
        toRole: 'Engineer',
        readinessSignal: 'Scope and owner are confirmed',
      }),
    ).toEqual(['PM → Engineer', 'Scope and owner are confirmed'])
  })

  it('prefers artifact over readiness signal when both exist', () => {
    expect(
      getSelectedEdgeMetadataLines({
        fromRole: 'PM',
        toRole: 'Engineer',
        artifact: 'Ready brief',
        readinessSignal: 'Scope and owner are confirmed',
      }),
    ).toEqual(['PM → Engineer', 'Ready brief'])
  })

  it('falls back to expectation when no artifact or readiness exists', () => {
    expect(
      getSelectedEdgeMetadataLines({
        expectation: 'Ready work includes context and owner.',
      }),
    ).toEqual(['Ready work includes context and owner.'])
  })

  it('shows expectation as the second line when a role handoff exists but no artifact or readiness exists', () => {
    expect(
      getSelectedEdgeMetadataLines({
        fromRole: 'PM',
        toRole: 'Engineer',
        expectation: 'Ready work includes context and owner.',
      }),
    ).toEqual(['PM → Engineer', 'Ready work includes context and owner.'])
  })

  it('truncates long metadata lines to the visual budget', () => {
    expect(truncateMetadataLine('Short', 12)).toBe('Short')
    expect(truncateMetadataLine('This metadata line is much too long', 18)).toBe('This metadata lin…')
  })
})
