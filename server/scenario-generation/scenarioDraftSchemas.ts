import { z } from 'zod'

const nonEmptyTextSchema = z.string().trim().min(1)
const textListSchema = z.array(nonEmptyTextSchema).default([])
const actorKindSchema = z.enum(['role', 'stakeholder', 'upstream', 'downstream'])
const responsibilityKindSchema = z.enum(['responsible', 'accountable', 'supporting', 'consulted', 'informed'])
export const generatedSourceSchema = z.enum(['user-provided', 'model-inferred', 'system-derived'])

export const scenarioDraftRequestSchema = z.object({
  scenario: nonEmptyTextSchema,
  problemGoal: z.string().trim().default(''),
  trigger: z.string().trim().default(''),
  roles: z.array(nonEmptyTextSchema).min(1),
  stakeholders: textListSchema,
  upstreamActors: textListSchema,
  downstreamActors: textListSchema,
  inputs: textListSchema,
  outputs: z.array(nonEmptyTextSchema).min(1),
  activities: z.array(nonEmptyTextSchema).min(1),
  decisions: textListSchema,
})

export const claudeScenarioDraftSchema = z.object({
  title: nonEmptyTextSchema,
  scenario: nonEmptyTextSchema,
  actors: z.array(
    z.object({
      id: nonEmptyTextSchema,
      name: nonEmptyTextSchema,
      kind: actorKindSchema,
      focus: z.string().trim().optional(),
    }),
  ),
  inputs: z.array(
    z.object({
      id: nonEmptyTextSchema,
      title: nonEmptyTextSchema,
      sourceActorIds: z.array(nonEmptyTextSchema),
    }),
  ),
  outputs: z.array(
    z.object({
      id: nonEmptyTextSchema,
      title: nonEmptyTextSchema,
      producerActorIds: z.array(nonEmptyTextSchema),
      recipientActorIds: z.array(nonEmptyTextSchema),
    }),
  ),
  workProducts: z.array(
    z.object({
      id: nonEmptyTextSchema,
      title: nonEmptyTextSchema,
      state: nonEmptyTextSchema,
    }),
  ),
  expectations: z.array(
    z.object({
      id: nonEmptyTextSchema,
      title: nonEmptyTextSchema,
      detail: nonEmptyTextSchema,
      roleIds: z.array(nonEmptyTextSchema),
    }),
  ),
  decisions: z.array(
    z.object({
      id: nonEmptyTextSchema,
      title: nonEmptyTextSchema,
      affectedActorIds: z.array(nonEmptyTextSchema),
      criteria: nonEmptyTextSchema,
    }),
  ),
  handoffs: z.array(
    z.object({
      id: nonEmptyTextSchema,
      title: nonEmptyTextSchema,
      fromActorIds: z.array(nonEmptyTextSchema),
      toActorIds: z.array(nonEmptyTextSchema),
      inputIds: z.array(nonEmptyTextSchema),
      outputIds: z.array(nonEmptyTextSchema),
      expectationIds: z.array(nonEmptyTextSchema),
    }),
  ),
  activities: z.array(
    z.object({
      id: nonEmptyTextSchema,
      title: nonEmptyTextSchema,
      summary: nonEmptyTextSchema,
      responsibilities: z.array(
        z.object({
          actorId: nonEmptyTextSchema,
          kind: responsibilityKindSchema,
        }),
      ),
      inputIds: z.array(nonEmptyTextSchema),
      outputIds: z.array(nonEmptyTextSchema),
      decisionIds: z.array(nonEmptyTextSchema),
      handoffIds: z.array(nonEmptyTextSchema),
      expectationIds: z.array(nonEmptyTextSchema),
      workProductIds: z.array(nonEmptyTextSchema),
    }),
  ),
  sourcesById: z.record(nonEmptyTextSchema, generatedSourceSchema),
  missingInformation: z.array(nonEmptyTextSchema),
  assumptions: z.array(nonEmptyTextSchema),
  riskPoints: z.array(nonEmptyTextSchema),
  requiredConfirmations: z.array(nonEmptyTextSchema),
})

export type ScenarioDraftRequest = z.infer<typeof scenarioDraftRequestSchema>
export type ClaudeScenarioDraft = z.infer<typeof claudeScenarioDraftSchema>
