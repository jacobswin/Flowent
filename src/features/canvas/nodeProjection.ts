import type { GraphNode, ProcessNode, ProcessNodeData } from './canvasTypes'
import { createGraphNode } from './processElements'

function getFallbackTitle(base: GraphNode, data: ProcessNodeData): string {
  const candidate = isStartEndData(data) ? data.label : data.title
  return typeof candidate === 'string' && candidate.trim().length > 0 ? candidate : base.title
}

function isActivityData(data: ProcessNode['data']): data is Extract<ProcessNode['data'], { kind: 'activity' }> {
  return data.kind === 'activity'
}

function isDecisionData(data: ProcessNode['data']): data is Extract<ProcessNode['data'], { kind: 'decision' }> {
  return data.kind === 'decision'
}

function isStageData(data: ProcessNode['data']): data is Extract<ProcessNode['data'], { kind: 'stage' }> {
  return data.kind === 'stage'
}

function isBottleneckData(data: ProcessNode['data']): data is Extract<ProcessNode['data'], { kind: 'bottleneck' }> {
  return data.kind === 'bottleneck'
}

function isStartEndData(data: ProcessNode['data']): data is Extract<ProcessNode['data'], { kind: 'start' | 'end' }> {
  return data.kind === 'start' || data.kind === 'end'
}

// Runtime-loaded ProcessNodes are plain data, not a validated union. When
// `node.type` and `node.data.kind` disagree, prefer the top-level `type`
// so a malformed node can't silently remap to a different canonical graph
// shape (for example, decision -> activity). The only exception is the
// `startEnd` wrapper type, where `data.kind` is the runtime discriminator
// for start vs end.
export function toGraphNode(node: ProcessNode): GraphNode {
  switch (node.type) {
    case 'activity': {
      const base = createGraphNode('activity', node.id, node.position)
      if (!isActivityData(node.data)) {
        return {
          ...base,
          title: getFallbackTitle(base, node.data),
        }
      }
      return {
        ...base,
        title: node.data.title,
        summary: node.data.summary,
        expectations: node.data.expectations ?? '',
        roleTags: [...node.data.roleIds],
      }
    }

    case 'decision': {
      const base = createGraphNode('decision', node.id, node.position)
      if (!isDecisionData(node.data)) {
        return {
          ...base,
          title: getFallbackTitle(base, node.data),
        }
      }
      return {
        ...base,
        title: node.data.title,
        criteria: node.data.criteria,
        decisionOutcomes: [...(node.data.decisionOutcomes ?? [])],
        owner: node.data.owner ?? '',
        roleTags: [],
      }
    }

    case 'stage': {
      const base = createGraphNode('stage', node.id, node.position)
      if (!isStageData(node.data)) {
        return {
          ...base,
          title: getFallbackTitle(base, node.data),
        }
      }
      return {
        ...base,
        title: node.data.title,
        goal: node.data.goal,
        entryCondition: node.data.entryCondition,
        exitCondition: node.data.exitCondition,
        owner: node.data.owner,
        roleTags: [],
      }
    }

    case 'bottleneck': {
      const base = createGraphNode('bottleneck', node.id, node.position)
      if (!isBottleneckData(node.data)) {
        return {
          ...base,
          title: getFallbackTitle(base, node.data),
        }
      }
      return {
        ...base,
        title: node.data.title,
        symptom: node.data.symptom,
        impact: node.data.impact,
        suspectedCause: node.data.suspectedCause,
        reviewStatus: node.data.reviewStatus,
        roleTags: [],
      }
    }

    case 'startEnd': {
      const startEndKind = isStartEndData(node.data) && node.data.kind === 'end' ? 'end' : 'start'
      const base = createGraphNode(startEndKind, node.id, node.position)
      return {
        ...base,
        title: isStartEndData(node.data) ? node.data.label : getFallbackTitle(base, node.data),
        roleTags: [],
      }
    }
  }
}
