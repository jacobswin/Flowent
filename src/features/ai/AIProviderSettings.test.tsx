import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AIProviderSettings } from './AIProviderSettings'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('AIProviderSettings', () => {
  it('saves user-owned provider configuration without echoing plaintext keys', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
    fetchMock.mockResolvedValueOnce(jsonResponse({ providers: [], defaultProviderId: null }))
    fetchMock.mockResolvedValueOnce(jsonResponse({
      provider: {
        id: 'provider-1',
        name: 'Custom Provider',
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
    }))

    render(<AIProviderSettings open onClose={() => {}} onSaved={() => {}} />)

    fireEvent.change(await screen.findByLabelText(/provider name/i), { target: { value: 'Custom Provider' } })
    fireEvent.change(screen.getByLabelText(/api request url/i), { target: { value: 'https://llm.example.com/v1' } })
    fireEvent.change(screen.getByLabelText(/model/i), { target: { value: 'flow-model' } })
    fireEvent.change(screen.getByLabelText(/api key/i), { target: { value: 'sk-user-owned-secret' } })
    fireEvent.click(screen.getByRole('button', { name: /add provider/i }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/ai/providers', expect.objectContaining({
      method: 'POST',
    })))
    const [, init] = fetchMock.mock.calls[1] as [string, RequestInit]
    expect(JSON.parse(String(init.body))).toMatchObject({
      name: 'Custom Provider',
      apiKey: 'sk-user-owned-secret',
      model: 'flow-model',
    })
    expect((await screen.findAllByText('sk-u...cret')).length).toBeGreaterThan(0)
    expect(screen.getByLabelText(/api key/i)).toHaveValue('')
  })

  it('fetches models from the current unsaved provider form and saves the selected model', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
    fetchMock.mockResolvedValueOnce(jsonResponse({ providers: [], defaultProviderId: null }))
    fetchMock.mockResolvedValueOnce(jsonResponse({
      models: [
        { id: 'model-a' },
        { id: 'model-b', label: 'Model B' },
      ],
    }))
    fetchMock.mockResolvedValueOnce(jsonResponse({
      provider: {
        id: 'provider-1',
        name: 'Custom Provider',
        presetId: 'custom-openai-compatible',
        protocol: 'openai-compatible',
        apiBaseUrl: 'https://llm.example.com/v1',
        useFullUrl: false,
        model: 'model-b',
        websiteUrl: '',
        notes: '',
        hasApiKey: true,
        maskedApiKey: 'sk-u...cret',
        isDefault: true,
      },
    }))

    render(<AIProviderSettings open onClose={() => {}} onSaved={() => {}} />)

    fireEvent.change(await screen.findByLabelText(/provider name/i), { target: { value: 'Custom Provider' } })
    fireEvent.change(screen.getByLabelText(/api request url/i), { target: { value: 'https://llm.example.com/v1' } })
    fireEvent.change(screen.getByLabelText(/api key/i), { target: { value: 'sk-user-owned-secret' } })
    fireEvent.click(screen.getByRole('button', { name: /fetch models/i }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/ai/models', expect.objectContaining({ method: 'POST' })))
    const [, modelInit] = fetchMock.mock.calls[1] as [string, RequestInit]
    expect(JSON.parse(String(modelInit.body))).toMatchObject({
      protocol: 'openai-compatible',
      apiBaseUrl: 'https://llm.example.com/v1',
      apiKey: 'sk-user-owned-secret',
    })
    expect(await screen.findByText(/loaded 2 models/i)).toBeInTheDocument()
    expect(document.querySelector('option[value="model-b"]')).not.toBeNull()

    fireEvent.change(screen.getByLabelText(/model/i), { target: { value: 'model-b' } })
    fireEvent.click(screen.getByRole('button', { name: /add provider/i }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/ai/providers', expect.objectContaining({ method: 'POST' })))
    const [, saveInit] = fetchMock.mock.calls[2] as [string, RequestInit]
    expect(JSON.parse(String(saveInit.body))).toMatchObject({ model: 'model-b' })
  })
})

function jsonResponse(data: unknown): Response {
  return new Response(JSON.stringify({ success: true, data }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}
