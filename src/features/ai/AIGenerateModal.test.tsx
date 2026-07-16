import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AIGenerateModal } from './AIGenerateModal'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('AIGenerateModal', () => {
  it('generates a preview and applies it only after confirmation', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
    fetchMock.mockResolvedValueOnce(jsonResponse({
      providers: [
        {
          id: 'provider-1',
          name: 'User Provider',
          presetId: 'custom-openai-compatible',
          protocol: 'openai-compatible',
          apiBaseUrl: 'https://llm.example.com/v1',
          useFullUrl: false,
          model: 'flow-model',
          websiteUrl: '',
          notes: '',
          hasApiKey: true,
          maskedApiKey: 'sk-u...cret',
          isDefault: true,
        },
      ],
      defaultProviderId: 'provider-1',
    }))
    fetchMock.mockResolvedValueOnce(jsonResponse({
      title: 'Bug triage',
      summary: 'Support triages defects.',
      document: {
        id: 'ai-bug-triage',
        nodes: {
          start: { id: 'start', type: 'start', title: 'Start' },
          activity: { id: 'activity', type: 'activity', title: 'Triage defect' },
        },
        edges: {},
        selectedNodeIds: [],
        selectedEdgeIds: [],
        viewport: { x: 0, y: 0, zoom: 1 },
        processAssets: { workProducts: {}, guidanceItems: {}, milestones: {} },
        meta: { dirty: false, version: 1 },
      },
      findings: [{ kind: 'assumption', message: 'Severity labels exist.' }],
      warnings: [],
    }))
    const onCreateNewMap = vi.fn()
    const onReplaceCurrentMap = vi.fn()

    render(
      <AIGenerateModal
        open
        onClose={() => {}}
        onCreateNewMap={onCreateNewMap}
        onReplaceCurrentMap={onReplaceCurrentMap}
      />,
    )

    await screen.findByText(/selected provider key/i)
    fireEvent.change(screen.getByLabelText(/source text/i), {
      target: { value: 'Support triages customer defects.' },
    })
    fireEvent.click(screen.getByRole('button', { name: /generate draft/i }))

    const preview = await screen.findByRole('region', { name: /ai draft preview/i })
    expect(within(preview).getByText('Bug triage')).toBeInTheDocument()
    expect(within(preview).getByText(/2 nodes/i)).toBeInTheDocument()
    expect(onCreateNewMap).not.toHaveBeenCalled()
    expect(onReplaceCurrentMap).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: /create new map/i }))

    await waitFor(() => expect(onCreateNewMap).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Bug triage',
      document: expect.objectContaining({ id: 'ai-bug-triage' }),
    })))
  })

  it('opens provider settings when no provider is configured', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(jsonResponse({ providers: [], defaultProviderId: null }))

    render(
      <AIGenerateModal
        open
        onClose={() => {}}
        onCreateNewMap={() => {}}
        onReplaceCurrentMap={() => {}}
      />,
    )

    fireEvent.click(await screen.findByRole('button', { name: /provider settings/i }))

    expect(await screen.findByRole('dialog', { name: /ai provider settings/i })).toBeInTheDocument()
  })

  it('sends process intelligence settings and shows the resulting analysis in the preview', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
    fetchMock.mockResolvedValueOnce(jsonResponse({
      providers: [{
        id: 'provider-1', name: 'User Provider', presetId: 'custom-openai-compatible', protocol: 'openai-compatible',
        apiBaseUrl: 'https://llm.example.com/v1', useFullUrl: false, model: 'flow-model', websiteUrl: '', notes: '',
        hasApiKey: true, maskedApiKey: 'sk-u...cret', isDefault: true,
      }],
      defaultProviderId: 'provider-1',
    }))
    fetchMock.mockResolvedValueOnce(jsonResponse({
      title: 'Release review', summary: '',
      document: {
        id: 'ai-release-review',
        nodes: {
          activity: {
            id: 'activity', type: 'activity', title: 'Wait for approval',
            processStage: { kind: 'wait', durationMinutesP50: 90, durationMinutesP90: 180, classificationSource: 'explicit' },
          },
        },
        edges: {}, selectedNodeIds: [], selectedEdgeIds: [], viewport: { x: 0, y: 0, zoom: 1 },
        processAssets: { workProducts: {}, guidanceItems: {}, milestones: {} },
        meta: { dirty: false, version: 1, processAnalysis: { profile: 'manufacturing', wip: 6 } },
      },
      findings: [], warnings: [],
    }))

    render(<AIGenerateModal open onClose={() => {}} onCreateNewMap={() => {}} onReplaceCurrentMap={() => {}} />)

    await screen.findByText(/selected provider key/i)
    fireEvent.change(screen.getByLabelText('Analysis profile'), { target: { value: 'manufacturing' } })
    fireEvent.change(screen.getByLabelText('Work in progress (WIP)'), { target: { value: '6' } })
    fireEvent.change(screen.getByLabelText(/source text/i), { target: { value: 'Approval takes 90 minutes at P50 and 180 minutes at P90.' } })
    fireEvent.click(screen.getByRole('button', { name: /generate draft/i }))

    await screen.findByText('Release review')
    const [, init] = fetchMock.mock.calls[1] as [string, RequestInit]
    expect(JSON.parse(String(init.body))).toMatchObject({
      processAnalysis: { profile: 'manufacturing', wip: 6 },
    })
    expect(screen.getByRole('region', { name: 'AI draft preview' })).toHaveTextContent('Process intelligence')
    expect(screen.getByRole('region', { name: 'AI draft preview' })).toHaveTextContent('Manufacturing')
    expect(screen.getByText('P50 90 min')).toBeInTheDocument()
  })

  it('offers the development industry pack in grouped profiles and explains the selected profile', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(jsonResponse({
      providers: [{
        id: 'provider-1', name: 'User Provider', presetId: 'custom-openai-compatible', protocol: 'openai-compatible',
        apiBaseUrl: 'https://llm.example.com/v1', useFullUrl: false, model: 'flow-model', websiteUrl: '', notes: '',
        hasApiKey: true, maskedApiKey: 'sk-u...cret', isDefault: true,
      }],
      defaultProviderId: 'provider-1',
    }))

    render(<AIGenerateModal open onClose={() => {}} onCreateNewMap={() => {}} onReplaceCurrentMap={() => {}} />)

    const profileSelect = await screen.findByLabelText('Analysis profile')
    expect(within(profileSelect).getByRole('option', { name: 'Engineering Development' })).toBeInTheDocument()
    expect(within(profileSelect).getByRole('option', { name: 'Automotive Development' })).toBeInTheDocument()
    expect(within(profileSelect).getByRole('option', { name: 'Electronics & Hardware Development' })).toBeInTheDocument()
    expect(within(profileSelect).getByRole('option', { name: 'Construction & Engineering Projects' })).toBeInTheDocument()
    expect(within(profileSelect).getByRole('option', { name: 'Automotive Development' }).closest('optgroup'))
      .toHaveAttribute('label', 'Industrial development')

    fireEvent.change(profileSelect, { target: { value: 'automotive' } })
    expect(screen.getByText('Vehicle and subsystem development through validation.')).toBeInTheDocument()
  })

  it('shows generation progress while the provider request is running', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
    fetchMock.mockResolvedValueOnce(jsonResponse({
      providers: [
        {
          id: 'provider-1',
          name: 'User Provider',
          presetId: 'custom-openai-compatible',
          protocol: 'openai-compatible',
          apiBaseUrl: 'https://llm.example.com/v1',
          useFullUrl: false,
          model: 'flow-model',
          websiteUrl: '',
          notes: '',
          hasApiKey: true,
          maskedApiKey: 'sk-u...cret',
          isDefault: true,
        },
      ],
      defaultProviderId: 'provider-1',
    }))
    let resolveGenerate!: (response: Response) => void
    fetchMock.mockReturnValueOnce(new Promise<Response>((resolve) => {
      resolveGenerate = resolve
    }))

    render(
      <AIGenerateModal
        open
        onClose={() => {}}
        onCreateNewMap={() => {}}
        onReplaceCurrentMap={() => {}}
      />,
    )

    await screen.findByText(/selected provider key/i)
    fireEvent.change(screen.getByLabelText(/source text/i), {
      target: { value: 'Support triages customer defects.' },
    })
    fireEvent.click(screen.getByRole('button', { name: /generate draft/i }))

    const progress = await screen.findByRole('status', { name: /ai generation progress/i })
    expect(within(progress).getByText(/extracting file text/i)).toBeInTheDocument()
    expect(within(progress).getByText(/calling provider/i)).toBeInTheDocument()
    expect(within(progress).getByText(/reading ai draft/i)).toBeInTheDocument()
    expect(within(progress).getByText(/preparing flowent map/i)).toBeInTheDocument()

    resolveGenerate(jsonResponse({
      title: 'Bug triage',
      summary: 'Support triages defects.',
      document: {
        id: 'ai-bug-triage',
        nodes: {
          start: { id: 'start', type: 'start', title: 'Start' },
          activity: { id: 'activity', type: 'activity', title: 'Triage defect' },
        },
        edges: {},
        selectedNodeIds: [],
        selectedEdgeIds: [],
        viewport: { x: 0, y: 0, zoom: 1 },
        processAssets: { workProducts: {}, guidanceItems: {}, milestones: {} },
        meta: { dirty: false, version: 1 },
      },
      findings: [],
      warnings: [],
    }))

    expect(await screen.findByText(/preview ready/i)).toBeInTheDocument()
  })
})

function jsonResponse(data: unknown): Response {
  return new Response(JSON.stringify({ success: true, data }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}
