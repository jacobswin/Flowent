import { describe, expect, it } from 'vitest'
import {
  PROCESS_INTELLIGENCE_PROFILES,
  getProcessIntelligenceProfile,
} from './processIntelligenceProfiles'

describe('process intelligence profiles', () => {
  it('provides the existing profiles and the complete development industry pack', () => {
    expect(PROCESS_INTELLIGENCE_PROFILES.map((profile) => profile.id)).toEqual([
      'saas',
      'services',
      'manufacturing',
      'healthcare',
      'engineering',
      'automotive',
      'hardware',
      'construction',
    ])
    expect(new Set(PROCESS_INTELLIGENCE_PROFILES.map((profile) => profile.id)).size).toBe(8)
    for (const profile of PROCESS_INTELLIGENCE_PROFILES) {
      expect(profile.thresholds.stageMultiplier).toBeGreaterThan(1)
      expect(profile.thresholds.waitShareMax).toBeGreaterThan(0)
      expect(profile.thresholds.reworkShareMax).toBeGreaterThan(0)
      expect(profile.thresholds.healthyPce).toBeGreaterThan(profile.thresholds.typicalPce)
    }
  })

  it('exposes the approved automotive baseline and generation guidance', () => {
    expect(getProcessIntelligenceProfile('automotive')).toMatchObject({
      label: 'Automotive Development',
      thresholds: {
        stageMultiplier: 1.75,
        waitShareMax: 0.32,
        reworkShareMax: 0.08,
        healthyPce: 0.32,
        typicalPce: 0.14,
      },
    })
    expect(getProcessIntelligenceProfile('automotive').generationGuidance).toContain('DVP')
  })
})
