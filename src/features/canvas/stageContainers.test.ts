import { describe, expect, it } from 'vitest'
import { createEmptyDocument } from './engine/graphDocument'
import { createGraphNode } from './processElements'
import { addNodeToStage, syncStageContainers } from './stageContainers'

describe('Stage containers', () => {
  it('keeps one Map Stage membership per node and derives container bounds from its members', () => {
    const activity = createGraphNode('activity', 'activity-1', { x: 180, y: 120 })
    const decision = createGraphNode('decision', 'decision-1', { x: 500, y: 260 })
    const firstStage = {
      ...createGraphNode('stage', 'stage-1', { x: 0, y: 0 }),
      memberNodeIds: [activity.id, decision.id],
    }
    const secondStage = createGraphNode('stage', 'stage-2', { x: 720, y: 0 })
    const document = syncStageContainers({
      ...createEmptyDocument('map-1'),
      nodes: new Map([[activity.id, activity], [decision.id, decision], [firstStage.id, firstStage], [secondStage.id, secondStage]]),
    })

    const resized = document.nodes.get('stage-1')!
    expect(resized.memberNodeIds).toEqual(['activity-1', 'decision-1'])
    expect(resized.x).toBeLessThanOrEqual(activity.x - 24)
    expect(resized.y).toBeLessThanOrEqual(activity.y - 24)
    expect(resized.x + resized.width).toBeGreaterThanOrEqual(decision.x + decision.width + 24)

    const moved = addNodeToStage(document, 'stage-2', 'activity-1')
    expect(moved.nodes.get('stage-1')?.memberNodeIds).toEqual(['decision-1'])
    expect(moved.nodes.get('stage-2')?.memberNodeIds).toEqual(['activity-1'])
  })
})
