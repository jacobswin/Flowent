import type { ScenarioDraftApiResponse, ScenarioInput } from './types'

export async function requestScenarioDraft(input: ScenarioInput): Promise<ScenarioDraftApiResponse> {
  try {
    const response = await fetch('/api/scenario-drafts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    })
    const body = (await response.json()) as ScenarioDraftApiResponse

    if (!body.success) {
      return { success: false, error: body.error }
    }

    return body
  } catch {
    return { success: false, error: 'Flowent could not reach draft generation. Please try again.' }
  }
}
