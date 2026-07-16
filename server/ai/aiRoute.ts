import { join } from 'node:path'
import { z } from 'zod'
import { loadAndMutateLibrary, loadLibrary } from '../library/libraryStore'
import {
  addAiProvider,
  deleteAiProvider,
  findSavedAiProvider,
  getDecryptedApiKey,
  listPublicAiProviders,
  updateAiProvider,
  type AiProviderProtocol,
} from './aiProviderStore'
import { extractTextFromGenerateRequest } from './extractInputText'
import { AiProviderRequestError, generateAiMapDraft, listProviderModels, testProviderConnection, type FetchLike } from './llmAdapters'
import { normalizeAiMapDraft } from './normalizeAiMapDraft'

interface AiRouteDeps {
  filePath: string
  masterKeyFile?: string
  fetchImpl?: FetchLike
}

const providerInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  presetId: z.string().trim().min(1),
  protocol: z.enum(['openai-compatible', 'anthropic']),
  apiBaseUrl: z.string().trim().min(1),
  useFullUrl: z.boolean().default(false),
  model: z.string().trim().min(1),
  websiteUrl: z.string().trim().default(''),
  notes: z.string().trim().default(''),
  apiKey: z.string().trim().optional(),
  isDefault: z.boolean().optional(),
})

const providerPatchSchema = providerInputSchema.partial().extend({
  clearApiKey: z.boolean().optional(),
})

const modelListRequestSchema = z.object({
  providerId: z.string().trim().min(1).optional(),
  protocol: z.enum(['openai-compatible', 'anthropic']).optional(),
  apiBaseUrl: z.string().trim().optional(),
  useFullUrl: z.boolean().optional(),
  apiKey: z.string().trim().optional(),
})

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify({ success: status < 400, data: body }), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function errorResponse(status: number, message: string): Response {
  return new Response(JSON.stringify({ success: false, error: message }), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

export function createAiRouteHandler(deps: AiRouteDeps) {
  const masterKeyFile = deps.masterKeyFile ?? join(deps.filePath, '..', 'flowent-ai-master.key')
  const fetchImpl = deps.fetchImpl ?? fetch

  return async function handleAiRequest(request: Request): Promise<Response> {
    const url = new URL(request.url)
    const pathname = url.pathname

    if (pathname === '/api/ai/providers') {
      if (request.method === 'GET') {
        const lib = await loadLibrary(deps.filePath)
        return json({ providers: listPublicAiProviders(lib), defaultProviderId: lib.aiSettings.defaultProviderId })
      }

      if (request.method === 'POST') {
        const parsed = await parseJsonBody(request, providerInputSchema)
        if (!parsed.ok) return errorResponse(400, parsed.error)
        const result = await loadAndMutateLibrary(deps.filePath, async (lib) => {
          const created = await addAiProvider(lib, parsed.data, { masterKeyFile })
          return { next: created.next, result: created.provider }
        })
        return json({ provider: result }, 201)
      }

      return errorResponse(405, 'Method not allowed.')
    }

    if (pathname === '/api/ai/models') {
      if (request.method !== 'POST') return errorResponse(405, 'Method not allowed.')
      const parsed = await parseJsonBody(request, modelListRequestSchema)
      if (!parsed.ok) return errorResponse(400, parsed.error)

      try {
        const data = parsed.data
        const lib = data.providerId ? await loadLibrary(deps.filePath) : null
        const savedProvider = data.providerId && lib ? findSavedAiProvider(lib, data.providerId) : null
        if (data.providerId && !savedProvider) return errorResponse(404, 'Provider not found.')

        const protocol = data.protocol ?? savedProvider?.protocol
        const apiBaseUrl = data.apiBaseUrl?.trim() || savedProvider?.apiBaseUrl
        const useFullUrl = data.useFullUrl ?? savedProvider?.useFullUrl ?? false
        if (!protocol || !apiBaseUrl) return errorResponse(400, 'Provider protocol and API request URL are required to fetch models.')

        const apiKey = data.apiKey?.trim()
          || (lib && savedProvider ? await getDecryptedApiKey(lib, savedProvider.id, { masterKeyFile }) : null)
        if (!apiKey) return errorResponse(400, 'The selected provider does not have an API key configured.')

        const provider = savedProvider
          ? { ...savedProvider, protocol, apiBaseUrl, useFullUrl }
          : {
              id: 'unsaved-provider',
              name: 'Unsaved Provider',
              presetId: 'custom-openai-compatible',
              protocol,
              apiBaseUrl,
              useFullUrl,
              model: '',
              websiteUrl: '',
              notes: '',
              hasApiKey: true,
              maskedApiKey: '',
              isDefault: false,
            }
        const models = await listProviderModels(provider, apiKey, fetchImpl)
        return json({ models })
      } catch (error) {
        return errorResponse(502, safeAiError(error))
      }
    }

    const providerMatch = pathname.match(/^\/api\/ai\/providers\/([\w-]+)$/)
    if (providerMatch) {
      const providerId = providerMatch[1]
      if (request.method === 'PATCH') {
        const parsed = await parseJsonBody(request, providerPatchSchema)
        if (!parsed.ok) return errorResponse(400, parsed.error)
        try {
          const result = await loadAndMutateLibrary(deps.filePath, async (lib) => {
            const updated = await updateAiProvider(lib, providerId, parsed.data, { masterKeyFile })
            return { next: updated.next, result: updated.provider }
          })
          return json({ provider: result })
        } catch (error) {
          if ((error as Error).message === 'NOT_FOUND') return errorResponse(404, 'Provider not found.')
          return errorResponse(400, 'Provider could not be updated.')
        }
      }

      if (request.method === 'DELETE') {
        const deleted = await loadAndMutateLibrary(deps.filePath, (lib) => {
          const result = deleteAiProvider(lib, providerId)
          return { next: result.next, result: result.deleted }
        })
        if (!deleted) return errorResponse(404, 'Provider not found.')
        return json({ id: providerId })
      }

      return errorResponse(405, 'Method not allowed.')
    }

    const testMatch = pathname.match(/^\/api\/ai\/providers\/([\w-]+)\/test$/)
    if (testMatch) {
      if (request.method !== 'POST') return errorResponse(405, 'Method not allowed.')
      const providerId = testMatch[1]
      const lib = await loadLibrary(deps.filePath)
      const provider = findSavedAiProvider(lib, providerId)
      if (!provider) return errorResponse(404, 'Provider not found.')
      const apiKey = await getDecryptedApiKey(lib, provider.id, { masterKeyFile })
      if (!apiKey) return errorResponse(400, 'The selected provider does not have an API key configured.')
      try {
        await testProviderConnection(provider, apiKey, fetchImpl)
        return json({ ok: true })
      } catch (error) {
        return errorResponse(502, safeAiError(error))
      }
    }

    if (pathname === '/api/ai/generate-map') {
      if (request.method !== 'POST') return errorResponse(405, 'Method not allowed.')
      try {
        const extracted = await extractTextFromGenerateRequest(request)
        const lib = await loadLibrary(deps.filePath)
        const provider = findSavedAiProvider(lib, extracted.providerId)
        if (!provider) return errorResponse(400, 'Please configure an AI provider before generating a map.')
        const apiKey = await getDecryptedApiKey(lib, provider.id, { masterKeyFile })
        if (!apiKey) return errorResponse(400, 'The selected provider does not have an API key configured.')

        const draft = await generateAiMapDraft({
          provider,
          apiKey,
          inputText: extracted.inputText,
          model: extracted.model,
          processAnalysis: extracted.processAnalysis,
        }, fetchImpl)
        const normalized = await normalizeAiMapDraft({
          ...draft,
          ...(extracted.processAnalysis ? { processAnalysis: extracted.processAnalysis } : {}),
        })
        if (!normalized.success) return errorResponse(502, normalized.error)

        return json({
          title: normalized.title,
          summary: normalized.summary,
          document: normalized.document,
          findings: normalized.findings,
          sourceName: extracted.sourceName,
          warnings: extracted.warnings,
        })
      } catch (error) {
        return errorResponse(400, safeAiError(error))
      }
    }

    return errorResponse(404, 'Not found.')
  }
}

async function parseJsonBody<T>(request: Request, schema: z.ZodType<T>): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  let payload: unknown
  try {
    payload = await request.json()
  } catch (error) {
    return { ok: false, error: `Malformed JSON: ${(error as Error).message}` }
  }
  const parsed = schema.safeParse(payload)
  if (!parsed.success) {
    return { ok: false, error: `Invalid payload: ${parsed.error.issues.map((issue) => issue.message).join('; ')}` }
  }
  return { ok: true, data: parsed.data }
}

function safeAiError(error: unknown): string {
  if (error instanceof AiProviderRequestError) return error.userMessage
  if (error instanceof Error) return error.message
  return 'Flowent could not complete the AI request right now.'
}

export type { AiProviderProtocol }
