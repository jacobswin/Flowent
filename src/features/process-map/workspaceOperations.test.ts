import { describe, expect, it } from 'vitest'
import type { ProcessMap } from './types'
import {
  addActivity,
  addDecision,
  addExpectation,
  addHandoff,
  addInput,
  addOutput,
  addRole,
  computeReadiness,
  createEmptyMap,
  removeActivity,
  removeDecision,
  removeExpectation,
  removeHandoff,
  removeInput,
  removeOutput,
  removeRole,
  updateActivity,
  updateDecision,
  updateHandoff,
  updateMapScenario,
  updateMapTitle,
} from './workspaceOperations'
import type { GeneratedSource } from '../scenario-generation/types'

const emptySources: Record<string, GeneratedSource> = {}

const sampleMap: ProcessMap = {
  id: 'test-map',
  title: 'Test map',
  status: 'draft',
  scenario: 'Test scenario',
  roles: [{ id: 'pm', name: 'Product Manager', kind: 'role', focus: 'Clarifies outcomes' }],
  stakeholders: [],
  upstreamActors: [],
  downstreamActors: [],
  inputs: [{ id: 'req', title: 'Change request', sourceActorIds: [] }],
  outputs: [{ id: 'update', title: 'Feature update', producerActorIds: ['pm'], recipientActorIds: [] }],
  workProducts: [],
  expectations: [],
  decisions: [],
  handoffs: [],
  activities: [
    {
      id: 'plan',
      title: 'Plan work',
      summary: 'PM plans the work.',
      responsibilities: [{ actorId: 'pm', kind: 'responsible' }],
      inputIds: ['req'],
      outputIds: ['update'],
      decisionIds: [],
      handoffIds: [],
      expectationIds: [],
      workProductIds: [],
    },
  ],
}

describe('workspace operations', () => {
  it('adds an activity with source tracking', () => {
    const sources: Record<string, GeneratedSource> = {}
    const result = addActivity(sampleMap, sources, {
      id: 'implement',
      title: 'Implement feature',
      summary: 'Engineer implements.',
      responsibilities: [{ actorId: 'pm', kind: 'responsible' }],
      inputIds: [],
      outputIds: [],
      decisionIds: [],
      handoffIds: [],
      expectationIds: [],
      workProductIds: [],
    })

    expect(result.map.activities).toHaveLength(2)
    expect(result.map.activities[1].id).toBe('implement')
    expect(result.sources['implement']).toBe('user-provided')
  })

  it('removes an activity and cleans up source tracking', () => {
    const sources: Record<string, GeneratedSource> = { plan: 'model-inferred' }
    const result = removeActivity(sampleMap, sources, 'plan')

    expect(result.map.activities).toHaveLength(0)
    expect(result.sources['plan']).toBeUndefined()
  })

  it('updates an activity title and marks it user-provided', () => {
    const sources: Record<string, GeneratedSource> = { plan: 'model-inferred' }
    const result = updateActivity(sampleMap, sources, 'plan', { title: 'Plan the work carefully' })

    expect(result.map.activities[0].title).toBe('Plan the work carefully')
    expect(result.sources['plan']).toBe('user-provided')
  })

  it('adds a decision', () => {
    const result = addDecision(sampleMap, emptySources, {
      id: 'ready',
      title: 'Is this ready?',
      affectedActorIds: ['pm'],
      criteria: 'All tasks complete.',
    })

    expect(result.map.decisions).toHaveLength(1)
    expect(result.sources['ready']).toBe('user-provided')
  })

  it('removes a decision', () => {
    const map: ProcessMap = { ...sampleMap, decisions: [{ id: 'd1', title: 'D1', affectedActorIds: [], criteria: 'c' }] }
    const result = removeDecision(map, { d1: 'model-inferred' }, 'd1')

    expect(result.map.decisions).toHaveLength(0)
  })

  it('updates a decision', () => {
    const map: ProcessMap = { ...sampleMap, decisions: [{ id: 'd1', title: 'D1', affectedActorIds: [], criteria: 'c' }] }
    const result = updateDecision(map, { d1: 'model-inferred' }, 'd1', { title: 'Updated D1' })

    expect(result.map.decisions[0].title).toBe('Updated D1')
    expect(result.sources['d1']).toBe('user-provided')
  })

  it('adds a handoff', () => {
    const result = addHandoff(sampleMap, emptySources, {
      id: 'h1',
      title: 'PM to QA',
      fromActorIds: ['pm'],
      toActorIds: [],
      inputIds: [],
      outputIds: ['update'],
      expectationIds: [],
    })

    expect(result.map.handoffs).toHaveLength(1)
    expect(result.sources['h1']).toBe('user-provided')
  })

  it('removes a handoff', () => {
    const map: ProcessMap = {
      ...sampleMap,
      handoffs: [{ id: 'h1', title: 'H1', fromActorIds: [], toActorIds: [], inputIds: [], outputIds: [], expectationIds: [] }],
    }
    const result = removeHandoff(map, { h1: 'model-inferred' }, 'h1')

    expect(result.map.handoffs).toHaveLength(0)
  })

  it('updates a handoff', () => {
    const map: ProcessMap = {
      ...sampleMap,
      handoffs: [{ id: 'h1', title: 'H1', fromActorIds: [], toActorIds: [], inputIds: [], outputIds: [], expectationIds: [] }],
    }
    const result = updateHandoff(map, { h1: 'model-inferred' }, 'h1', { title: 'Updated H1' })

    expect(result.map.handoffs[0].title).toBe('Updated H1')
    expect(result.sources['h1']).toBe('user-provided')
  })

  it('adds a role', () => {
    const result = addRole(sampleMap, emptySources, {
      id: 'eng',
      name: 'Engineer',
      kind: 'role',
      focus: 'Implements features',
    })

    expect(result.map.roles).toHaveLength(2)
    expect(result.sources['eng']).toBe('user-provided')
  })

  it('removes a role', () => {
    const result = removeRole(sampleMap, { pm: 'model-inferred' }, 'pm')

    expect(result.map.roles).toHaveLength(0)
  })

  it('adds an input', () => {
    const result = addInput(sampleMap, emptySources, {
      id: 'design',
      title: 'Design spec',
      sourceActorIds: [],
    })

    expect(result.map.inputs).toHaveLength(2)
    expect(result.sources['design']).toBe('user-provided')
  })

  it('removes an input', () => {
    const result = removeInput(sampleMap, { req: 'model-inferred' }, 'req')

    expect(result.map.inputs).toHaveLength(0)
  })

  it('adds an output', () => {
    const result = addOutput(sampleMap, emptySources, {
      id: 'report',
      title: 'Status report',
      producerActorIds: ['pm'],
      recipientActorIds: [],
    })

    expect(result.map.outputs).toHaveLength(2)
  })

  it('removes an output', () => {
    const result = removeOutput(sampleMap, { update: 'model-inferred' }, 'update')

    expect(result.map.outputs).toHaveLength(0)
  })

  it('adds an expectation', () => {
    const result = addExpectation(sampleMap, emptySources, {
      id: 'exp1',
      title: 'Quality bar',
      detail: 'Must pass QA.',
      roleIds: ['pm'],
    })

    expect(result.map.expectations).toHaveLength(1)
  })

  it('removes an expectation', () => {
    const map: ProcessMap = {
      ...sampleMap,
      expectations: [{ id: 'exp1', title: 'E1', detail: 'D', roleIds: [] }],
    }
    const result = removeExpectation(map, { exp1: 'model-inferred' }, 'exp1')

    expect(result.map.expectations).toHaveLength(0)
  })

  it('updates map title', () => {
    const result = updateMapTitle(sampleMap, 'New title')

    expect(result.title).toBe('New title')
    expect(result.id).toBe('test-map')
  })

  it('updates map scenario', () => {
    const result = updateMapScenario(sampleMap, 'New scenario')

    expect(result.scenario).toBe('New scenario')
  })

  it('does not mutate the original map', () => {
    const originalActivities = sampleMap.activities.length
    addActivity(sampleMap, emptySources, {
      id: 'new',
      title: 'New',
      summary: 'New activity.',
      responsibilities: [],
      inputIds: [],
      outputIds: [],
      decisionIds: [],
      handoffIds: [],
      expectationIds: [],
      workProductIds: [],
    })

    expect(sampleMap.activities).toHaveLength(originalActivities)
  })

  it('creates an empty map', () => {
    const map = createEmptyMap()

    expect(map.status).toBe('draft')
    expect(map.activities).toHaveLength(0)
    expect(map.roles).toHaveLength(0)
    expect(map.title).toBe('Untitled process map')
  })

  it('computes readiness for a complete map', () => {
    const readiness = computeReadiness(sampleMap)

    expect(readiness.hasActivities).toBe(true)
    expect(readiness.hasRoles).toBe(true)
    expect(readiness.isReady).toBe(true)
    expect(readiness.missing).toHaveLength(0)
  })

  it('computes readiness as not ready for empty map', () => {
    const readiness = computeReadiness(createEmptyMap())

    expect(readiness.hasActivities).toBe(false)
    expect(readiness.hasRoles).toBe(false)
    expect(readiness.isReady).toBe(false)
    expect(readiness.missing).toContain('Add at least one activity.')
    expect(readiness.missing).toContain('Add at least one role.')
  })
})
