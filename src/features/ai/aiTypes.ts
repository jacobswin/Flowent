export type AiProviderProtocol = 'openai-compatible' | 'anthropic'

export type PublicAiProvider = {
  id: string
  name: string
  presetId: string
  protocol: AiProviderProtocol
  apiBaseUrl: string
  useFullUrl: boolean
  model: string
  websiteUrl: string
  notes: string
  hasApiKey: boolean
  maskedApiKey: string
  isDefault: boolean
}

export type AiProviderModel = {
  id: string
  label?: string
}

export type AiProviderPayload = {
  name: string
  presetId: string
  protocol: AiProviderProtocol
  apiBaseUrl: string
  useFullUrl: boolean
  model: string
  websiteUrl?: string
  notes?: string
  apiKey?: string
  isDefault?: boolean
}

export type SerializedAiGraphDocument = {
  id: string
  nodes: Record<string, { id: string; type: string; title: string; processStage?: ProcessStageData; [key: string]: unknown }>
  edges: Record<string, { id: string; label: string; [key: string]: unknown }>
  selectedNodeIds: string[]
  selectedEdgeIds: string[]
  viewport: { x: number; y: number; zoom: number }
  processAssets?: unknown
  meta: { dirty: boolean; version: number; processAnalysis?: ProcessAnalysisSettings }
}

export type AiGeneratedMapDraft = {
  title: string
  summary: string
  document: SerializedAiGraphDocument
  findings: { kind: string; message: string }[]
  sourceName?: string
  warnings: string[]
}
import type { ProcessAnalysisSettings, ProcessStageData } from '../canvas/canvasTypes'
