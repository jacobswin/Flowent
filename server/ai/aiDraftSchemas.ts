import { z } from 'zod'
import { PROCESS_INTELLIGENCE_PROFILE_IDS } from '../../src/features/canvas/processIntelligenceProfiles'

const nonEmptyText = z.string().trim().min(1)
const responsibilityKindSchema = z.enum(['responsible', 'accountable', 'supporting', 'consulted', 'informed'])
const guidanceKindSchema = z.enum(['template', 'checklist', 'practice', 'tool', 'training', 'link', 'other'])
const processStageKindSchema = z.enum(['value-add', 'wait', 'rework'])
const processAnalysisProfileSchema = z.enum(PROCESS_INTELLIGENCE_PROFILE_IDS)

const processStageSchema = z.object({
  kind: processStageKindSchema,
  durationMinutesP50: z.number().finite().positive().optional(),
  durationMinutesP90: z.number().finite().positive().optional(),
  classificationSource: z.enum(['explicit', 'inferred']),
})

const workProductMaturityRefSchema = z.object({
  workProductId: nonEmptyText,
  maturity: nonEmptyText.default('Draft'),
})

export const aiMapDraftSchema = z.object({
  title: nonEmptyText,
  summary: z.string().trim().default(''),
  generationMode: z.enum(['activity-mainline']).optional(),
  processAnalysis: z.object({
    profile: processAnalysisProfileSchema,
    wip: z.number().finite().positive().optional(),
  }).optional(),
  nodes: z.array(z.object({
    id: nonEmptyText,
    type: z.enum(['activity', 'decision', 'stage', 'bottleneck']),
    title: nonEmptyText,
    summary: z.string().trim().optional(),
    expectations: z.string().trim().optional(),
    criteria: z.string().trim().optional(),
    decisionOutcomes: z.array(nonEmptyText).default([]),
    owner: z.string().trim().optional(),
    goal: z.string().trim().optional(),
    entryCondition: z.string().trim().optional(),
    exitCondition: z.string().trim().optional(),
    symptom: z.string().trim().optional(),
    impact: z.string().trim().optional(),
    suspectedCause: z.string().trim().optional(),
    responsibilities: z.array(z.object({
      roleName: nonEmptyText,
      kind: responsibilityKindSchema,
    })).default([]),
    processStage: processStageSchema.optional(),
    inputs: z.array(workProductMaturityRefSchema).default([]),
    outputs: z.array(workProductMaturityRefSchema).default([]),
    guidanceIds: z.array(nonEmptyText).default([]),
  })).min(1),
  edges: z.array(z.object({
    id: nonEmptyText,
    sourceNodeId: nonEmptyText,
    targetNodeId: nonEmptyText,
    label: z.string().trim().default(''),
    fromRole: z.string().trim().optional(),
    toRole: z.string().trim().optional(),
    artifact: z.string().trim().optional(),
    expectation: z.string().trim().optional(),
    readinessSignal: z.string().trim().optional(),
    workProductIds: z.array(nonEmptyText).default([]),
  })).default([]),
  workProducts: z.array(z.object({
    id: nonEmptyText,
    title: nonEmptyText,
    state: nonEmptyText.default('Draft'),
    description: z.string().trim().default(''),
  })).default([]),
  guidanceItems: z.array(z.object({
    id: nonEmptyText,
    title: nonEmptyText,
    kind: guidanceKindSchema.default('checklist'),
    description: z.string().trim().default(''),
    url: z.string().trim().default(''),
    appliesToNodeIds: z.array(nonEmptyText).default([]),
    appliesToEdgeIds: z.array(nonEmptyText).default([]),
    workProductIds: z.array(nonEmptyText).default([]),
  })).default([]),
  milestones: z.array(z.object({
    id: nonEmptyText,
    title: nonEmptyText,
    description: z.string().trim().default(''),
    stageNodeId: z.string().trim().nullable().default(null),
    workProductStates: z.array(z.object({
      workProductId: nonEmptyText,
      state: nonEmptyText,
    })).default([]),
  })).default([]),
  assumptions: z.array(nonEmptyText).default([]),
  risks: z.array(nonEmptyText).default([]),
  missingInformation: z.array(nonEmptyText).default([]),
})

export type AiMapDraft = z.infer<typeof aiMapDraftSchema>
