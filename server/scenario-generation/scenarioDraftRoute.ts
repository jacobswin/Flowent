import type { ScenarioDraftApiResponse, ScenarioDraft } from '../../src/features/scenario-generation/types'
import { normalizeScenarioDraft } from './normalizeScenarioDraft'
import { scenarioDraftRequestSchema, type ClaudeScenarioDraft, type ScenarioDraftRequest } from './scenarioDraftSchemas'

interface ScenarioDraftRouteDependencies {
  generateDraft: (input: ScenarioDraftRequest) => Promise<ScenarioDraft | ClaudeScenarioDraft>
  hasApiKey: () => boolean
}

const REQUIRED_INPUT_ERROR = 'Please complete the required scenario details before generating a draft map.'
const MAX_REQUEST_BYTES = 24_000

export function createScenarioDraftRouteHandler(dependencies: ScenarioDraftRouteDependencies) {
  return async function handleScenarioDraftRequest(request: Request): Promise<Response> {
    if (request.method !== 'POST') {
      return jsonResponse({ success: false, error: 'Method not allowed.' }, 405)
    }

    const rawBody = await request.text()

    if (rawBody.length > MAX_REQUEST_BYTES) {
      return jsonResponse({ success: false, error: 'Scenario input is too large for draft generation.' }, 413)
    }

    let body: unknown
    try {
      body = JSON.parse(rawBody)
    } catch {
      return jsonResponse({ success: false, error: 'Request body must be valid JSON.' }, 400)
    }

    const parsedRequest = scenarioDraftRequestSchema.safeParse(body)
    if (!parsedRequest.success) {
      return jsonResponse({ success: false, error: REQUIRED_INPUT_ERROR }, 400)
    }

    if (!dependencies.hasApiKey()) {
      return jsonResponse({ success: false, error: 'LLM draft generation is not configured for this environment.' }, 503)
    }

    try {
      const generatedDraft = await dependencies.generateDraft(parsedRequest.data)

      if (isScenarioDraft(generatedDraft)) {
        return jsonResponse({ success: true, data: generatedDraft }, 200)
      }

      const draft = normalizeScenarioDraft(generatedDraft)

      if (!draft.success) {
        return jsonResponse({ success: false, error: 'Flowent could not safely validate the generated draft.' }, 502)
      }

      return jsonResponse({ success: true, data: draft.data }, 200)
    } catch (error: unknown) {
      return jsonResponse({ success: false, error: getSafeGenerationError(error) }, 502)
    }
  }
}

function isScenarioDraft(value: ScenarioDraft | ClaudeScenarioDraft): value is ScenarioDraft {
  return 'processMap' in value && 'findings' in value
}

function getSafeGenerationError(error: unknown): string {
  if (error instanceof Error && 'userMessage' in error && typeof error.userMessage === 'string') {
    return error.userMessage
  }

  return 'Flowent could not generate a draft map right now. Please try again.'
}

function jsonResponse(body: ScenarioDraftApiResponse, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}
