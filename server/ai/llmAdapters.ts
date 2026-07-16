import type { PublicAiProvider, SavedAiProvider } from './aiProviderStore'
import type { AiMapDraft } from './aiDraftSchemas'
import { normalizeActivityResponsibilities } from '../../src/features/canvas/processAssets'
import type { ProcessAnalysisProfile, ProcessAnalysisSettings } from '../../src/features/canvas/canvasTypes'
import { getProcessIntelligenceProfile } from '../../src/features/canvas/processIntelligenceProfiles'

export type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>

const DEFAULT_GENERATE_MAX_TOKENS = 6000
const COMPACT_RETRY_MAX_TOKENS = 3500
const CONNECTION_TEST_MAX_TOKENS = 256
const FALLBACK_INVALID_JSON_MESSAGE = 'The selected provider returned invalid JSON, so Flowent generated a fallback mainline from the source text.'
const FALLBACK_RATE_LIMIT_MESSAGE = 'The selected provider returned HTTP 429 (rate limit), so Flowent generated a fallback mainline from the source text.'

export type GenerateDraftInput = {
  provider: SavedAiProvider | PublicAiProvider
  apiKey: string
  inputText: string
  model?: string
  processAnalysis?: ProcessAnalysisSettings
}

export type AiProviderModel = {
  id: string
  label?: string
}

export class AiProviderRequestError extends Error {
  constructor(
    public readonly userMessage: string,
    public readonly status?: number,
  ) {
    super(userMessage)
  }
}

type ProviderPrompt = {
  model: string
  system: string
  user: string
  maxTokens?: number
}

export async function testProviderConnection(
  provider: SavedAiProvider | PublicAiProvider,
  apiKey: string,
  fetchImpl: FetchLike,
): Promise<void> {
  await callProvider(provider, apiKey, {
    model: provider.model,
    system: 'You are a connection test endpoint.',
    user: 'Reply with JSON only: {"ok":true}',
    maxTokens: CONNECTION_TEST_MAX_TOKENS,
  }, fetchImpl)
}

export async function generateAiMapDraft(
  input: GenerateDraftInput,
  fetchImpl: FetchLike,
): Promise<AiMapDraft> {
  const profile = input.processAnalysis?.profile
  const prompt = {
    model: input.model || input.provider.model,
    system: buildSystemPrompt(profile),
    user: buildUserPrompt(input.inputText),
  }
  let content: string
  try {
    content = await callProvider(input.provider, input.apiKey, {
      model: prompt.model,
      system: prompt.system,
      user: prompt.user,
      maxTokens: DEFAULT_GENERATE_MAX_TOKENS,
    }, fetchImpl)
  } catch (error) {
    if (isProviderRateLimitError(error)) return buildFallbackDraftFromSource(input.inputText, FALLBACK_RATE_LIMIT_MESSAGE)
    throw error
  }

  const parsed = tryParseJsonObject(content)
  if (parsed.ok) return simplifyDraftToActivityMainline(parsed.data as AiMapDraft, input.inputText)

  let compactRetryContent: string
  try {
    compactRetryContent = await callProvider(input.provider, input.apiKey, {
      model: prompt.model,
      system: buildCompactJsonSystemPrompt(profile),
      user: buildCompactJsonUserPrompt(input.inputText, content, profile),
      maxTokens: COMPACT_RETRY_MAX_TOKENS,
    }, fetchImpl)
  } catch (error) {
    if (isProviderRateLimitError(error)) return buildFallbackDraftFromSource(input.inputText, FALLBACK_RATE_LIMIT_MESSAGE)
    throw error
  }
  const compactParsed = tryParseJsonObject(compactRetryContent)
  if (compactParsed.ok) return simplifyDraftToActivityMainline(compactParsed.data as AiMapDraft, input.inputText)

  return buildFallbackDraftFromSource(input.inputText)
}

export async function listProviderModels(
  provider: SavedAiProvider | PublicAiProvider,
  apiKey: string,
  fetchImpl: FetchLike,
): Promise<AiProviderModel[]> {
  if (!apiKey) throw new AiProviderRequestError('The selected provider does not have an API key configured.')

  const endpoint = resolveModelsEndpoint(provider)
  try {
    const response = await fetchImpl(endpoint, {
      method: 'GET',
      headers: provider.protocol === 'anthropic'
        ? {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
          }
        : {
            authorization: `Bearer ${apiKey}`,
            'content-type': 'application/json',
          },
    })

    if (!response.ok) throw new AiProviderRequestError(safeProviderModelListError(response.status))

    let payload: unknown
    try {
      payload = await response.json()
    } catch {
      throw new AiProviderRequestError('The provider returned a model list Flowent could not read.')
    }
    return parseProviderModels(payload)
  } catch (error) {
    if (error instanceof AiProviderRequestError) throw error
    throw new AiProviderRequestError('Flowent could not reach the selected provider. Check the API URL and network connection.')
  }
}

async function callProvider(
  provider: SavedAiProvider | PublicAiProvider,
  apiKey: string,
  prompt: ProviderPrompt,
  fetchImpl: FetchLike,
): Promise<string> {
  if (!apiKey) throw new AiProviderRequestError('The selected provider does not have an API key configured.')

  if (provider.protocol === 'anthropic') {
    return callAnthropic(provider, apiKey, prompt, fetchImpl)
  }
  return callOpenAiCompatible(provider, apiKey, prompt, fetchImpl)
}

async function callOpenAiCompatible(
  provider: SavedAiProvider | PublicAiProvider,
  apiKey: string,
  prompt: ProviderPrompt,
  fetchImpl: FetchLike,
): Promise<string> {
  const response = await fetchImpl(resolveEndpoint(provider, 'chat/completions'), {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: prompt.model,
      temperature: 0.2,
      max_tokens: prompt.maxTokens ?? DEFAULT_GENERATE_MAX_TOKENS,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: prompt.system },
        { role: 'user', content: prompt.user },
      ],
    }),
  })

  if (!response.ok) throw new AiProviderRequestError(safeProviderError(response.status), response.status)
  const payload = await response.json() as {
    choices?: Array<{ message?: { content?: string } }>
  }
  const content = payload.choices?.[0]?.message?.content
  if (!content) throw new AiProviderRequestError('The provider returned an empty response.')
  return content
}

async function callAnthropic(
  provider: SavedAiProvider | PublicAiProvider,
  apiKey: string,
  prompt: ProviderPrompt,
  fetchImpl: FetchLike,
): Promise<string> {
  const response = await fetchImpl(resolveEndpoint(provider, 'messages'), {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: prompt.model,
      max_tokens: prompt.maxTokens ?? DEFAULT_GENERATE_MAX_TOKENS,
      system: prompt.system,
      messages: [{ role: 'user', content: prompt.user }],
    }),
  })

  if (!response.ok) throw new AiProviderRequestError(safeProviderError(response.status), response.status)
  const payload = await response.json() as { content?: Array<{ type: string; text?: string }> }
  const text = payload.content?.find((part) => part.type === 'text')?.text
  if (!text) throw new AiProviderRequestError('The provider returned an empty response.')
  return text
}

function resolveEndpoint(provider: SavedAiProvider | PublicAiProvider, suffix: string): string {
  if (provider.useFullUrl) return provider.apiBaseUrl
  return `${provider.apiBaseUrl.replace(/\/+$/, '')}/${suffix}`
}

function resolveModelsEndpoint(provider: SavedAiProvider | PublicAiProvider): string {
  if (provider.useFullUrl) {
    throw new AiProviderRequestError('Model list fetching needs a base API URL. Turn off Full URL or enter the provider base URL, then retry.')
  }
  return `${provider.apiBaseUrl.replace(/\/+$/, '')}/models`
}

function parseProviderModels(payload: unknown): AiProviderModel[] {
  const data = isRecord(payload) && Array.isArray(payload.data)
    ? payload.data
    : Array.isArray(payload)
      ? payload
      : null
  if (!data) throw new AiProviderRequestError('The provider returned a model list Flowent could not read.')

  const seen = new Set<string>()
  const models: AiProviderModel[] = []
  for (const item of data) {
    const id = typeof item === 'string'
      ? item.trim()
      : isRecord(item) && typeof item.id === 'string'
        ? item.id.trim()
        : ''
    if (!id || seen.has(id)) continue
    seen.add(id)

    const label = isRecord(item)
      ? firstString(item.name, item.display_name, item.label)
      : undefined
    models.push(label && label !== id ? { id, label } : { id })
  }

  if (models.length === 0) throw new AiProviderRequestError('The provider returned no selectable models.')
  return models
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function firstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value !== 'string') continue
    const trimmed = value.trim()
    if (trimmed) return trimmed
  }
  return undefined
}

function parseJsonObject(content: string): unknown {
  const trimmed = content.trim()
  try {
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) return JSON.parse(trimmed)
    const start = trimmed.indexOf('{')
    const end = trimmed.lastIndexOf('}')
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1))
    }
  } catch {
    throw invalidJsonResponseError()
  }
  throw invalidJsonResponseError()
}

function tryParseJsonObject(content: string): { ok: true; data: unknown } | { ok: false; error: AiProviderRequestError } {
  try {
    return { ok: true, data: parseJsonObject(content) }
  } catch (error) {
    if (error instanceof AiProviderRequestError) return { ok: false, error }
    throw error
  }
}

function invalidJsonResponseError(): AiProviderRequestError {
  return new AiProviderRequestError('The provider returned invalid JSON. Flowent needs the full JSON object with complete arrays and objects; do not abbreviate with ellipses.')
}

function isProviderRateLimitError(error: unknown): error is AiProviderRequestError {
  return error instanceof AiProviderRequestError && error.status === 429
}

function clipText(value: string, maxLength: number): string {
  return value.length <= maxLength ? value : `${value.slice(0, maxLength)}\n[truncated]`
}

function buildFlowentGenerationStandard(options: { compact?: boolean; profile?: ProcessAnalysisProfile } = {}): string[] {
  const nodeLimit = options.compact
    ? 'Focus on the smallest useful mainline: use at most 8 activity nodes and at most 7 sequential edges.'
    : 'Output 4-8 activity nodes when the source supports it; use fewer for simple text and at most 10 activity nodes.'

  return [
    'Flowent process map generation standard:',
    'Before writing JSON, silently identify the process goal, start trigger, mainline path, and end state.',
    nodeLimit,
    'Focus on the activity mainline first. Merge minor notes, policy text, branches, documents, and explanations into short activity titles or missingInformation.',
    'Do not create Start or End nodes. Flowent automatically adds Start before the first core node and End after the last core node.',
    'Order nodes in reading order from trigger to end state. The first node should be the first real work step after the trigger; the last node should represent the done/closed/archived state.',
    'Use activity nodes only. Do not output decision, stage, or bottleneck nodes in this generation mode.',
    'Connect the activity nodes in a single readable sequence. Use one edge from each activity to the next activity, with empty labels unless a short transition is essential.',
    'Activity nodes may include RASIC responsibilities when people or roles are explicit or strongly implied. Responsible must contain at most one person or role; use accountable, supporting, consulted, or informed for additional people.',
    'Recognize input and output work products when documents, reports, records, files, templates, or deliverables are explicit. Put them in activity inputs/outputs with workProductId and maturity such as Needed, Draft, Review ready, Approved, or Released.',
    ...buildIndustryProfileGuidance(options.profile),
    'Activities may include processStage with kind value-add, wait, or rework. Use wait or rework only when the source supports that classification; ordinary work may use inferred value-add.',
    'Include P50, P90, or WIP only when those measurements are explicit in the source. Never estimate or infer a duration or WIP value. Omit unknown measurements so Flowent can show the data gap.',
    'Return top-level workProducts only for those input/output references. Return guidanceItems and milestones as empty arrays. Do not create guidance, milestone, stage, decision, or branch assets in this generation mode.',
    'If the source contains decisions, risks, approvals, loops, exceptions, or branches, represent only the main activity checkpoint as an activity node and put uncertainty in missingInformation.',
    'Put uncertain inferred content in missingInformation. Do not invent fake people, roles, steps, documents, approvals, assets, or branches.',
  ]
}

function buildCompactJsonSystemPrompt(profile?: ProcessAnalysisProfile): string {
  return [
    'You generate compact Flowent activity mainline JSON for aligned product teams.',
    'Return a compact Flowent activity mainline JSON object only. Do not include markdown.',
    'Do not use ellipses (...), comments, placeholders, trailing commas, or abbreviated arrays.',
    'Do not return a GraphDocument envelope, document wrapper, API preview envelope, or markdown fence.',
    ...buildFlowentGenerationStandard({ compact: true, profile }),
    'Use only these top-level keys: title, summary, processAnalysis, nodes, edges, workProducts, guidanceItems, milestones, assumptions, risks, missingInformation.',
    'Prefer a small but complete activity mainline over a large map: keep node titles short and omit optional node fields.',
    'Each node must include id, type, and title. Node type must be activity.',
    'Each edge must include id, sourceNodeId, targetNodeId, and an empty label unless a very short transition is essential.',
    'Use empty arrays [] for guidanceItems, milestones, assumptions, risks, and missingInformation when unsure. Use workProducts only when tied to node inputs or outputs.',
  ].join('\n')
}

function buildCompactJsonUserPrompt(inputText: string, previousResponse: string, profile?: ProcessAnalysisProfile): string {
  return [
    'The previous response was not valid JSON. Generate a smaller Flowent map now.',
    'Use at most 8 nodes and at most 10 edges.',
    'Return a small activity-only mainline from trigger to end state.',
    'Return complete arrays only. If unsure, leave optional arrays empty.',
    'Do not copy invalid JSON from the previous response.',
    ...(profile ? [`Keep the selected ${getProcessIntelligenceProfile(profile).label} context.`] : []),
    '',
    'Original source text:',
    clipText(inputText, 12000),
    '',
    'Previous invalid response:',
    clipText(previousResponse, 2500),
  ].join('\n')
}

function safeProviderError(status: number): string {
  if (status === 401 || status === 403) return 'The selected provider rejected the API key or permissions.'
  if (status === 404) return 'The selected provider endpoint or model could not be found.'
  if (status === 429) return 'Provider returned HTTP 429 (rate limit). Flowent is not applying this limit; wait a moment or choose another provider, key, or model.'
  if (status >= 500) return 'The selected provider is unavailable right now. Please retry shortly.'
  return 'The selected provider could not generate a Flowent map right now.'
}

function safeProviderModelListError(status: number): string {
  if (status === 401 || status === 403) return 'The selected provider rejected the API key or permissions.'
  if (status === 404) return 'The selected provider does not expose a model list endpoint. Enter the model manually or check the API URL.'
  if (status === 429) return 'The selected provider is rate limiting model list requests. Please retry shortly.'
  if (status >= 500) return 'The selected provider is unavailable right now. Please retry shortly.'
  return 'Flowent could not fetch models from the selected provider.'
}

function buildSystemPrompt(profile?: ProcessAnalysisProfile): string {
  return [
    'You generate Flowent process maps for aligned product teams.',
    'Return a single JSON object only. Do not include markdown.',
    'Do not use ellipses (...), comments, placeholders, trailing commas, or abbreviated arrays.',
    'Every array must contain complete objects or be an empty array [].',
    ...buildFlowentGenerationStandard({ profile }),
    'Use the schema fields: title, summary, processAnalysis, nodes, edges, workProducts, guidanceItems, milestones, assumptions, risks, missingInformation.',
    'Do not return a document wrapper, GraphDocument nodes object, or API preview envelope.',
    'The top-level nodes, edges, workProducts, guidanceItems, and milestones fields must be arrays.',
    'Node types must be activity only in this generation mode.',
    'Activities may include responsibilities, processStage, and input/output work product maturity refs, but guidanceIds must be empty.',
    'The support arrays guidanceItems and milestones must be empty arrays. workProducts may contain only assets referenced by activity inputs or outputs.',
  ].join('\n')
}

function buildIndustryProfileGuidance(profile: ProcessAnalysisProfile | undefined): string[] {
  if (!profile) return []
  const selected = getProcessIntelligenceProfile(profile)
  return [
    `Selected Process intelligence profile: ${selected.label}.`,
    `Industry interpretation: ${selected.generationGuidance}`,
    'Use the industry context only to interpret explicit source material. Do not invent approvals, regulations, people, roles, or work products.',
  ]
}

function buildUserPrompt(inputText: string): string {
  return [
    'Create a Flowent activity-only mainline process draft from this source text.',
    'Focus on the main process, not every sentence. Identify the trigger, the first real work step, the main activity points, and the end state.',
    'Use only activity nodes and connect them in one clear sequence. Do not create decisions, branches, guidance, milestones, or other support content.',
    'You may infer activity responsibilities from explicit people or roles in the source; keep Responsible to one person or role per activity and place extra people in A/S/C/I responsibilities.',
    'Also infer input and output work products from explicit documents, reports, records, files, templates, or deliverables, including their maturity when the source implies draft, review, approved, released, archived, or needed status.',
    'If the source is short or partial, still produce the best complete activity mainline and place gaps in missingInformation.',
    '',
    inputText,
  ].join('\n')
}

function buildFallbackDraftFromSource(inputText: string, reason = FALLBACK_INVALID_JSON_MESSAGE): AiMapDraft {
  const stepTitles = extractFallbackStepTitles(inputText)
  const nodes = stepTitles.map((title, index) => ({
    id: `step-${index + 1}`,
    type: 'activity' as const,
    title,
    summary: '',
    expectations: '',
    criteria: '',
    decisionOutcomes: [],
    owner: '',
    goal: '',
    entryCondition: '',
    exitCondition: '',
    symptom: '',
    impact: '',
    suspectedCause: '',
    responsibilities: inferResponsibilitiesForActivityTitle(title, `step-${index + 1}`),
    inputs: [],
    outputs: [],
    guidanceIds: [],
  }))
  const edges = nodes.slice(0, -1).map((node, index) => ({
    id: `handoff-step-${index + 1}-step-${index + 2}`,
    sourceNodeId: node.id,
    targetNodeId: nodes[index + 1].id,
    label: '',
    fromRole: '',
    toRole: '',
    artifact: '',
    expectation: '',
    readinessSignal: '',
    workProductIds: [],
  }))

  return {
    title: 'AI generated process draft',
    summary: 'Fallback draft generated from the source text because the selected provider did not return a usable Flowent map.',
    generationMode: 'activity-mainline',
    nodes,
    edges,
    workProducts: [],
    guidanceItems: [],
    milestones: [],
    assumptions: [],
    risks: [],
    missingInformation: [reason],
  }
}

function extractFallbackStepTitles(inputText: string): string[] {
  const normalized = inputText.replace(/\r\n?/g, '\n').trim()
  const numberedSteps = extractNumberedSteps(normalized)
  const candidates = numberedSteps.length > 0
    ? numberedSteps
    : normalized
      .split(/\n+|[。；;]+/)
      .map((part) => cleanStepTitle(part))
      .filter(Boolean)

  const uniqueTitles: string[] = []
  for (const candidate of candidates) {
    const title = clipFallbackTitle(candidate)
    if (!title || uniqueTitles.includes(title)) continue
    uniqueTitles.push(title)
    if (uniqueTitles.length >= 8) break
  }

  return uniqueTitles.length > 0 ? uniqueTitles : ['Review source process']
}

function extractNumberedSteps(inputText: string): string[] {
  const steps: string[] = []
  const stepPattern = /(?:^|[\n。；;.])\s*(?:步骤|step)\s*\d+\s*(?:[（(][^)）]+[)）])?\s*[:：、.-]?\s*([\s\S]*?)(?=(?:[\n。；;.]\s*(?:步骤|step)\s*\d+\s*(?:[（(][^)）]+[)）])?\s*[:：、.-]?)|$)/gi
  for (const match of inputText.matchAll(stepPattern)) {
    const title = cleanStepTitle(match[1])
    if (title) steps.push(title)
  }
  return steps
}

function cleanStepTitle(value: string): string {
  const withoutStepPrefix = value
    .replace(/^\s*(?:[-*•]|\d+[).、]|步骤\s*\d+\s*(?:[（(][^)）]+[)）])?\s*[:：、.-]?|step\s*\d+\s*(?:[（(][^)）]+[)）])?\s*[:：、.-]?)\s*/i, '')
  const firstSentence = withoutStepPrefix.split(/[。；;]/)[0] ?? withoutStepPrefix
  const activityTitle = firstSentence.split(/——|--|\s+-\s+/)[0] ?? firstSentence
  return activityTitle
    .replace(/\s+/g, ' ')
    .replace(/^[：:、.\-\s]+|[。；;.\s]+$/g, '')
    .trim()
}

function clipFallbackTitle(value: string): string {
  const title = value.trim()
  return title.length <= 72 ? title : `${title.slice(0, 71)}…`
}

function inferResponsibilitiesForActivityTitle(
  title: string,
  nodeId: string,
): AiMapDraft['nodes'][number]['responsibilities'] {
  const roles = inferRolesFromText(title)
  return normalizeDraftResponsibilities(
    nodeId,
    roles.map((roleName, index) => ({
      roleName,
      kind: index === 0 ? 'responsible' : 'supporting',
    })),
  )
}

function inferRolesFromText(text: string): string[] {
  const acronymRoles: string[] = []
  const acronymMatches = text.match(/\b[A-Z][A-Z0-9]{1,9}\b/g) ?? []
  for (const role of acronymMatches) {
    if (['DVP', 'PDF', 'JSON', 'CSV', 'API'].includes(role) || /^X+$/.test(role)) continue
    acronymRoles.push(role)
  }

  // Acronym roles such as DRE, SVE, and CEM are the most precise signal in
  // process source. Do not also interpret the surrounding work-product text
  // as a person's role.
  if (acronymRoles.length > 0) return [...new Set(acronymRoles)]

  const roles: string[] = []

  const rolePatterns = [
    /由\s*([\p{Script=Han}A-Za-z0-9/_ -]{1,24}?)(?:会同|负责|进行|编制|评审|审核|审批|登记|归档|完成)/gu,
    /([\p{Script=Han}A-Za-z0-9/_ -]{1,24}?)(?:负责|编制|评审|审核|审批|登记|归档|完成)/gu,
  ]
  for (const pattern of rolePatterns) {
    for (const match of text.matchAll(pattern)) {
      const role = cleanInferredRole(match[1] ?? '')
      if (role) roles.push(role)
    }
  }

  const englishRolePatterns = [
    /\b([A-Z][A-Za-z]+(?:\s+(?:[A-Z][A-Za-z]+|Manager|Engineer|Lead|Owner|Reviewer|Coordinator)){0,3})\s+(?:is\s+)?(?:responsible\s+for|defines|reviews|approves|prepares|creates|conducts|balances|archives|registers|assesses)\b/g,
  ]
  for (const pattern of englishRolePatterns) {
    for (const match of text.matchAll(pattern)) {
      const role = cleanInferredRole(match[1] ?? '')
      if (role) roles.push(role)
    }
  }

  return [...new Set(roles)]
}

function cleanInferredRole(value: string): string {
  const cleaned = value
    .replace(/^[，。；;:：、\s]+|[，。；;:：、\s]+$/g, '')
    .replace(/^(首先|然后|并由|再由|以及|和|与)\s*/g, '')
    .trim()
  if (!cleaned || cleaned.length > 24) return ''
  if (/^(任何|所有|如果|需要|必须|对于|仅低风险项|高风险|低风险|中风险)$/.test(cleaned)) return ''
  return cleaned
}

function simplifyDraftToActivityMainline(draft: AiMapDraft, inputText = ''): AiMapDraft {
  if (!Array.isArray(draft.nodes) || draft.nodes.length === 0) return draft

  const sourceRoleContexts = extractSourceRoleContexts(inputText)

  const nodes = draft.nodes.map((node, index) => ({
    id: node.id || `activity-${index + 1}`,
    type: 'activity' as const,
    title: node.title,
    summary: '',
    expectations: '',
    criteria: '',
    decisionOutcomes: [] as string[],
    owner: '',
    goal: '',
    entryCondition: '',
    exitCondition: '',
    symptom: '',
    impact: '',
    suspectedCause: '',
    ...(node.processStage ? { processStage: node.processStage } : {}),
    responsibilities: resolveDraftResponsibilities(
      node.id || `activity-${index + 1}`,
      node.responsibilities,
      sourceRoleContexts[index] ?? '',
    ),
    inputs: normalizeDraftWorkProductRefs(node.inputs),
    outputs: normalizeDraftWorkProductRefs(node.outputs),
    guidanceIds: [],
  }))
  const edges = nodes.slice(0, -1).map((node, index) => ({
    id: `handoff-${node.id}-${nodes[index + 1].id}`,
    sourceNodeId: node.id,
    targetNodeId: nodes[index + 1].id,
    label: '',
    fromRole: '',
    toRole: '',
    artifact: '',
    expectation: '',
    readinessSignal: '',
    workProductIds: [],
  }))

  return {
    ...draft,
    generationMode: 'activity-mainline',
    nodes,
    edges,
    workProducts: collectMainlineWorkProducts(draft, nodes),
    guidanceItems: [],
    milestones: [],
    assumptions: [],
    risks: [],
    missingInformation: draft.missingInformation ?? [],
  }
}

function normalizeDraftWorkProductRefs(
  refs: AiMapDraft['nodes'][number]['inputs'] | undefined,
): AiMapDraft['nodes'][number]['inputs'] {
  const seen = new Set<string>()
  const normalized: AiMapDraft['nodes'][number]['inputs'] = []
  for (const ref of refs ?? []) {
    const workProductId = ref.workProductId?.trim()
    if (!workProductId) continue
    const maturity = (ref.maturity || 'Draft').trim() || 'Draft'
    const key = `${workProductId.toLowerCase()}:${maturity.toLowerCase()}`
    if (seen.has(key)) continue
    seen.add(key)
    normalized.push({ workProductId, maturity })
  }
  return normalized
}

function collectMainlineWorkProducts(
  draft: AiMapDraft,
  nodes: AiMapDraft['nodes'],
): AiMapDraft['workProducts'] {
  const needed = new Map<string, string>()
  for (const node of nodes) {
    for (const ref of [...node.inputs, ...node.outputs]) {
      if (!needed.has(ref.workProductId)) needed.set(ref.workProductId, ref.maturity)
    }
  }

  if (needed.size === 0) return []

  const sourceAssets = new Map((draft.workProducts ?? []).map((asset) => [asset.id, asset]))
  return Array.from(needed.entries()).map(([id, maturity]) => {
    const asset = sourceAssets.get(id)
    if (asset) {
      return {
        id: asset.id,
        title: asset.title,
        state: asset.state || maturity || 'Draft',
        description: asset.description ?? '',
      }
    }
    return {
      id,
      title: titleFromWorkProductId(id),
      state: maturity || 'Draft',
      description: '',
    }
  })
}

function titleFromWorkProductId(id: string): string {
  return id
    .replace(/^wp[-_]/i, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase()) || id
}

function normalizeDraftResponsibilities(
  nodeId: string,
  responsibilities: AiMapDraft['nodes'][number]['responsibilities'] | undefined,
): AiMapDraft['nodes'][number]['responsibilities'] {
  return normalizeActivityResponsibilities(responsibilities ?? [], { nodeId }).map((responsibility) => ({
    roleName: responsibility.roleName,
    kind: responsibility.kind,
  }))
}

function resolveDraftResponsibilities(
  nodeId: string,
  responsibilities: AiMapDraft['nodes'][number]['responsibilities'] | undefined,
  sourceContext: string,
): AiMapDraft['nodes'][number]['responsibilities'] {
  const normalized = normalizeDraftResponsibilities(nodeId, responsibilities)
  if (normalized.some((responsibility) => responsibility.kind === 'responsible')) return normalized

  const inferredRoles = inferRolesFromText(sourceContext)
  if (inferredRoles.length > 0) {
    return normalizeDraftResponsibilities(nodeId, [
      { roleName: inferredRoles[0], kind: 'responsible' },
      ...inferredRoles.slice(1).map((roleName) => ({ roleName, kind: 'supporting' as const })),
      ...normalized,
    ])
  }

  if (normalized.length === 0) return normalized
  return normalizeDraftResponsibilities(nodeId, [
    { ...normalized[0], kind: 'responsible' },
    ...normalized.slice(1),
  ])
}

function extractSourceRoleContexts(inputText: string): string[] {
  const lines = inputText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
  const numbered = lines.filter((line) => /(?:步骤|step)\s*\d+/i.test(line))
  if (numbered.length > 0) return numbered
  return inputText
    .split(/[。；;\n]+/)
    .map((segment) => segment.trim())
    .filter(Boolean)
}
