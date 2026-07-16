import { useCallback, useEffect, useMemo, useState } from 'react'
import { FileText, Settings, Sparkles, Upload, X } from 'lucide-react'
import type { AiGeneratedMapDraft, PublicAiProvider } from './aiTypes'
import { fetchAiProviders, generateMapWithAi } from './aiProviderApi'
import { AIProviderSettings } from './AIProviderSettings'
import type { ProcessAnalysisSettings } from '../canvas/canvasTypes'
import { analyzeProcessStages } from '../canvas/diagnostics/processIntelligence'
import { getProcessIntelligenceProfile, PROCESS_INTELLIGENCE_PROFILES } from '../canvas/processIntelligenceProfiles'

interface AIGenerateModalProps {
  open: boolean
  onClose: () => void
  onCreateNewMap: (draft: AiGeneratedMapDraft) => void | Promise<void>
  onReplaceCurrentMap: (draft: AiGeneratedMapDraft) => void | Promise<void>
}

type GenerationProgressState = 'idle' | 'running' | 'ready' | 'error'

const PROFILE_GROUPS = Array.from(new Set(PROCESS_INTELLIGENCE_PROFILES.map((profile) => profile.group))).map((group) => ({
  group,
  profiles: PROCESS_INTELLIGENCE_PROFILES.filter((profile) => profile.group === group),
}))

export function AIGenerateModal({ open, onClose, onCreateNewMap, onReplaceCurrentMap }: AIGenerateModalProps) {
  const [providers, setProviders] = useState<PublicAiProvider[]>([])
  const [selectedProviderId, setSelectedProviderId] = useState('')
  const [sourceText, setSourceText] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [modelOverride, setModelOverride] = useState('')
  const [analysisProfile, setAnalysisProfile] = useState<ProcessAnalysisSettings['profile']>('saas')
  const [wip, setWip] = useState('')
  const [preview, setPreview] = useState<AiGeneratedMapDraft | null>(null)
  const [loadingProviders, setLoadingProviders] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [applying, setApplying] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [generationProgress, setGenerationProgress] = useState<GenerationProgressState>('idle')

  const selectedProvider = useMemo(
    () => providers.find((provider) => provider.id === selectedProviderId) ?? null,
    [providers, selectedProviderId],
  )
  const selectedAnalysisProfile = getProcessIntelligenceProfile(analysisProfile)

  const reloadProviders = useCallback(async () => {
    setLoadingProviders(true)
    try {
      const result = await fetchAiProviders()
      setProviders(result.providers)
      setSelectedProviderId(result.defaultProviderId ?? result.providers[0]?.id ?? '')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoadingProviders(false)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    void Promise.resolve().then(async () => {
      if (cancelled) return
      setPreview(null)
      setError(null)
      setGenerationProgress('idle')
      await reloadProviders()
    })
    return () => {
      cancelled = true
    }
  }, [open, reloadProviders])

  if (!open) return null

  const generate = async () => {
    if (!selectedProviderId) {
      setError('Please configure and select an AI provider first.')
      return
    }
    if (!sourceText.trim() && !file) {
      setError('Paste process text or upload a supported file before generating.')
      return
    }
    setGenerating(true)
    setGenerationProgress('running')
    setError(null)
    setPreview(null)
    try {
      const draft = await generateMapWithAi({
        providerId: selectedProviderId,
        model: modelOverride.trim() || undefined,
        processAnalysis: {
          profile: analysisProfile,
          ...(parsePositiveNumber(wip) ? { wip: parsePositiveNumber(wip) } : {}),
        },
        inputText: sourceText,
        inputFile: file,
      })
      setPreview(draft)
      setGenerationProgress('ready')
    } catch (err) {
      setError((err as Error).message)
      setGenerationProgress('error')
    } finally {
      setGenerating(false)
    }
  }

  const apply = async (mode: 'create' | 'replace') => {
    if (!preview) return
    setApplying(true)
    try {
      if (mode === 'create') {
        await onCreateNewMap(preview)
      } else {
        await onReplaceCurrentMap(preview)
      }
      onClose()
    } finally {
      setApplying(false)
    }
  }

  return (
    <div className="ai-modal-backdrop">
      <section className="ai-generate-modal" role="dialog" aria-modal="true" aria-label="Generate with AI">
        <header className="ai-modal-header">
          <div>
            <h2>Generate with AI</h2>
            <p>Paste process notes or upload a file. The content is sent only to the provider you select.</p>
          </div>
          <button type="button" className="ai-icon-button" onClick={onClose} aria-label="Close AI generator">
            <X size={18} />
          </button>
        </header>

        <div className="ai-generate-grid">
          <div className="ai-generate-inputs">
            <div className="ai-provider-strip">
              <label>
                Provider
                <select value={selectedProviderId} onChange={(event) => setSelectedProviderId(event.target.value)} disabled={loadingProviders || providers.length === 0}>
                  {providers.map((provider) => (
                    <option key={provider.id} value={provider.id}>{provider.name} · {provider.model}</option>
                  ))}
                </select>
              </label>
              <button type="button" className="ai-secondary-button" onClick={() => setSettingsOpen(true)}>
                <Settings size={16} /> Provider Settings
              </button>
            </div>

            {providers.length === 0 && !loadingProviders && (
              <div className="ai-empty-provider">
                <PlugCopy />
                <span>No AI provider configured. Add a user-owned provider before generating.</span>
              </div>
            )}

            {selectedProvider && (
              <p className="ai-muted">Selected provider key: {selectedProvider.maskedApiKey || 'not configured'}</p>
            )}

            <section className="ai-process-intelligence" aria-label="Process intelligence settings">
              <h3>Process intelligence</h3>
              <label>
                Analysis profile
                <select value={analysisProfile} onChange={(event) => setAnalysisProfile(event.target.value as ProcessAnalysisSettings['profile'])}>
                  {PROFILE_GROUPS.map(({ group, profiles }) => (
                    <optgroup key={group} label={group}>
                      {profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.label}</option>)}
                    </optgroup>
                  ))}
                </select>
              </label>
              <label>
                Work in progress (WIP)
                <input type="number" min="1" step="1" value={wip} onChange={(event) => setWip(event.target.value)} placeholder="Optional" />
              </label>
              <p className="ai-profile-description">{selectedAnalysisProfile.description}</p>
              <p>Timing conclusions use only measured values in your source material.</p>
            </section>

            {generationProgress !== 'idle' && (
              <GenerationProgress
                status={generationProgress}
                providerName={selectedProvider?.name ?? 'selected provider'}
                hasFile={Boolean(file)}
              />
            )}

            <label>
              Source text
              <textarea
                className="ai-source-textarea"
                value={sourceText}
                placeholder="Describe the process, handoffs, decisions, roles, work products, expectations, and known gaps."
                onChange={(event) => setSourceText(event.target.value)}
              />
            </label>

            <label className="ai-file-drop">
              <Upload size={18} />
              <span>{file ? file.name : 'Upload .txt, .md, .csv, .json, .docx, .pptx, or .pdf'}</span>
              <input
                type="file"
                accept=".txt,.md,.csv,.json,.docx,.pptx,.pdf"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
            </label>

            <label>
              Model override
              <input value={modelOverride} placeholder={selectedProvider?.model ?? 'Optional'} onChange={(event) => setModelOverride(event.target.value)} />
            </label>

            {error && <p className="ai-status error">{error}</p>}

            <button type="button" className="ai-primary-button" onClick={generate} disabled={generating || !selectedProviderId}>
              <Sparkles size={17} /> {generating ? 'Generating...' : 'Generate Draft'}
            </button>
          </div>

          <div className="ai-preview-pane">
            {!preview && (
              <div className="ai-preview-empty">
                <FileText size={30} />
                <p>Generated map preview will appear here before anything is applied to Flowent.</p>
              </div>
            )}
            {preview && <DraftPreview draft={preview} />}
          </div>
        </div>

        <footer className="ai-modal-actions">
          <button type="button" className="ai-secondary-button" onClick={onClose}>Cancel</button>
          <button type="button" className="ai-secondary-button" onClick={() => void apply('replace')} disabled={!preview || applying}>
            Replace current map
          </button>
          <button type="button" className="ai-primary-button" onClick={() => void apply('create')} disabled={!preview || applying}>
            Create new map
          </button>
        </footer>
      </section>

      <AIProviderSettings
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onSaved={reloadProviders}
      />
    </div>
  )
}

function GenerationProgress({
  status,
  providerName,
  hasFile,
}: {
  status: Exclude<GenerationProgressState, 'idle'>
  providerName: string
  hasFile: boolean
}) {
  const steps = [
    {
      label: 'Extracting file text',
      detail: hasFile ? 'Reading the uploaded file text before sending it.' : 'Preparing the pasted process notes.',
    },
    {
      label: 'Calling provider',
      detail: `Sending the request to ${providerName}.`,
    },
    {
      label: 'Reading AI draft',
      detail: 'Waiting for a complete JSON process draft.',
    },
    {
      label: 'Preparing Flowent map',
      detail: 'Validating nodes, handoffs, fields, and process assets.',
    },
  ]
  const title = status === 'running' ? 'Generating draft' : status === 'ready' ? 'Preview ready' : 'Generation stopped'
  const description = status === 'running'
    ? 'Flowent is using the selected provider now. Large files or slower relay models may take a little longer.'
    : status === 'ready'
      ? 'Review the preview before creating or replacing a map.'
      : 'The provider request did not finish. Check the message below and try again.'

  return (
    <section
      className={`ai-generation-progress ${status}`}
      role="status"
      aria-live="polite"
      aria-label="AI generation progress"
    >
      <div className="ai-generation-progress-header">
        <span>{title}</span>
        <small>{description}</small>
      </div>
      <ol>
        {steps.map((step) => (
          <li key={step.label}>
            <span>{step.label}</span>
            <small>{step.detail}</small>
          </li>
        ))}
      </ol>
    </section>
  )
}

function DraftPreview({ draft }: { draft: AiGeneratedMapDraft }) {
  const nodes = Object.values(draft.document.nodes)
  const edges = Object.values(draft.document.edges)
  const activities = nodes.filter((node) => node.type === 'activity')
  const processIntelligence = getDraftProcessIntelligence(draft)

  return (
    <section className="ai-draft-preview" role="region" aria-label="AI draft preview">
      <h3>{draft.title}</h3>
      {draft.summary && <p>{draft.summary}</p>}
      <div className="ai-preview-stats">
        <span>{nodes.length} nodes</span>
        <span>{edges.length} handoffs</span>
        <span>{activities.length} activities</span>
      </div>
      {draft.warnings.length > 0 && (
        <div className="ai-warning-list">
          {draft.warnings.map((warning) => <p key={warning}>{warning}</p>)}
        </div>
      )}
      {processIntelligence && (
        <section className="ai-process-intelligence-preview" aria-label="Process intelligence">
          <h4>Process intelligence</h4>
          <p className="ai-profile-label">{getProcessIntelligenceProfile(processIntelligence.profile).label}</p>
          {processIntelligence.metrics ? (
            <div className="ai-preview-stats">
              <span>P50 {formatMinutes(processIntelligence.metrics.totalMinutesP50)}</span>
              <span>P90 {formatMinutes(processIntelligence.metrics.totalMinutesP90)}</span>
              <span>{Math.round(processIntelligence.metrics.processCycleEfficiency * 100)}% value-add</span>
            </div>
          ) : (
            <p>{processIntelligence.dataGaps.length} timing data gaps need measurement.</p>
          )}
        </section>
      )}
      {activities.length > 0 && (
        <>
          <h4>Activities</h4>
          <ul>
            {activities.slice(0, 6).map((activity) => <li key={activity.id}>{activity.title}</li>)}
          </ul>
        </>
      )}
      {draft.findings.length > 0 && (
        <>
          <h4>Review notes</h4>
          <ul>
            {draft.findings.map((finding) => <li key={`${finding.kind}-${finding.message}`}>{finding.message}</li>)}
          </ul>
        </>
      )}
    </section>
  )
}

function PlugCopy() {
  return <Settings size={18} aria-hidden="true" />
}

function getDraftProcessIntelligence(draft: AiGeneratedMapDraft) {
  const activities = Object.values(draft.document.nodes).filter((node) => node.type === 'activity')
  const hasAnalysisData = Boolean(draft.document.meta.processAnalysis) || activities.some((node) => node.processStage)
  if (!hasAnalysisData) return null
  return analyzeProcessStages(
    activities.map((node) => ({
      nodeId: node.id,
      title: node.title,
      kind: node.processStage?.kind ?? 'value-add',
      durationMinutesP50: node.processStage?.durationMinutesP50,
      durationMinutesP90: node.processStage?.durationMinutesP90,
    })),
    draft.document.meta.processAnalysis,
  )
}

function parsePositiveNumber(value: string): number | undefined {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
}

function formatMinutes(value: number): string {
  return Number.isInteger(value) ? `${value} min` : `${value.toFixed(1)} min`
}
