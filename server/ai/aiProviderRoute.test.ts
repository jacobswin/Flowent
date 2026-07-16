import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createAiRouteHandler } from './aiRoute'

let dir: string
let libraryFile: string
let masterKeyFile: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'flowent-ai-route-'))
  libraryFile = join(dir, 'library.json')
  masterKeyFile = join(dir, 'flowent-ai-master.key')
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

function createHandle(fetchImpl = vi.fn()) {
  return createAiRouteHandler({ filePath: libraryFile, masterKeyFile, fetchImpl })
}

describe('aiRoute providers', () => {
  it('creates providers without returning plaintext API keys', async () => {
    const handle = createHandle()

    const res = await handle(new Request('http://test/api/ai/providers', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'Custom Provider',
        presetId: 'custom-openai-compatible',
        protocol: 'openai-compatible',
        apiBaseUrl: 'https://llm.example.com/v1',
        useFullUrl: false,
        model: 'flow-model',
        apiKey: 'sk-user-owned-secret',
        isDefault: true,
      }),
    }))

    expect(res.status).toBe(201)
    const body = await res.json() as { data: { provider: { apiKey?: string, hasApiKey: boolean, maskedApiKey: string } } }
    expect(body.data.provider.apiKey).toBeUndefined()
    expect(body.data.provider.hasApiKey).toBe(true)
    expect(body.data.provider.maskedApiKey).toBe('sk-u...cret')

    const get = await handle(new Request('http://test/api/ai/providers'))
    const getBody = await get.json() as { data: { providers: Array<{ apiKey?: string, maskedApiKey: string }> } }
    expect(getBody.data.providers[0].apiKey).toBeUndefined()
    expect(getBody.data.providers[0].maskedApiKey).toBe('sk-u...cret')
  })

  it('tests an OpenAI-compatible provider with the saved user key', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      choices: [{ message: { content: '{"ok":true}' } }],
    }), { status: 200, headers: { 'content-type': 'application/json' } }))
    const handle = createHandle(fetchImpl)

    const create = await handle(new Request('http://test/api/ai/providers', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'OpenRouter',
        presetId: 'openrouter',
        protocol: 'openai-compatible',
        apiBaseUrl: 'https://openrouter.ai/api/v1',
        useFullUrl: false,
        model: 'openai/gpt-4.1-mini',
        apiKey: 'sk-user-owned-secret',
        isDefault: true,
      }),
    }))
    const { data } = await create.json() as { data: { provider: { id: string } } }

    const test = await handle(new Request(`http://test/api/ai/providers/${data.provider.id}/test`, { method: 'POST' }))

    expect(test.status).toBe(200)
    expect(fetchImpl).toHaveBeenCalledOnce()
    const [url, init] = (fetchImpl.mock.calls as unknown as Array<[string, RequestInit]>)[0]
    expect(url).toBe('https://openrouter.ai/api/v1/chat/completions')
    expect((init as RequestInit).headers).toMatchObject({ authorization: 'Bearer sk-user-owned-secret' })
  })
})

describe('aiRoute model list', () => {
  it('fetches models from an unsaved provider config without saving the key', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      data: [{ id: 'model-a' }, { id: 'model-b', name: 'Model B' }],
    }), { status: 200, headers: { 'content-type': 'application/json' } }))
    const handle = createHandle(fetchImpl)

    const res = await handle(new Request('http://test/api/ai/models', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        protocol: 'openai-compatible',
        apiBaseUrl: 'https://llm.example.com/v1',
        useFullUrl: false,
        apiKey: 'sk-temporary-user-key',
      }),
    }))

    expect(res.status).toBe(200)
    const body = await res.json() as { data: { models: Array<{ id: string; label?: string }> } }
    expect(body.data.models).toEqual([{ id: 'model-a' }, { id: 'model-b', label: 'Model B' }])
    expect(fetchImpl).toHaveBeenCalledWith('https://llm.example.com/v1/models', expect.objectContaining({
      headers: expect.objectContaining({ authorization: 'Bearer sk-temporary-user-key' }),
    }))

    const providers = await handle(new Request('http://test/api/ai/providers'))
    const providersBody = await providers.json() as { data: { providers: unknown[] } }
    expect(providersBody.data.providers).toEqual([])
  })

  it('fetches models for a saved provider using the encrypted key', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      data: [{ id: 'saved-model' }],
    }), { status: 200, headers: { 'content-type': 'application/json' } }))
    const handle = createHandle(fetchImpl)
    const create = await handle(new Request('http://test/api/ai/providers', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'Saved Provider',
        presetId: 'custom-openai-compatible',
        protocol: 'openai-compatible',
        apiBaseUrl: 'https://saved.example.com/v1',
        useFullUrl: false,
        model: 'manual-model',
        apiKey: 'sk-saved-user-key',
        isDefault: true,
      }),
    }))
    const { data } = await create.json() as { data: { provider: { id: string } } }

    const res = await handle(new Request('http://test/api/ai/models', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ providerId: data.provider.id }),
    }))

    expect(res.status).toBe(200)
    const body = await res.json() as { data: { models: Array<{ id: string }> } }
    expect(body.data.models).toEqual([{ id: 'saved-model' }])
    expect(fetchImpl).toHaveBeenCalledWith('https://saved.example.com/v1/models', expect.objectContaining({
      headers: expect.objectContaining({ authorization: 'Bearer sk-saved-user-key' }),
    }))
  })
})

describe('aiRoute generate map', () => {
  it('generates a GraphDocument draft from pasted text and never writes the library directly', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      choices: [{
        message: {
          content: JSON.stringify({
            title: 'Bug triage',
            summary: 'Support triages customer defects.',
            nodes: [
              { id: 'activity-triage', type: 'activity', title: 'Triage defect', summary: 'Assess severity', responsibilities: [{ roleName: 'Support', kind: 'responsible' }], inputs: [{ workProductId: 'wp-ticket', maturity: 'Needed' }], outputs: [{ workProductId: 'wp-ticket', maturity: 'Approved' }] },
              { id: 'decision-priority', type: 'decision', title: 'Escalate?', criteria: 'Severity and customer impact', owner: 'Support Lead', decisionOutcomes: ['Escalate', 'Monitor'] },
            ],
            edges: [
              { id: 'handoff-triage-decision', sourceNodeId: 'activity-triage', targetNodeId: 'decision-priority', label: 'Priority check' },
            ],
            workProducts: [
              { id: 'wp-ticket', title: 'Defect ticket', state: 'Needed', description: 'Customer defect record' },
            ],
            guidanceItems: [
              { id: 'guide-severity', title: 'Severity checklist', kind: 'checklist', description: 'Questions for severity', appliesToNodeIds: ['activity-triage'], workProductIds: ['wp-ticket'] },
            ],
            milestones: [],
            assumptions: ['Severity labels are already defined.'],
            risks: ['Escalation owner may be unclear.'],
            missingInformation: [],
          }),
        },
      }],
    }), { status: 200, headers: { 'content-type': 'application/json' } }))
    const handle = createHandle(fetchImpl)
    const create = await handle(new Request('http://test/api/ai/providers', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'Custom',
        presetId: 'custom-openai-compatible',
        protocol: 'openai-compatible',
        apiBaseUrl: 'https://llm.example.com/v1',
        useFullUrl: false,
        model: 'flow-model',
        apiKey: 'sk-user-owned-secret',
        isDefault: true,
      }),
    }))
    const { data: providerData } = await create.json() as { data: { provider: { id: string } } }

    const generate = await handle(new Request('http://test/api/ai/generate-map', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        providerId: providerData.provider.id,
        inputText: 'Support triages customer defects.',
        processAnalysis: { profile: 'automotive', wip: 4 },
      }),
    }))

    expect(generate.status).toBe(200)
    const body = await generate.json() as {
      data: {
        title: string
        document: {
          nodes: Record<string, { title: string; type: string }>
          edges: Record<string, { label: string; sourceNodeId: string; targetNodeId: string }>
          processAssets: { workProducts: Record<string, { activityLinks: Array<{ relation: string; maturity: string }> }> }
          meta: { processAnalysis?: { profile: string; wip?: number } }
        }
        findings: { kind: string; message: string }[]
      }
    }
    expect(body.data.title).toBe('Bug triage')
    expect(body.data.document.nodes.start.title).toBe('Start')
    expect(body.data.document.nodes['activity-triage'].title).toBe('Triage defect')
    expect(body.data.document.nodes['decision-priority']).toMatchObject({
      type: 'activity',
      title: 'Escalate?',
    })
    expect(body.data.document.edges['handoff-activity-triage-decision-priority']).toMatchObject({
      sourceNodeId: 'activity-triage',
      targetNodeId: 'decision-priority',
      label: '',
    })
    expect(body.data.document.processAssets.workProducts).toEqual({
      'wp-ticket': expect.objectContaining({
        producerNodeIds: ['activity-triage'],
        consumerNodeIds: ['activity-triage'],
        activityLinks: expect.arrayContaining([
          expect.objectContaining({ relation: 'input', maturity: 'Needed' }),
          expect.objectContaining({ relation: 'output', maturity: 'Approved' }),
        ]),
      }),
    })
    expect(body.data.document.meta.processAnalysis).toEqual({ profile: 'automotive', wip: 4 })
    const [, generateRequest] = (fetchImpl.mock.calls as unknown as Array<[string, RequestInit]>)[0]
    const providerPrompt = JSON.parse(String(generateRequest.body)) as { messages: Array<{ content: string }> }
    expect(providerPrompt.messages[0].content).toContain('Automotive Development')
    expect(body.data.findings).toEqual([])
  })

  it('returns a fallback map when provider JSON stays abbreviated', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      choices: [{ message: { content: '{"title":"Abbreviated","nodes":[...],"edges":[]}' } }],
    }), { status: 200, headers: { 'content-type': 'application/json' } }))
    const handle = createHandle(fetchImpl)
    const create = await handle(new Request('http://test/api/ai/providers', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'Custom',
        presetId: 'custom-openai-compatible',
        protocol: 'openai-compatible',
        apiBaseUrl: 'https://llm.example.com/v1',
        useFullUrl: false,
        model: 'flow-model',
        apiKey: 'sk-user-owned-secret',
        isDefault: true,
      }),
    }))
    const { data: providerData } = await create.json() as { data: { provider: { id: string } } }

    const generate = await handle(new Request('http://test/api/ai/generate-map', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ providerId: providerData.provider.id, inputText: 'Step 1: Collect defect report. Step 2: Triage severity. Step 3: Archive decision.' }),
    }))

    expect(generate.status).toBe(200)
    const body = await generate.json() as {
      data: {
        title: string
        document: {
          nodes: Record<string, { title: string }>
          edges: Record<string, { sourceNodeId: string; targetNodeId: string }>
        }
        findings: { kind: string; message: string }[]
      }
    }
    expect(body.data.title).toBe('AI generated process draft')
    expect(body.data.document.nodes.start.title).toBe('Start')
    expect(body.data.document.nodes['step-1'].title).toBe('Collect defect report')
    expect(Object.values(body.data.document.edges)).toEqual(expect.arrayContaining([
      expect.objectContaining({ sourceNodeId: 'step-1', targetNodeId: 'step-2' }),
      expect.objectContaining({ sourceNodeId: 'step-2', targetNodeId: 'step-3' }),
    ]))
    expect(body.data.findings).toContainEqual({
      kind: 'missing-information',
      message: 'The selected provider returned invalid JSON, so Flowent generated a fallback mainline from the source text.',
    })
  })

  it('returns a fallback map when the provider rate limits generation', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      error: { message: 'too many requests' },
    }), { status: 429, headers: { 'content-type': 'application/json' } }))
    const handle = createHandle(fetchImpl)
    const create = await handle(new Request('http://test/api/ai/providers', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'Custom',
        presetId: 'custom-openai-compatible',
        protocol: 'openai-compatible',
        apiBaseUrl: 'https://llm.example.com/v1',
        useFullUrl: false,
        model: 'flow-model',
        apiKey: 'sk-user-owned-secret',
        isDefault: true,
      }),
    }))
    const { data: providerData } = await create.json() as { data: { provider: { id: string } } }

    const generate = await handle(new Request('http://test/api/ai/generate-map', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ providerId: providerData.provider.id, inputText: 'Step 1: Review deviation. Step 2: Assess risk. Step 3: Archive decision.' }),
    }))

    expect(generate.status).toBe(200)
    const body = await generate.json() as {
      data: {
        document: {
          nodes: Record<string, { title: string }>
          edges: Record<string, { sourceNodeId: string; targetNodeId: string }>
        }
        findings: { kind: string; message: string }[]
      }
    }
    expect(body.data.document.nodes.start.title).toBe('Start')
    expect(body.data.document.nodes['step-1'].title).toBe('Review deviation')
    expect(Object.values(body.data.document.edges)).toEqual(expect.arrayContaining([
      expect.objectContaining({ sourceNodeId: 'step-1', targetNodeId: 'step-2' }),
      expect.objectContaining({ sourceNodeId: 'step-2', targetNodeId: 'step-3' }),
    ]))
    expect(body.data.findings).toContainEqual({
      kind: 'missing-information',
      message: 'The selected provider returned HTTP 429 (rate limit), so Flowent generated a fallback mainline from the source text.',
    })
  })

  it('returns a structured DVP preview when a rate-limited provider falls back to source text', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      error: { message: 'too many requests' },
    }), { status: 429, headers: { 'content-type': 'application/json' } }))
    const handle = createHandle(fetchImpl)
    const create = await handle(new Request('http://test/api/ai/providers', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'Custom',
        presetId: 'custom-openai-compatible',
        protocol: 'openai-compatible',
        apiBaseUrl: 'https://llm.example.com/v1',
        useFullUrl: false,
        model: 'flow-model',
        apiKey: 'sk-user-owned-secret',
        isDefault: true,
      }),
    }))
    const { data: providerData } = await create.json() as { data: { provider: { id: string } } }

    const generate = await handle(new Request('http://test/api/ai/generate-map', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        providerId: providerData.provider.id,
        inputText: [
          '步骤0（前置）：风险评估——任何DVP试验偏差产生后，首先由SVE会同DRE进行风险评估，确定风险类型与等级。',
          '高风险/违反法规项直接禁止偏差，必须整改，仅低风险项进入后续流程。',
          '步骤1：DRE编制DVP 偏差/修正-XX项目-XX零部件评审报告。',
          '步骤2：SVE登记，工作层评审。',
          '步骤3：属性集成会二级评审。',
          '步骤4：CEM会三级评审。',
          '步骤5：DVP正式修订/升版。',
          '步骤6：SVE归档试验报告及所有评审记录、风险评估报告等归档材料。',
          '（可选）临时偏差：对于低风险项，可设定临时偏差加限期整改，到期后评估是否转正式修订或要求整改。',
        ].join('\n'),
      }),
    }))

    expect(generate.status).toBe(200)
    const body = await generate.json() as {
      data: {
        document: {
          meta: { layoutProfile?: string; layoutNodeOrder?: string[] }
          nodes: Record<string, { type: string; title: string; x: number; y: number; width: number }>
          edges: Record<string, { label: string; sourceNodeId: string; targetNodeId: string; sourceAnchor?: { side: string }; targetAnchor?: { side: string } }>
        }
      }
    }
    const nodes = body.data.document.nodes
    expect(body.data.document.meta).toMatchObject({
      layoutProfile: 'left-to-right',
      layoutNodeOrder: ['step-1', 'step-2', 'step-3', 'step-4', 'step-5', 'step-6', 'step-7'],
    })
    expect(nodes['step-1']).toMatchObject({ type: 'activity', title: '风险评估' })
    expect(nodes['step-7']).toMatchObject({
      type: 'activity',
      title: 'SVE归档试验报告及所有评审记录、风险评估报告等归档材料',
    })
    expect(['step-1', 'step-2', 'step-3', 'step-4', 'step-5', 'step-6', 'step-7']
      .every((nodeId) => nodes[nodeId].type === 'activity')).toBe(true)
    expect(Object.values(body.data.document.edges)).toEqual(expect.arrayContaining([
      expect.objectContaining({ sourceNodeId: 'step-1', targetNodeId: 'step-2', label: '' }),
      expect.objectContaining({ sourceNodeId: 'step-2', targetNodeId: 'step-3', label: '' }),
      expect.objectContaining({ sourceNodeId: 'step-6', targetNodeId: 'step-7', label: '' }),
    ]))
    expect(nodes['step-2'].x).toBeGreaterThan(nodes['step-1'].x)
    expect(nodes['step-7'].x).toBeGreaterThan(nodes['step-6'].x)
  })
})
