import type { ProcessAnalysisProfile, ProcessAnalysisSettings, ProcessStageData, ProcessStageKind } from '../canvasTypes'
import { getProcessIntelligenceProfile, type ProcessIntelligenceThresholds } from '../processIntelligenceProfiles'

export type { ProcessAnalysisSettings, ProcessStageData, ProcessStageKind }
export type ProcessIntelligenceProfile = ProcessAnalysisProfile

export interface ProcessStageInput {
  nodeId: string
  title: string
  kind: ProcessStageKind
  durationMinutesP50?: number
  durationMinutesP90?: number
}

export interface ProcessIntelligenceSettings {
  profile?: ProcessAnalysisSettings['profile']
  wip?: ProcessAnalysisSettings['wip']
}

export interface ProcessDataGap {
  nodeId: string
  title: string
  field: 'durationMinutesP50' | 'durationMinutesP90' | 'durationOrder'
  message: string
}

export interface ProcessFinding {
  rule: 'R1' | 'R2' | 'R3'
  severity: 'critical' | 'high' | 'medium'
  title: string
  detail: string
  nodeIds: string[]
  impactMinutesP50: number
}

export interface ProcessIntelligenceMetrics {
  totalMinutesP50: number
  totalMinutesP90: number
  valueAddMinutesP50: number
  waitMinutesP50: number
  reworkMinutesP50: number
  processCycleEfficiency: number
  waitShare: number
  reworkShare: number
  verdict: 'healthy' | 'typical' | 'waste-heavy'
  throughputPerHour: number | null
}

export interface ProcessIntelligenceReport {
  profile: ProcessIntelligenceProfile
  measurementsComplete: boolean
  dataGaps: ProcessDataGap[]
  metrics: ProcessIntelligenceMetrics | null
  findings: ProcessFinding[]
}

export function analyzeProcessStages(
  stages: ProcessStageInput[],
  settings: ProcessIntelligenceSettings = {},
): ProcessIntelligenceReport {
  const profile = settings.profile ?? 'saas'
  const thresholds = getProcessIntelligenceProfile(profile).thresholds
  const dataGaps = collectDataGaps(stages)

  if (stages.length === 0 || dataGaps.length > 0) {
    return { profile, measurementsComplete: false, dataGaps, metrics: null, findings: [] }
  }

  const measuredStages = stages as RequiredDurationStage[]
  const totalMinutesP50 = sum(measuredStages, (stage) => stage.durationMinutesP50)
  const totalMinutesP90 = sum(measuredStages, (stage) => stage.durationMinutesP90)
  const valueAddMinutesP50 = sum(measuredStages, (stage) => stage.kind === 'value-add' ? stage.durationMinutesP50 : 0)
  const waitMinutesP50 = sum(measuredStages, (stage) => stage.kind === 'wait' ? stage.durationMinutesP50 : 0)
  const reworkMinutesP50 = sum(measuredStages, (stage) => stage.kind === 'rework' ? stage.durationMinutesP50 : 0)
  const processCycleEfficiency = valueAddMinutesP50 / totalMinutesP50
  const waitShare = waitMinutesP50 / totalMinutesP50
  const reworkShare = reworkMinutesP50 / totalMinutesP50

  return {
    profile,
    measurementsComplete: true,
    dataGaps: [],
    metrics: {
      totalMinutesP50,
      totalMinutesP90,
      valueAddMinutesP50,
      waitMinutesP50,
      reworkMinutesP50,
      processCycleEfficiency,
      waitShare,
      reworkShare,
      verdict: getPceVerdict(processCycleEfficiency, thresholds),
      throughputPerHour: validWip(settings.wip) ? settings.wip / (totalMinutesP50 / 60) : null,
    },
    findings: buildFindings(measuredStages, thresholds, waitMinutesP50, reworkMinutesP50, totalMinutesP50),
  }
}

type RequiredDurationStage = ProcessStageInput & {
  durationMinutesP50: number
  durationMinutesP90: number
}

function collectDataGaps(stages: ProcessStageInput[]): ProcessDataGap[] {
  const gaps: ProcessDataGap[] = []
  for (const stage of stages) {
    if (!isPositiveFinite(stage.durationMinutesP50)) {
      gaps.push({ nodeId: stage.nodeId, title: stage.title, field: 'durationMinutesP50', message: 'P50 duration is missing or invalid.' })
    }
    if (!isPositiveFinite(stage.durationMinutesP90)) {
      gaps.push({ nodeId: stage.nodeId, title: stage.title, field: 'durationMinutesP90', message: 'P90 duration is missing or invalid.' })
    }
    if (isPositiveFinite(stage.durationMinutesP50) && isPositiveFinite(stage.durationMinutesP90) && stage.durationMinutesP90 < stage.durationMinutesP50) {
      gaps.push({ nodeId: stage.nodeId, title: stage.title, field: 'durationOrder', message: 'P90 duration must be greater than or equal to P50.' })
    }
  }
  return gaps
}

function buildFindings(
  stages: RequiredDurationStage[],
  thresholds: ProcessIntelligenceThresholds,
  waitMinutesP50: number,
  reworkMinutesP50: number,
  totalMinutesP50: number,
): ProcessFinding[] {
  const findings: ProcessFinding[] = []
  const valueAddStages = stages.filter((stage) => stage.kind === 'value-add')
  const valueAddMean = valueAddStages.length === 0
    ? 0
    : sum(valueAddStages, (stage) => stage.durationMinutesP50) / valueAddStages.length

  if (valueAddMean > 0) {
    const stageThreshold = valueAddMean * thresholds.stageMultiplier
    for (const stage of stages) {
      if (stage.durationMinutesP50 <= stageThreshold) continue
      const ratio = stage.durationMinutesP50 / valueAddMean
      findings.push({
        rule: 'R1',
        severity: stageSeverity(ratio, thresholds.stageMultiplier),
        title: `Slow stage: ${stage.title}`,
        detail: `P50 ${formatMinutes(stage.durationMinutesP50)} versus value-add mean ${formatMinutes(valueAddMean)} (${ratio.toFixed(1)}x).`,
        nodeIds: [stage.nodeId],
        impactMinutesP50: stage.durationMinutesP50,
      })
    }
  }

  const waitShare = waitMinutesP50 / totalMinutesP50
  if (waitShare > thresholds.waitShareMax) {
    findings.push({
      rule: 'R2',
      severity: shareSeverity(waitShare, thresholds.waitShareMax),
      title: 'Process is dominated by wait time',
      detail: `Wait stages account for ${(waitShare * 100).toFixed(0)}% of total P50, above the ${(thresholds.waitShareMax * 100).toFixed(0)}% profile threshold.`,
      nodeIds: stages.filter((stage) => stage.kind === 'wait').map((stage) => stage.nodeId),
      impactMinutesP50: waitMinutesP50,
    })
  }

  const reworkShare = reworkMinutesP50 / totalMinutesP50
  if (reworkShare > thresholds.reworkShareMax) {
    findings.push({
      rule: 'R3',
      severity: shareSeverity(reworkShare, thresholds.reworkShareMax),
      title: 'Process has excessive rework',
      detail: `Rework accounts for ${(reworkShare * 100).toFixed(0)}% of total P50, above the ${(thresholds.reworkShareMax * 100).toFixed(0)}% profile threshold.`,
      nodeIds: stages.filter((stage) => stage.kind === 'rework').map((stage) => stage.nodeId),
      impactMinutesP50: reworkMinutesP50,
    })
  }

  return findings.sort((left, right) => severityRank(left.severity) - severityRank(right.severity) || right.impactMinutesP50 - left.impactMinutesP50)
}

function getPceVerdict(value: number, thresholds: ProcessIntelligenceThresholds): ProcessIntelligenceMetrics['verdict'] {
  if (value >= thresholds.healthyPce) return 'healthy'
  if (value >= thresholds.typicalPce) return 'typical'
  return 'waste-heavy'
}

function stageSeverity(ratio: number, multiplier: number): ProcessFinding['severity'] {
  if (ratio >= multiplier * 3) return 'critical'
  if (ratio >= multiplier * 2) return 'high'
  return 'medium'
}

function shareSeverity(share: number, threshold: number): ProcessFinding['severity'] {
  if (share >= threshold * 2) return 'critical'
  if (share >= threshold * 1.5) return 'high'
  return 'medium'
}

function severityRank(severity: ProcessFinding['severity']): number {
  return severity === 'critical' ? 0 : severity === 'high' ? 1 : 2
}

function validWip(value: number | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

function isPositiveFinite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

function sum<T>(values: T[], getter: (value: T) => number): number {
  return values.reduce((total, value) => total + getter(value), 0)
}

function formatMinutes(value: number): string {
  return Number.isInteger(value) ? `${value} min` : `${value.toFixed(1)} min`
}
