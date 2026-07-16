export const PROCESS_INTELLIGENCE_PROFILE_IDS = [
  'saas',
  'services',
  'manufacturing',
  'healthcare',
  'engineering',
  'automotive',
  'hardware',
  'construction',
] as const

export type ProcessIntelligenceProfileId = typeof PROCESS_INTELLIGENCE_PROFILE_IDS[number]

export type ProcessIntelligenceProfileGroup =
  | 'Product & digital'
  | 'Professional services'
  | 'Industrial development'
  | 'Regulated operations'

export type ProcessIntelligenceThresholds = {
  stageMultiplier: number
  waitShareMax: number
  reworkShareMax: number
  healthyPce: number
  typicalPce: number
}

export type ProcessIntelligenceProfile = {
  id: ProcessIntelligenceProfileId
  label: string
  group: ProcessIntelligenceProfileGroup
  description: string
  generationGuidance: string
  thresholds: ProcessIntelligenceThresholds
}

export const PROCESS_INTELLIGENCE_PROFILES: readonly ProcessIntelligenceProfile[] = [
  {
    id: 'saas',
    label: 'Software',
    group: 'Product & digital',
    description: 'Iterative software and product delivery.',
    generationGuidance: 'Recognize product requirements, implementation, code review, integration, testing, deployment, and release work when supported by the source.',
    thresholds: { stageMultiplier: 2, waitShareMax: 0.4, reworkShareMax: 0.15, healthyPce: 0.25, typicalPce: 0.1 },
  },
  {
    id: 'services',
    label: 'Services',
    group: 'Professional services',
    description: 'Client-facing, professional, and operational services.',
    generationGuidance: 'Recognize client intake, planning, delivery, review, approval, and handover work when supported by the source.',
    thresholds: { stageMultiplier: 2.5, waitShareMax: 0.5, reworkShareMax: 0.15, healthyPce: 0.2, typicalPce: 0.08 },
  },
  {
    id: 'manufacturing',
    label: 'Manufacturing',
    group: 'Industrial development',
    description: 'Production, quality, and factory operations.',
    generationGuidance: 'Recognize production planning, build, quality checks, rework, release, and material handoffs when supported by the source.',
    thresholds: { stageMultiplier: 1.8, waitShareMax: 0.3, reworkShareMax: 0.1, healthyPce: 0.35, typicalPce: 0.15 },
  },
  {
    id: 'healthcare',
    label: 'Healthcare',
    group: 'Regulated operations',
    description: 'Care delivery and regulated clinical operations.',
    generationGuidance: 'Recognize intake, assessment, care, review, documentation, and discharge or closure work when supported by the source.',
    thresholds: { stageMultiplier: 2.5, waitShareMax: 0.55, reworkShareMax: 0.12, healthyPce: 0.2, typicalPce: 0.08 },
  },
  {
    id: 'engineering',
    label: 'Engineering Development',
    group: 'Industrial development',
    description: 'Requirements-to-release engineering work.',
    generationGuidance: 'Recognize requirements, architecture or design, implementation, integration, verification, validation, and release work when supported by the source.',
    thresholds: { stageMultiplier: 2.2, waitShareMax: 0.45, reworkShareMax: 0.18, healthyPce: 0.22, typicalPce: 0.09 },
  },
  {
    id: 'automotive',
    label: 'Automotive Development',
    group: 'Industrial development',
    description: 'Vehicle and subsystem development through validation.',
    generationGuidance: 'Recognize requirement baselines, system, hardware, or software design, prototypes, DVP or validation, quality evidence, and production-release readiness when supported by the source.',
    thresholds: { stageMultiplier: 1.75, waitShareMax: 0.32, reworkShareMax: 0.08, healthyPce: 0.32, typicalPce: 0.14 },
  },
  {
    id: 'hardware',
    label: 'Electronics & Hardware Development',
    group: 'Industrial development',
    description: 'Electronic and physical product development.',
    generationGuidance: 'Recognize specifications, schematic or PCB design, prototypes, bring-up, EMC or reliability testing, DFM or DFT, and design release when supported by the source.',
    thresholds: { stageMultiplier: 1.9, waitShareMax: 0.35, reworkShareMax: 0.1, healthyPce: 0.3, typicalPce: 0.12 },
  },
  {
    id: 'construction',
    label: 'Construction & Engineering Projects',
    group: 'Industrial development',
    description: 'Design-to-handover engineering projects.',
    generationGuidance: 'Recognize design, permits, procurement, construction, inspection, commissioning, and handover work when supported by the source.',
    thresholds: { stageMultiplier: 2.75, waitShareMax: 0.55, reworkShareMax: 0.12, healthyPce: 0.18, typicalPce: 0.07 },
  },
]

export function isProcessIntelligenceProfile(value: unknown): value is ProcessIntelligenceProfileId {
  return typeof value === 'string' && (PROCESS_INTELLIGENCE_PROFILE_IDS as readonly string[]).includes(value)
}

export function getProcessIntelligenceProfile(profile: ProcessIntelligenceProfileId): ProcessIntelligenceProfile {
  return PROCESS_INTELLIGENCE_PROFILES.find((candidate) => candidate.id === profile) ?? PROCESS_INTELLIGENCE_PROFILES[0]
}
