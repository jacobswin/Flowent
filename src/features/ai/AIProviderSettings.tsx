import { useEffect, useId, useMemo, useState } from 'react'
import { Check, PlugZap, RefreshCw, Trash2, X } from 'lucide-react'
import type { AiProviderModel, AiProviderPayload, AiProviderProtocol, PublicAiProvider } from './aiTypes'
import { createAiProvider, deleteAiProvider, fetchAiModels, fetchAiProviders, testAiProvider, updateAiProvider } from './aiProviderApi'

type ProviderPreset = {
  id: string
  name: string
  protocol: AiProviderProtocol
  apiBaseUrl: string
  model: string
  websiteUrl: string
}

const PRESETS: ProviderPreset[] = [
  { id: 'custom-openai-compatible', name: 'Custom OpenAI-compatible', protocol: 'openai-compatible', apiBaseUrl: '', model: '', websiteUrl: '' },
  { id: 'openai-official', name: 'OpenAI Official', protocol: 'openai-compatible', apiBaseUrl: 'https://api.openai.com/v1', model: 'gpt-4.1-mini', websiteUrl: 'https://platform.openai.com' },
  { id: 'openrouter', name: 'OpenRouter', protocol: 'openai-compatible', apiBaseUrl: 'https://openrouter.ai/api/v1', model: 'openai/gpt-4.1-mini', websiteUrl: 'https://openrouter.ai' },
  { id: 'deepseek', name: 'DeepSeek', protocol: 'openai-compatible', apiBaseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat', websiteUrl: 'https://deepseek.com' },
  { id: 'kimi', name: 'Kimi', protocol: 'openai-compatible', apiBaseUrl: 'https://api.moonshot.cn/v1', model: 'kimi-k2-0711-preview', websiteUrl: 'https://kimi.moonshot.cn' },
  { id: 'qwen-dashscope', name: 'Qwen / DashScope', protocol: 'openai-compatible', apiBaseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus', websiteUrl: 'https://dashscope.aliyun.com' },
  { id: 'siliconflow', name: 'SiliconFlow', protocol: 'openai-compatible', apiBaseUrl: 'https://api.siliconflow.cn/v1', model: 'Qwen/Qwen2.5-72B-Instruct', websiteUrl: 'https://siliconflow.cn' },
  { id: 'zhipu-glm', name: 'Zhipu GLM', protocol: 'openai-compatible', apiBaseUrl: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-4-flash', websiteUrl: 'https://bigmodel.cn' },
  { id: 'anthropic-claude', name: 'Anthropic Claude', protocol: 'anthropic', apiBaseUrl: 'https://api.anthropic.com/v1', model: 'claude-3-5-sonnet-latest', websiteUrl: 'https://console.anthropic.com' },
]

const EMPTY_FORM: AiProviderPayload = {
  name: '',
  presetId: 'custom-openai-compatible',
  protocol: 'openai-compatible',
  apiBaseUrl: '',
  useFullUrl: false,
  model: '',
  websiteUrl: '',
  notes: '',
  apiKey: '',
  isDefault: true,
}

interface AIProviderSettingsProps {
  open: boolean
  onClose: () => void
  onSaved: () => void
}

export function AIProviderSettings({ open, onClose, onSaved }: AIProviderSettingsProps) {
  const modelInputId = useId()
  const modelListId = `${modelInputId}-options`
  const [providers, setProviders] = useState<PublicAiProvider[]>([])
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null)
  const [form, setForm] = useState<AiProviderPayload>(EMPTY_FORM)
  const [apiKey, setApiKey] = useState('')
  const [modelOptions, setModelOptions] = useState<AiProviderModel[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [fetchingModels, setFetchingModels] = useState(false)
  const [testingProviderId, setTestingProviderId] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const selectedProvider = useMemo(
    () => providers.find((provider) => provider.id === selectedProviderId) ?? null,
    [providers, selectedProviderId],
  )

  useEffect(() => {
    if (!open) return
    let cancelled = false
    void Promise.resolve().then(async () => {
      if (cancelled) return
      setLoading(true)
      try {
        const result = await fetchAiProviders()
        if (cancelled) return
        setProviders(result.providers)
        setSelectedProviderId(result.defaultProviderId)
      } catch (err) {
        if (!cancelled) setError((err as Error).message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [open])

  useEffect(() => {
    if (!selectedProvider) return
    let cancelled = false
    void Promise.resolve().then(() => {
      if (cancelled) return
      setForm(providerToForm(selectedProvider))
      setApiKey('')
      setModelOptions([])
    })
    return () => {
      cancelled = true
    }
  }, [selectedProvider])

  if (!open) return null

  const choosePreset = (preset: ProviderPreset) => {
    setSelectedProviderId(null)
    setForm((current) => ({
      ...current,
      name: preset.id === 'custom-openai-compatible' ? current.name : preset.name,
      presetId: preset.id,
      protocol: preset.protocol,
      apiBaseUrl: preset.apiBaseUrl,
      model: preset.model,
      websiteUrl: preset.websiteUrl,
    }))
    setModelOptions([])
    setStatus(null)
    setError(null)
  }

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      const payload = { ...form, apiKey: apiKey.trim() || undefined }
      const provider = selectedProviderId
        ? await updateAiProvider(selectedProviderId, payload)
        : await createAiProvider(payload)
      setProviders((current) => upsertProvider(current, provider))
      setSelectedProviderId(provider.id)
      setApiKey('')
      setStatus(selectedProviderId ? 'Provider saved.' : 'Provider added.')
      onSaved()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!selectedProviderId) return
    setSaving(true)
    try {
      await deleteAiProvider(selectedProviderId)
      setProviders((current) => current.filter((provider) => provider.id !== selectedProviderId))
      setSelectedProviderId(null)
      setForm(EMPTY_FORM)
      setApiKey('')
      setModelOptions([])
      setStatus('Provider removed.')
      onSaved()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const test = async () => {
    if (!selectedProviderId) return
    setTestingProviderId(selectedProviderId)
    setError(null)
    setStatus(null)
    try {
      await testAiProvider(selectedProviderId)
      setStatus('Connection test succeeded.')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setTestingProviderId(null)
    }
  }

  const fetchModels = async () => {
    if (!form.apiBaseUrl.trim()) {
      setError('Enter an API request URL before fetching models.')
      return
    }
    if (!apiKey.trim() && !selectedProvider?.hasApiKey) {
      setError('Enter an API key before fetching models.')
      return
    }
    setFetchingModels(true)
    setError(null)
    setStatus(null)
    try {
      const models = await fetchAiModels({
        providerId: selectedProviderId ?? undefined,
        protocol: form.protocol,
        apiBaseUrl: form.apiBaseUrl,
        useFullUrl: form.useFullUrl,
        apiKey: apiKey.trim() || undefined,
      })
      setModelOptions(models)
      setStatus(`Loaded ${models.length} models.`)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setFetchingModels(false)
    }
  }

  const canFetchModels = Boolean(form.apiBaseUrl.trim()) && Boolean(apiKey.trim() || selectedProvider?.hasApiKey)

  return (
    <div className="ai-modal-backdrop">
      <section className="ai-provider-modal" role="dialog" aria-modal="true" aria-label="AI Provider Settings">
        <header className="ai-modal-header">
          <div>
            <h2>AI Provider Settings</h2>
            <p>User-owned providers. Flowent stores keys locally and only shows masked key status.</p>
          </div>
          <button type="button" className="ai-icon-button" onClick={onClose} aria-label="Close provider settings">
            <X size={18} />
          </button>
        </header>

        <div className="ai-provider-body">
          <aside className="ai-provider-sidebar">
            <h3>Saved providers</h3>
            {loading && <p className="ai-muted">Loading providers...</p>}
            {providers.length === 0 && !loading && <p className="ai-muted">No providers configured yet.</p>}
            {providers.map((provider) => (
              <button
                key={provider.id}
                type="button"
                className={`ai-provider-row${provider.id === selectedProviderId ? ' active' : ''}`}
                onClick={() => setSelectedProviderId(provider.id)}
              >
                <span>{provider.name}</span>
                <small>{provider.maskedApiKey || 'No key'}</small>
              </button>
            ))}
            <button
              type="button"
              className="ai-secondary-button full"
              onClick={() => {
                setSelectedProviderId(null)
                setForm(EMPTY_FORM)
                setApiKey('')
                setModelOptions([])
              }}
            >
              New provider
            </button>
          </aside>

          <div className="ai-provider-main">
            <h3>Provider preset</h3>
            <div className="ai-preset-grid">
              {PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  className={preset.id === form.presetId ? 'active' : undefined}
                  onClick={() => choosePreset(preset)}
                >
                  {preset.name}
                </button>
              ))}
            </div>

            <div className="ai-form-grid">
              <label>
                Provider Name
                <input value={form.name} placeholder="e.g., Company LLM account" onChange={(event) => setForm({ ...form, name: event.target.value })} />
              </label>
              <div className="ai-field">
                <label htmlFor={modelInputId}>Model</label>
                <div className="ai-model-row">
                  <input
                    id={modelInputId}
                    list={modelOptions.length > 0 ? modelListId : undefined}
                    value={form.model}
                    placeholder="e.g., gpt-4.1-mini"
                    onChange={(event) => setForm({ ...form, model: event.target.value })}
                  />
                  <button type="button" className="ai-secondary-button compact" onClick={fetchModels} disabled={fetchingModels || !canFetchModels}>
                    <RefreshCw size={15} /> {fetchingModels ? 'Fetching...' : 'Fetch models'}
                  </button>
                </div>
                <datalist id={modelListId}>
                  {modelOptions.map((model) => (
                    <option key={model.id} value={model.id} label={model.label ?? model.id} />
                  ))}
                </datalist>
              </div>
              <label className="span-2">
                Website URL
                <input value={form.websiteUrl} placeholder="https://example.com" onChange={(event) => setForm({ ...form, websiteUrl: event.target.value })} />
              </label>
              <label className="span-2">
                API Key
                <input
                  type="password"
                  value={apiKey}
                  placeholder={selectedProvider?.hasApiKey ? 'Leave blank to keep current key' : 'Paste user-owned provider key'}
                  onChange={(event) => setApiKey(event.target.value)}
                />
              </label>
              <label className="span-2">
                API Request URL
                <input
                  value={form.apiBaseUrl}
                  placeholder="https://your-provider.example.com/v1"
                  onChange={(event) => {
                    setForm({ ...form, apiBaseUrl: event.target.value })
                    setModelOptions([])
                  }}
                />
              </label>
              <label className="span-2">
                Notes
                <textarea value={form.notes} placeholder="Account owner, limits, or routing notes" onChange={(event) => setForm({ ...form, notes: event.target.value })} />
              </label>
            </div>

            {selectedProvider?.maskedApiKey && (
              <p className="ai-key-status"><Check size={15} /> Saved key: <strong>{selectedProvider.maskedApiKey}</strong></p>
            )}
            {status && <p className="ai-status success">{status}</p>}
            {error && <p className="ai-status error">{error}</p>}
          </div>
        </div>

        <footer className="ai-modal-actions">
          <button type="button" className="ai-secondary-button" onClick={onClose}>Cancel</button>
          {selectedProviderId && (
            <>
              <button type="button" className="ai-secondary-button" onClick={test} disabled={testingProviderId === selectedProviderId}>
                <PlugZap size={16} /> {testingProviderId === selectedProviderId ? 'Testing...' : 'Test'}
              </button>
              <button type="button" className="ai-danger-button" onClick={remove} disabled={saving}>
                <Trash2 size={16} /> Delete
              </button>
            </>
          )}
          <button type="button" className="ai-primary-button" onClick={save} disabled={saving || !form.name.trim() || !form.apiBaseUrl.trim() || !form.model.trim()}>
            {saving ? 'Saving...' : selectedProviderId ? 'Save Provider' : 'Add Provider'}
          </button>
        </footer>
      </section>
    </div>
  )
}

function upsertProvider(providers: PublicAiProvider[], provider: PublicAiProvider): PublicAiProvider[] {
  const next = providers.some((item) => item.id === provider.id)
    ? providers.map((item) => (item.id === provider.id ? provider : item))
    : [...providers, provider]
  return next.map((item) => ({ ...item, isDefault: item.id === provider.id ? provider.isDefault : item.isDefault && !provider.isDefault }))
}

function providerToForm(provider: PublicAiProvider): AiProviderPayload {
  return {
    name: provider.name,
    presetId: provider.presetId,
    protocol: provider.protocol,
    apiBaseUrl: provider.apiBaseUrl,
    useFullUrl: provider.useFullUrl,
    model: provider.model,
    websiteUrl: provider.websiteUrl,
    notes: provider.notes,
    apiKey: '',
    isDefault: provider.isDefault,
  }
}
