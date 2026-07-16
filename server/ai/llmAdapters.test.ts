import { describe, expect, it, vi } from 'vitest'
import { AiProviderRequestError, generateAiMapDraft, listProviderModels } from './llmAdapters'
import type { PublicAiProvider } from './aiProviderStore'

const openAiProvider: PublicAiProvider = {
  id: 'provider-1',
  name: 'Custom',
  presetId: 'custom-openai-compatible',
  protocol: 'openai-compatible',
  apiBaseUrl: 'https://llm.example.com/v1',
  useFullUrl: false,
  model: 'manual-model',
  websiteUrl: '',
  notes: '',
  hasApiKey: true,
  maskedApiKey: 'sk-t...1234',
  isDefault: true,
}

describe('listProviderModels', () => {
  it('fetches and parses OpenAI-compatible model ids', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      object: 'list',
      data: [
        { id: 'model-a', object: 'model' },
        { id: 'model-b', name: 'Model B' },
      ],
    }), { status: 200, headers: { 'content-type': 'application/json' } }))

    const models = await listProviderModels(openAiProvider, 'sk-user-key', fetchImpl)

    expect(fetchImpl).toHaveBeenCalledWith('https://llm.example.com/v1/models', expect.objectContaining({
      method: 'GET',
      headers: expect.objectContaining({ authorization: 'Bearer sk-user-key' }),
    }))
    expect(models).toEqual([
      { id: 'model-a' },
      { id: 'model-b', label: 'Model B' },
    ])
  })

  it('fetches Anthropic models with Claude headers', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      data: [
        { id: 'claude-sonnet-latest', display_name: 'Claude Sonnet latest' },
      ],
    }), { status: 200, headers: { 'content-type': 'application/json' } }))

    const models = await listProviderModels({
      ...openAiProvider,
      protocol: 'anthropic',
      apiBaseUrl: 'https://api.anthropic.com/v1',
    }, 'sk-ant-user-key', fetchImpl)

    expect(fetchImpl).toHaveBeenCalledWith('https://api.anthropic.com/v1/models', expect.objectContaining({
      method: 'GET',
      headers: expect.objectContaining({
        'x-api-key': 'sk-ant-user-key',
        'anthropic-version': '2023-06-01',
      }),
    }))
    expect(models).toEqual([{ id: 'claude-sonnet-latest', label: 'Claude Sonnet latest' }])
  })

  it('returns safe errors for unsupported full URL configs and unreadable lists', async () => {
    await expect(listProviderModels({ ...openAiProvider, useFullUrl: true }, 'sk-user-key', vi.fn()))
      .rejects.toThrow(AiProviderRequestError)

    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ models: [] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }))
    await expect(listProviderModels(openAiProvider, 'sk-user-key', fetchImpl))
      .rejects.toThrow('model list')
  })
})

describe('generateAiMapDraft', () => {
  it('falls back to a source-text mainline when the provider keeps returning abbreviated JSON', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      choices: [{ message: { content: '{"title":"Abbreviated","nodes":[...],"edges":[]}' } }],
    }), { status: 200, headers: { 'content-type': 'application/json' } }))

    const draft = await generateAiMapDraft({
      provider: openAiProvider,
      apiKey: 'sk-user-key',
      inputText: '步骤0：风险评估。步骤1：DRE 编制 DVP 偏差/修正报告。步骤2：SVE 会同 DRE 审查并归档。',
    }, fetchImpl)

    expect(fetchImpl).toHaveBeenCalledTimes(2)
    expect(draft.title).toBe('AI generated process draft')
    expect(draft.nodes).toEqual([
      expect.objectContaining({ id: 'step-1', type: 'activity', title: '风险评估' }),
      expect.objectContaining({ id: 'step-2', type: 'activity', title: 'DRE 编制 DVP 偏差/修正报告' }),
      expect.objectContaining({ id: 'step-3', type: 'activity', title: 'SVE 会同 DRE 审查并归档' }),
    ])
    expect(draft.edges).toEqual([
      expect.objectContaining({ sourceNodeId: 'step-1', targetNodeId: 'step-2' }),
      expect.objectContaining({ sourceNodeId: 'step-2', targetNodeId: 'step-3' }),
    ])
    expect(draft.missingInformation).toContain('The selected provider returned invalid JSON, so Flowent generated a fallback mainline from the source text.')
  })

  it('instructs OpenAI-compatible providers to generate an activity-only mainline', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify({ title: 'Draft', nodes: [], edges: [] }) } }],
    }), { status: 200, headers: { 'content-type': 'application/json' } }))

    await generateAiMapDraft({
      provider: openAiProvider,
      apiKey: 'sk-user-key',
      inputText: 'Create a small support process.',
    }, fetchImpl)

    const [, init] = (fetchImpl.mock.calls as unknown as Array<[string, RequestInit]>)[0]
    const body = JSON.parse(String(init.body)) as { messages: Array<{ role: string; content: string }>; max_tokens?: number }
    expect(body.max_tokens).toBeGreaterThanOrEqual(3000)
    expect(body.max_tokens).toBeLessThanOrEqual(6000)
    expect(body.messages[0].content).toContain('Do not use ellipses')
    expect(body.messages[0].content).toContain('Do not return a document wrapper')
    expect(body.messages[0].content).toContain('Flowent process map generation standard')
    expect(body.messages[0].content).toContain('process goal')
    expect(body.messages[0].content).toContain('trigger')
    expect(body.messages[0].content).toContain('mainline')
    expect(body.messages[0].content).toContain('end state')
    expect(body.messages[0].content).toContain('4-8 activity nodes')
    expect(body.messages[0].content).toContain('at most 10 activity nodes')
    expect(body.messages[0].content).toContain('Do not create Start or End nodes')
    expect(body.messages[0].content).toContain('Use activity nodes only')
    expect(body.messages[0].content).toContain('Do not output decision, stage, or bottleneck nodes')
    expect(body.messages[0].content).toContain('Connect the activity nodes in a single readable sequence')
    expect(body.messages[0].content).toContain('Activity nodes may include RASIC responsibilities')
    expect(body.messages[0].content).toContain('Responsible must contain at most one person or role')
    expect(body.messages[0].content).toContain('Recognize input and output work products')
    expect(body.messages[0].content).toContain('maturity')
    expect(body.messages[0].content).toContain('Return guidanceItems and milestones as empty arrays')
    expect(body.messages[0].content).toContain('processStage')
    expect(body.messages[0].content).toContain('P50, P90, or WIP only when those measurements are explicit in the source')
    expect(body.messages[0].content).not.toContain('Leave responsibilities')
    expect(body.messages[0].content).toContain('missingInformation')
  })

  it('includes selected industry guidance in both the primary and compact retry prompts', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        choices: [{ message: { content: '{"title":"Abbreviated","nodes":[...],"edges":[]}' } }],
      }), { status: 200, headers: { 'content-type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        choices: [{ message: { content: '{"title":"Still abbreviated","nodes":[...],"edges":[]}' } }],
      }), { status: 200, headers: { 'content-type': 'application/json' } }))

    await generateAiMapDraft({
      provider: openAiProvider,
      apiKey: 'sk-user-key',
      inputText: 'DRE validates the DVP before production release.',
      processAnalysis: { profile: 'automotive' },
    } as never, fetchImpl)

    const requestBodies = (fetchImpl.mock.calls as unknown as Array<[string, RequestInit]>).map(([, init]) =>
      JSON.parse(String(init.body)) as { messages: Array<{ role: string; content: string }> },
    )

    for (const body of requestBodies) {
      expect(body.messages[0].content).toContain('Automotive Development')
      expect(body.messages[0].content).toContain('DVP')
      expect(body.messages[0].content).toContain('Do not invent')
    }
  })

  it('passes direct Chinese source text into a main-process generation prompt', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify({ title: 'Draft', nodes: [], edges: [] }) } }],
    }), { status: 200, headers: { 'content-type': 'application/json' } }))

    await generateAiMapDraft({
      provider: openAiProvider,
      apiKey: 'sk-user-key',
      inputText: '步骤0：风险评估。步骤1：DRE 编制 DVP 偏差/修正报告。',
    }, fetchImpl)

    const [, init] = (fetchImpl.mock.calls as unknown as Array<[string, RequestInit]>)[0]
    const body = JSON.parse(String(init.body)) as { messages: Array<{ role: string; content: string }> }
    expect(body.messages[1].content).toContain('步骤0：风险评估')
    expect(body.messages[1].content).toContain('activity-only mainline')
    expect(body.messages[1].content).toContain('infer activity responsibilities')
    expect(body.messages[1].content).toContain('input and output work products')
    expect(body.messages[1].content).toContain('trigger')
    expect(body.messages[1].content).toContain('end state')
  })

  it('simplifies provider drafts to activity nodes and sequential edges while keeping responsibilities and work products', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify({
        title: 'Deviation handling',
        summary: 'Handle a DVP deviation.',
        nodes: [
          {
            id: 'risk',
            type: 'decision',
            title: 'Assess risk?',
            decisionOutcomes: ['Low', 'High'],
            responsibilities: [
              { roleName: 'DRE', kind: 'responsible' },
              { roleName: 'SVE', kind: 'responsible' },
              { roleName: 'DRE', kind: 'responsible' },
              { roleName: 'QA', kind: 'accountable' },
            ],
            inputs: [{ workProductId: 'wp-risk', maturity: 'Draft' }],
          },
          { id: 'report', type: 'activity', title: 'Write report' },
          { id: 'archive', type: 'stage', title: 'Archive records', goal: 'Closed', outputs: [{ workProductId: 'wp-archive', maturity: 'Released' }] },
        ],
        edges: [
          { id: 'risk-report', sourceNodeId: 'risk', targetNodeId: 'report', label: 'Low' },
          { id: 'risk-archive', sourceNodeId: 'risk', targetNodeId: 'archive', label: 'High' },
        ],
        workProducts: [
          { id: 'wp-risk', title: 'Risk record', state: 'Draft' },
          { id: 'wp-archive', title: 'Archive package', state: 'Released' },
        ],
        guidanceItems: [{ id: 'guide-1', title: 'Checklist', kind: 'checklist' }],
        milestones: [{ id: 'ms-1', title: 'Closed', workProductStates: [] }],
        assumptions: ['Some detail is inferred.'],
        risks: ['Complex branch omitted.'],
        missingInformation: [],
      }) } }],
    }), { status: 200, headers: { 'content-type': 'application/json' } }))

    const draft = await generateAiMapDraft({
      provider: openAiProvider,
      apiKey: 'sk-user-key',
      inputText: 'DVP deviation: assess risk, write report, archive records.',
    }, fetchImpl)

    expect(draft.nodes).toEqual([
      expect.objectContaining({ id: 'risk', type: 'activity', title: 'Assess risk?' }),
      expect.objectContaining({ id: 'report', type: 'activity', title: 'Write report' }),
      expect.objectContaining({ id: 'archive', type: 'activity', title: 'Archive records' }),
    ])
    expect(draft.nodes[0].responsibilities).toEqual([
      expect.objectContaining({ roleName: 'DRE', kind: 'responsible' }),
      expect.objectContaining({ roleName: 'SVE', kind: 'supporting' }),
      expect.objectContaining({ roleName: 'QA', kind: 'accountable' }),
    ])
    expect(draft.nodes[0].inputs).toEqual([{ workProductId: 'wp-risk', maturity: 'Draft' }])
    expect(draft.nodes[2].outputs).toEqual([{ workProductId: 'wp-archive', maturity: 'Released' }])
    expect(draft.nodes.every((node) => node.guidanceIds.length === 0)).toBe(true)
    expect(draft.edges).toEqual([
      expect.objectContaining({ sourceNodeId: 'risk', targetNodeId: 'report', label: '' }),
      expect.objectContaining({ sourceNodeId: 'report', targetNodeId: 'archive', label: '' }),
    ])
    expect(draft.workProducts).toEqual([
      expect.objectContaining({ id: 'wp-risk', title: 'Risk record', state: 'Draft' }),
      expect.objectContaining({ id: 'wp-archive', title: 'Archive package', state: 'Released' }),
    ])
    expect(draft.guidanceItems).toEqual([])
    expect(draft.milestones).toEqual([])
    expect(draft.risks).toEqual([])
  })

  it('backfills a Responsible role from explicit source steps when a provider omits responsibilities', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify({
        title: 'Vehicle definition',
        nodes: [
          { id: 'define', type: 'activity', title: 'Define vehicle attributes' },
          { id: 'balance', type: 'activity', title: 'Balance requirements' },
        ],
        edges: [{ id: 'define-balance', sourceNodeId: 'define', targetNodeId: 'balance' }],
        workProducts: [],
        guidanceItems: [],
        milestones: [],
        assumptions: [],
        risks: [],
        missingInformation: [],
      }) } }],
    }), { status: 200, headers: { 'content-type': 'application/json' } }))

    const draft = await generateAiMapDraft({
      provider: openAiProvider,
      apiKey: 'sk-user-key',
      inputText: [
        'Step 1: Product Manager defines vehicle attributes.',
        'Step 2: Systems Engineer balances requirements.',
      ].join('\n'),
    }, fetchImpl)

    expect(draft.nodes[0].responsibilities).toEqual([
      expect.objectContaining({ roleName: 'Product Manager', kind: 'responsible' }),
    ])
    expect(draft.nodes[1].responsibilities).toEqual([
      expect.objectContaining({ roleName: 'Systems Engineer', kind: 'responsible' }),
    ])
  })

  it('uses one compact retry after an abbreviated draft to avoid extra provider pressure', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        choices: [{ message: { content: '{"title":"Abbreviated","nodes":[...],"edges":[]}' } }],
      }), { status: 200, headers: { 'content-type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        choices: [{ message: { content: JSON.stringify({
          title: 'Compact',
          summary: '',
          nodes: [
            { id: 'activity-1', type: 'activity', title: 'Review request' },
            { id: 'activity-2', type: 'activity', title: 'Approve change' },
          ],
          edges: [
            { id: 'edge-1', sourceNodeId: 'activity-1', targetNodeId: 'activity-2' },
          ],
          workProducts: [],
          guidanceItems: [],
          milestones: [],
          assumptions: [],
          risks: [],
          missingInformation: [],
        }) } }],
      }), { status: 200, headers: { 'content-type': 'application/json' } }))

    const draft = await generateAiMapDraft({
      provider: openAiProvider,
      apiKey: 'sk-user-key',
      inputText: 'Create a small support process.',
    }, fetchImpl)

    expect(draft).toMatchObject({ title: 'Compact' })
    expect(fetchImpl).toHaveBeenCalledTimes(2)
    const [, compactRetryInit] = (fetchImpl.mock.calls as unknown as Array<[string, RequestInit]>)[1]
    const compactRetryBody = JSON.parse(String(compactRetryInit.body)) as { messages: Array<{ role: string; content: string }>; max_tokens?: number }
    expect(compactRetryBody.max_tokens).toBeLessThanOrEqual(4000)
    expect(compactRetryBody.messages[0].content).toContain('compact Flowent activity mainline JSON')
    expect(compactRetryBody.messages[0].content).toContain('Flowent process map generation standard')
    expect(compactRetryBody.messages[0].content).toContain('Do not return a GraphDocument envelope')
    expect(compactRetryBody.messages[1].content).toContain('at most 8 nodes')
    expect(compactRetryBody.messages[1].content).toContain('small activity-only mainline')
  })

  it('falls back to a source-text mainline when the provider rate limits generation', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      error: { message: 'too many requests' },
    }), { status: 429, headers: { 'content-type': 'application/json' } }))

    const draft = await generateAiMapDraft({
      provider: openAiProvider,
      apiKey: 'sk-user-key',
      inputText: 'Step 1: Review deviation. Step 2: Assess risk. Step 3: Archive decision.',
    }, fetchImpl)

    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(draft.nodes).toEqual([
      expect.objectContaining({ id: 'step-1', title: 'Review deviation' }),
      expect.objectContaining({ id: 'step-2', title: 'Assess risk' }),
      expect.objectContaining({ id: 'step-3', title: 'Archive decision' }),
    ])
    expect(draft.edges).toEqual([
      expect.objectContaining({ sourceNodeId: 'step-1', targetNodeId: 'step-2' }),
      expect.objectContaining({ sourceNodeId: 'step-2', targetNodeId: 'step-3' }),
    ])
    expect(draft.missingInformation).toContain('The selected provider returned HTTP 429 (rate limit), so Flowent generated a fallback mainline from the source text.')
  })

  it('builds a simple DVP deviation fallback with activity nodes connected as a mainline', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      error: { message: 'too many requests' },
    }), { status: 429, headers: { 'content-type': 'application/json' } }))

    const draft = await generateAiMapDraft({
      provider: openAiProvider,
      apiKey: 'sk-user-key',
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
    }, fetchImpl)

    expect(draft.nodes.every((node) => node.type === 'activity')).toBe(true)
    expect(draft.nodes.map((node) => node.title)).toEqual([
      '风险评估',
      'DRE编制DVP 偏差/修正-XX项目-XX零部件评审报告',
      'SVE登记，工作层评审',
      '属性集成会二级评审',
      'CEM会三级评审',
      'DVP正式修订/升版',
      'SVE归档试验报告及所有评审记录、风险评估报告等归档材料',
    ])
    expect(draft.edges).toEqual([
      expect.objectContaining({ sourceNodeId: 'step-1', targetNodeId: 'step-2', label: '' }),
      expect.objectContaining({ sourceNodeId: 'step-2', targetNodeId: 'step-3', label: '' }),
      expect.objectContaining({ sourceNodeId: 'step-3', targetNodeId: 'step-4', label: '' }),
      expect.objectContaining({ sourceNodeId: 'step-4', targetNodeId: 'step-5', label: '' }),
      expect.objectContaining({ sourceNodeId: 'step-5', targetNodeId: 'step-6', label: '' }),
      expect.objectContaining({ sourceNodeId: 'step-6', targetNodeId: 'step-7', label: '' }),
    ])
    expect(draft.nodes[1].responsibilities).toEqual([
      expect.objectContaining({ roleName: 'DRE', kind: 'responsible' }),
    ])
    expect(draft.nodes[2].responsibilities).toEqual([
      expect.objectContaining({ roleName: 'SVE', kind: 'responsible' }),
    ])
    expect(draft.nodes[4].responsibilities).toEqual([
      expect.objectContaining({ roleName: 'CEM', kind: 'responsible' }),
    ])
    expect(draft.workProducts).toEqual([])
    expect(draft.guidanceItems).toEqual([])
    expect(draft.milestones).toEqual([])
  })
})
