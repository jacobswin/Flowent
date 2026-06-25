import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { GraphDocument, ProcessNode } from './canvasTypes'
import { toGraphNode } from './nodeProjection'
import { useCanvasState } from './useCanvasState'
import { createEmptyDocument } from './engine/graphDocument'

describe('toGraphNode', () => {
  it('projects activity nodes with canonical dimensions and horizontal ports', () => {
    // Arrange
    const node: ProcessNode = {
      id: 'activity-1',
      type: 'activity',
      position: { x: 120, y: 240 },
      data: {
        title: 'Interview users',
        summary: 'Collect evidence before building',
        roleIds: ['PM', 'Design'],
        expectations: 'Share notes within 24h',
        kind: 'activity',
      },
    }

    // Act
    const graphNode = toGraphNode(node)

    // Assert
    expect(graphNode).toMatchObject({
      id: 'activity-1',
      type: 'activity',
      x: 120,
      y: 240,
      width: 220,
      height: 112,
      title: 'Interview users',
      summary: 'Collect evidence before building',
      expectations: 'Share notes within 24h',
      roleTags: ['PM', 'Design'],
    })
    expect(graphNode.ports).toEqual([
      { id: 'in', side: 'left' },
      { id: 'out', side: 'right' },
    ])
  })

  it('projects decision nodes to the migrated two-port schema and preserves decision metadata', () => {
    // Arrange
    const node: ProcessNode = {
      id: 'decision-1',
      type: 'decision',
      position: { x: 300, y: 180 },
      data: {
        title: 'Proceed to delivery?',
        criteria: 'Research confidence and capacity',
        decisionOutcomes: ['Proceed', 'Pause'],
        owner: 'Product trio',
        kind: 'decision',
      },
    }

    // Act
    const graphNode = toGraphNode(node)

    // Assert
    expect(graphNode).toMatchObject({
      id: 'decision-1',
      type: 'decision',
      x: 300,
      y: 180,
      width: 190,
      height: 124,
      title: 'Proceed to delivery?',
      criteria: 'Research confidence and capacity',
      decisionOutcomes: ['Proceed', 'Pause'],
      owner: 'Product trio',
      roleTags: [],
    })
    expect(graphNode.ports).toEqual([
      { id: 'in', side: 'left' },
      { id: 'out', side: 'right' },
    ])
  })

  it('projects stage nodes with Flowent stage fields intact', () => {
    // Arrange
    const node: ProcessNode = {
      id: 'stage-1',
      type: 'stage',
      position: { x: 40, y: 80 },
      data: {
        title: 'Discovery',
        goal: 'Reduce uncertainty before committing',
        entryCondition: 'Opportunity framed',
        exitCondition: 'Decision made',
        owner: 'PM',
        kind: 'stage',
      },
    }

    // Act
    const graphNode = toGraphNode(node)

    // Assert
    expect(graphNode).toMatchObject({
      id: 'stage-1',
      type: 'stage',
      x: 40,
      y: 80,
      width: 280,
      height: 132,
      title: 'Discovery',
      goal: 'Reduce uncertainty before committing',
      entryCondition: 'Opportunity framed',
      exitCondition: 'Decision made',
      owner: 'PM',
      roleTags: [],
    })
    expect(graphNode.ports).toEqual([
      { id: 'in', side: 'left' },
      { id: 'out', side: 'right' },
    ])
  })

  it('projects bottleneck nodes with review metadata intact', () => {
    // Arrange
    const node: ProcessNode = {
      id: 'bottleneck-1',
      type: 'bottleneck',
      position: { x: 520, y: 140 },
      data: {
        title: 'Hand-off delay',
        symptom: 'Work waits for review',
        impact: 'Cycle time expands',
        suspectedCause: 'Owner is unclear',
        reviewStatus: 'needs-owner',
        kind: 'bottleneck',
      },
    }

    // Act
    const graphNode = toGraphNode(node)

    // Assert
    expect(graphNode).toMatchObject({
      id: 'bottleneck-1',
      type: 'bottleneck',
      x: 520,
      y: 140,
      width: 220,
      height: 104,
      title: 'Hand-off delay',
      symptom: 'Work waits for review',
      impact: 'Cycle time expands',
      suspectedCause: 'Owner is unclear',
      reviewStatus: 'needs-owner',
      roleTags: [],
    })
    expect(graphNode.ports).toEqual([
      { id: 'in', side: 'left' },
      { id: 'out', side: 'right' },
    ])
  })

  it('projects start and end nodes with side-facing ports', () => {
    // Arrange
    const start: ProcessNode = {
      id: 'start-1',
      type: 'startEnd',
      position: { x: 100, y: 120 },
      data: {
        label: 'Start',
        kind: 'start',
      },
    }
    const end: ProcessNode = {
      id: 'end-1',
      type: 'startEnd',
      position: { x: 500, y: 120 },
      data: {
        label: 'Done',
        kind: 'end',
      },
    }

    // Act
    const startNode = toGraphNode(start)
    const endNode = toGraphNode(end)

    // Assert
    expect(startNode).toMatchObject({
      id: 'start-1',
      type: 'start',
      x: 100,
      y: 120,
      width: 120,
      height: 56,
      title: 'Start',
      roleTags: [],
    })
    expect(startNode.ports).toEqual([{ id: 'out', side: 'right' }])

    expect(endNode).toMatchObject({
      id: 'end-1',
      type: 'end',
      x: 500,
      y: 120,
      width: 120,
      height: 56,
      title: 'Done',
      roleTags: [],
    })
    expect(endNode.ports).toEqual([{ id: 'in', side: 'left' }])
  })

  it('defaults sparse optional fields to the canonical graph shape', () => {
    // Arrange
    const activity: ProcessNode = {
      id: 'activity-sparse',
      type: 'activity',
      position: { x: 10, y: 20 },
      data: {
        title: 'Sparse activity',
        summary: '',
        roleIds: [],
        kind: 'activity',
      },
    }
    const decision: ProcessNode = {
      id: 'decision-sparse',
      type: 'decision',
      position: { x: 30, y: 40 },
      data: {
        title: 'Sparse decision',
        criteria: '',
        kind: 'decision',
      },
    }

    // Act
    const activityGraph = toGraphNode(activity)
    const decisionGraph = toGraphNode(decision)

    // Assert
    expect(activityGraph.expectations).toBe('')
    expect(activityGraph.ports).toEqual([
      { id: 'in', side: 'left' },
      { id: 'out', side: 'right' },
    ])
    expect(decisionGraph.decisionOutcomes).toEqual([])
    expect(decisionGraph.owner).toBe('')
    expect(decisionGraph.ports).toEqual([
      { id: 'in', side: 'left' },
      { id: 'out', side: 'right' },
    ])
  })

  it('prefers node.type over mismatched data.kind so malformed runtime data keeps its canonical shape', () => {
    // Arrange
    const malformed = {
      id: 'decision-mismatch',
      type: 'decision',
      position: { x: 140, y: 220 },
      data: {
        title: 'Broken persisted node',
        summary: 'wrong payload shape',
        roleIds: ['PM'],
        kind: 'activity',
      },
    } as unknown as ProcessNode

    // Act
    const graphNode = toGraphNode(malformed)

    // Assert
    expect(graphNode.type).toBe('decision')
    expect(graphNode.width).toBe(190)
    expect(graphNode.height).toBe(124)
    expect(graphNode.ports).toEqual([
      { id: 'in', side: 'left' },
      { id: 'out', side: 'right' },
    ])
    expect(graphNode.title).toBe('Broken persisted node')
    expect(graphNode.criteria).toBe('')
    expect(graphNode.decisionOutcomes).toEqual([])
    expect(graphNode.owner).toBe('')
  })

  it('round-trips canonical graph nodes through useCanvasState without drifting shape-critical fields', () => {
    // Arrange
    const initialDocument: GraphDocument = {
      ...createEmptyDocument('roundtrip-test'),
      nodes: new Map([
        [
          'stage-1',
          {
            id: 'stage-1',
            type: 'stage',
            x: 40,
            y: 80,
            width: 280,
            height: 132,
            title: 'Discovery',
            goal: 'Reduce uncertainty',
            entryCondition: 'Problem framed',
            exitCondition: 'Decision made',
            owner: 'PM',
            roleTags: [],
            ports: [
              { id: 'in', side: 'left' as const },
              { id: 'out', side: 'right' as const },
            ],
          },
        ],
        [
          'bottleneck-1',
          {
            id: 'bottleneck-1',
            type: 'bottleneck',
            x: 400,
            y: 120,
            width: 220,
            height: 104,
            title: 'Review queue',
            symptom: 'Work piles up',
            impact: 'Delivery slows',
            suspectedCause: 'Owner unclear',
            reviewStatus: 'needs-owner' as const,
            roleTags: [],
            ports: [
              { id: 'in', side: 'left' as const },
              { id: 'out', side: 'right' as const },
            ],
          },
        ],
      ]),
    }

    const { result } = renderHook(() => useCanvasState({ initialDocument }))

    const stage = result.current.nodes.find((node) => node.id === 'stage-1')
    const bottleneck = result.current.nodes.find((node) => node.id === 'bottleneck-1')
    expect(stage).toBeTruthy()
    expect(bottleneck).toBeTruthy()

    // Act
    act(() => {
      result.current.addEnd({ x: 720, y: 180 })
    })

    // Assert
    const stageAfter = result.current.nodes.find((node) => node.id === 'stage-1')
    const bottleneckAfter = result.current.nodes.find((node) => node.id === 'bottleneck-1')
    expect(stageAfter).toMatchObject({
      data: {
        kind: 'stage',
        title: 'Discovery',
        goal: 'Reduce uncertainty',
        entryCondition: 'Problem framed',
        exitCondition: 'Decision made',
        owner: 'PM',
      },
    })
    expect(bottleneckAfter).toMatchObject({
      data: {
        kind: 'bottleneck',
        title: 'Review queue',
        symptom: 'Work piles up',
        impact: 'Delivery slows',
        suspectedCause: 'Owner unclear',
        reviewStatus: 'needs-owner',
      },
    })
  })
})
