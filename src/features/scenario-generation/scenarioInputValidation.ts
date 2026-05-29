import type { ScenarioInput, ScenarioInputValidationError, ScenarioInputValidationResult } from './types'

const REQUIRED_FIELD_MESSAGES: Partial<Record<keyof ScenarioInput, string>> = {
  scenario: 'Describe the work scenario before generating a draft map.',
  roles: 'Add at least one responsible R&D role.',
  outputs: 'Add at least one expected output or work product.',
  activities: 'Add at least one known or expected activity.',
}

export function parseScenarioLines(value: string): string[] {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
}

export function validateScenarioInput(input: ScenarioInput): ScenarioInputValidationResult {
  const normalized: ScenarioInput = {
    scenario: input.scenario.trim(),
    problemGoal: input.problemGoal.trim(),
    trigger: input.trigger.trim(),
    roles: normalizeEntries(input.roles),
    stakeholders: normalizeEntries(input.stakeholders),
    upstreamActors: normalizeEntries(input.upstreamActors),
    downstreamActors: normalizeEntries(input.downstreamActors),
    inputs: normalizeEntries(input.inputs),
    outputs: normalizeEntries(input.outputs),
    activities: normalizeEntries(input.activities),
    decisions: normalizeEntries(input.decisions),
  }
  const errors: ScenarioInputValidationError[] = []

  for (const [field, message] of Object.entries(REQUIRED_FIELD_MESSAGES) as Array<
    [keyof ScenarioInput, string]
  >) {
    const value = normalized[field]
    const isMissing = Array.isArray(value) ? value.length === 0 : value.length === 0

    if (isMissing) {
      errors.push({ field, message })
    }
  }

  if (errors.length > 0) {
    return { success: false, errors }
  }

  return { success: true, data: normalized }
}

function normalizeEntries(entries: string[]): string[] {
  return entries.map((entry) => entry.trim()).filter((entry) => entry.length > 0)
}
