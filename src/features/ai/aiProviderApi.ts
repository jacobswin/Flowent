import type { ProcessAnalysisSettings } from '../canvas/canvasTypes'
import type { AiGeneratedMapDraft, AiProviderModel, AiProviderPayload, AiProviderProtocol, PublicAiProvider } from './aiTypes'

type ApiEnvelope<T> = { success: true; data: T } | { success: false; error: string }

export async function fetchAiProviders(): Promise<{ providers: PublicAiProvider[]; defaultProviderId: string | null }> {
  const body = await readApiEnvelope<{ providers: PublicAiProvider[]; defaultProviderId: string | null }>('/api/ai/providers')
  return body
}

export async function createAiProvider(payload: AiProviderPayload): Promise<PublicAiProvider> {
  const body = await readApiEnvelope<{ provider: PublicAiProvider }>('/api/ai/providers', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return body.provider
}

export async function updateAiProvider(providerId: string, payload: Partial<AiProviderPayload> & { clearApiKey?: boolean }): Promise<PublicAiProvider> {
  const body = await readApiEnvelope<{ provider: PublicAiProvider }>(`/api/ai/providers/${providerId}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return body.provider
}

export async function deleteAiProvider(providerId: string): Promise<void> {
  await readApiEnvelope(`/api/ai/providers/${providerId}`, { method: 'DELETE' })
}

export async function testAiProvider(providerId: string): Promise<void> {
  await readApiEnvelope(`/api/ai/providers/${providerId}/test`, { method: 'POST' })
}

export async function fetchAiModels(payload: {
  providerId?: string
  protocol?: AiProviderProtocol
  apiBaseUrl?: string
  useFullUrl?: boolean
  apiKey?: string
}): Promise<AiProviderModel[]> {
  const body = await readApiEnvelope<{ models: AiProviderModel[] }>('/api/ai/models', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return body.models
}

export async function generateMapWithAi(input: {
  providerId: string
  model?: string
  processAnalysis?: ProcessAnalysisSettings
  inputText: string
  inputFile?: File | null
}): Promise<AiGeneratedMapDraft> {
  if (input.inputFile) {
    const form = new FormData()
    form.set('providerId', input.providerId)
    if (input.model) form.set('model', input.model)
    if (input.processAnalysis) form.set('processAnalysis', JSON.stringify(input.processAnalysis))
    if (input.inputText.trim()) form.set('inputText', input.inputText.trim())
    form.set('inputFile', input.inputFile)
    return readApiEnvelope<AiGeneratedMapDraft>('/api/ai/generate-map', { method: 'POST', body: form })
  }

  return readApiEnvelope<AiGeneratedMapDraft>('/api/ai/generate-map', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      providerId: input.providerId,
      model: input.model,
      processAnalysis: input.processAnalysis,
      inputText: input.inputText,
    }),
  })
}

async function readApiEnvelope<T = unknown>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init)
  const body = await response.json() as ApiEnvelope<T>
  if (!response.ok || !body.success) {
    throw new Error(body.success ? `HTTP ${response.status}` : body.error)
  }
  return body.data
}
