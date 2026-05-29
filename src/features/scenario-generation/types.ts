import type { ProcessMap } from '../process-map/types'

export type GeneratedSource = 'user-provided' | 'model-inferred' | 'system-derived'

export interface ScenarioInput {
  scenario: string
  problemGoal: string
  trigger: string
  roles: string[]
  stakeholders: string[]
  upstreamActors: string[]
  downstreamActors: string[]
  inputs: string[]
  outputs: string[]
  activities: string[]
  decisions: string[]
}

export type ScenarioInputField = keyof ScenarioInput

export interface ScenarioInputValidationError {
  field: ScenarioInputField
  message: string
}

export type ScenarioInputValidationResult =
  | { success: true; data: ScenarioInput; errors?: never }
  | { success: false; errors: ScenarioInputValidationError[]; data?: never }

export type GeneratedFindingKind = 'missing-information' | 'assumption' | 'risk-point' | 'required-confirmation'

export interface GeneratedMapFinding {
  kind: GeneratedFindingKind
  message: string
}

export interface ScenarioDraft {
  processMap: ProcessMap
  sourcesById: Record<string, GeneratedSource>
  findings: GeneratedMapFinding[]
}

export type ScenarioDraftApiResponse =
  | { success: true; data: ScenarioDraft; error?: never }
  | { success: false; error: string; data?: never }
