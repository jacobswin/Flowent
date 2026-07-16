import { describe, expect, it } from 'vitest'
import { normalizeAiMapDraft } from './normalizeAiMapDraft'

describe('normalizeAiMapDraft', () => {
  it('normalizes model output into the current GraphDocument shape', async () => {
    const result = await normalizeAiMapDraft({
      title: 'Release readiness',
      summary: 'Prepare a release for customer rollout.',
      nodes: [
        { id: 'stage-prep', type: 'stage', title: 'Prepare release', goal: 'Release is ready', owner: 'PM' },
        { id: 'activity-check', type: 'activity', title: 'Run readiness check', summary: 'Check blockers', responsibilities: [{ roleName: 'QA', kind: 'accountable' }], inputs: [{ workProductId: 'wp-plan', maturity: 'Draft' }], outputs: [{ workProductId: 'wp-plan', maturity: 'Approved' }] },
      ],
      edges: [
        { id: 'edge-prep-check', sourceNodeId: 'stage-prep', targetNodeId: 'activity-check', label: 'Readiness work' },
      ],
      workProducts: [
        { id: 'wp-plan', title: 'Release plan', state: 'Draft', description: 'Plan for release' },
      ],
      guidanceItems: [],
      milestones: [
        { id: 'ms-ready', title: 'Ready to launch', description: 'All checks pass', stageNodeId: 'stage-prep', workProductStates: [{ workProductId: 'wp-plan', state: 'Approved' }] },
      ],
      assumptions: [],
      risks: [],
      missingInformation: [],
    })

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.document.nodes.start.type).toBe('start')
    expect(result.document.nodes.end.type).toBe('end')
    expect(result.document.meta).toMatchObject({
      layoutProfile: 'left-to-right',
      layoutNodeOrder: ['stage-prep', 'activity-check'],
    })
    expect(result.document.nodes['activity-check'].responsibilities).toEqual([
      expect.objectContaining({ roleName: 'QA', kind: 'accountable' }),
    ])
    expect(result.document.processAssets?.workProducts['wp-plan'].activityLinks).toEqual([
      expect.objectContaining({ nodeId: 'activity-check', relation: 'input', maturity: 'Draft' }),
      expect.objectContaining({ nodeId: 'activity-check', relation: 'output', maturity: 'Approved' }),
    ])
    expect(result.document.processAssets?.milestones['ms-ready'].workProductStates).toEqual([
      { workProductId: 'wp-plan', state: 'Approved' },
    ])
  })

  it('keeps explicit process intelligence data on activities and the generated map', async () => {
    const result = await normalizeAiMapDraft({
      title: 'Measured release review',
      summary: 'Review a release brief before publication.',
      processAnalysis: { profile: 'services', wip: 4 },
      nodes: [
        {
          id: 'wait-approval',
          type: 'activity',
          title: 'Wait for release approval',
          processStage: {
            kind: 'wait',
            durationMinutesP50: 90,
            durationMinutesP90: 180,
            classificationSource: 'explicit',
          },
        },
      ],
      edges: [],
      workProducts: [],
      guidanceItems: [],
      milestones: [],
      assumptions: [],
      risks: [],
      missingInformation: [],
    })

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.document.nodes['wait-approval'].processStage).toEqual({
      kind: 'wait',
      durationMinutesP50: 90,
      durationMinutesP90: 180,
      classificationSource: 'explicit',
    })
    expect(result.document.meta.processAnalysis).toEqual({ profile: 'services', wip: 4 })
  })

  it('accepts a serialized GraphDocument envelope returned by a model', async () => {
    const result = await normalizeAiMapDraft({
      title: 'Production early involvement',
      summary: 'Bring production input into product work early.',
      document: {
        id: 'ai-production-early-involvement',
        nodes: {
          start: { id: 'start', type: 'start', title: 'Start' },
          'activity-review': {
            id: 'activity-review',
            type: 'activity',
            title: 'Review production impact',
            summary: 'Production reviews the proposal before implementation.',
            responsibilities: [{ id: 'r1', roleName: 'Production Engineer', kind: 'responsible' }],
          },
          end: { id: 'end', type: 'end', title: 'End' },
        },
        edges: {
          'handoff-start-review': { id: 'handoff-start-review', sourceNodeId: 'start', targetNodeId: 'activity-review', label: 'Start review' },
          'handoff-review-end': { id: 'handoff-review-end', sourceNodeId: 'activity-review', targetNodeId: 'end', label: 'Review complete' },
        },
        processAssets: {
          workProducts: {
            'wp-production-brief': {
              id: 'wp-production-brief',
              title: 'Production brief',
              state: 'Draft',
              description: 'Early production considerations.',
              activityLinks: [
                { id: 'link-1', nodeId: 'activity-review', relation: 'input', maturity: 'Draft' },
                { id: 'link-2', nodeId: 'activity-review', relation: 'output', maturity: 'Approved' },
              ],
              producerNodeIds: [],
              consumerNodeIds: [],
              handoffEdgeIds: ['handoff-review-end'],
              guidanceIds: [],
            },
          },
          guidanceItems: {},
          milestones: {},
        },
      },
      findings: [],
    })

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.document.nodes['activity-review'].title).toBe('Review production impact')
    expect(result.document.edges['handoff-review-end'].label).toBe('Review complete')
    expect(result.document.processAssets?.workProducts['wp-production-brief'].activityLinks).toEqual(expect.arrayContaining([
      expect.objectContaining({ nodeId: 'activity-review', relation: 'input', maturity: 'Draft' }),
      expect.objectContaining({ nodeId: 'activity-review', relation: 'output', maturity: 'Approved' }),
    ]))
  })

  it('repairs common model field variants before schema validation', async () => {
    const result = await normalizeAiMapDraft({
      title: 'Customer feedback triage',
      summary: 'Turn incoming feedback into a prioritization decision.',
      nodes: [
        {
          type: 'activity',
          title: 'Collect feedback',
          responsibilities: [{ roleName: 'Support', kind: 'R' }],
          outputs: [{ title: 'Feedback summary', maturity: 'Draft' }],
        },
        {
          type: 'decision',
          title: 'Prioritize feedback?',
          owner: 'Product Lead',
          outcomes: ['Add to roadmap', 'Monitor'],
          inputs: ['Feedback summary'],
        },
      ],
      edges: [
        { source: 'Collect feedback', target: 'Prioritize feedback?', name: 'Share summary' },
      ],
      workProducts: [
        { title: 'Feedback summary', defaultMaturity: 'Draft' },
      ],
      guidance: [
        { title: 'Feedback checklist', kind: 'Checklist', appliesToNodeIds: ['Collect feedback'] },
      ],
    })

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.document.nodes['collect-feedback'].responsibilities).toEqual([
      expect.objectContaining({ roleName: 'Support', kind: 'responsible' }),
    ])
    expect(result.document.edges['handoff-collect-feedback-prioritize-feedback-1'].targetNodeId).toBe('prioritize-feedback')
    expect(result.document.processAssets?.workProducts['feedback-summary'].title).toBe('Feedback summary')
    expect(result.document.processAssets?.guidanceItems['feedback-checklist'].kind).toBe('checklist')
  })

  it('connects partially isolated generated nodes into a readable mainline', async () => {
    const result = await normalizeAiMapDraft({
      title: 'Deviation handling',
      summary: 'Assess and resolve DVP deviations.',
      nodes: [
        { id: 'risk-assessment', type: 'activity', title: 'Assess deviation risk' },
        { id: 'write-report', type: 'activity', title: 'Write deviation report' },
        { id: 'review-report', type: 'decision', title: 'Approve deviation?', owner: 'SVE', criteria: 'Risk is acceptable', decisionOutcomes: ['Approve', 'Rework'] },
        { id: 'archive-record', type: 'activity', title: 'Archive approved record' },
      ],
      edges: [
        { id: 'edge-risk-report', sourceNodeId: 'risk-assessment', targetNodeId: 'write-report', label: 'Risk result' },
      ],
      workProducts: [],
      guidanceItems: [],
      milestones: [],
      assumptions: [],
      risks: [],
      missingInformation: [],
    })

    expect(result.success).toBe(true)
    if (!result.success) return

    expect(hasEdge(result.document.edges, 'start', 'risk-assessment')).toBe(true)
    expect(hasEdge(result.document.edges, 'risk-assessment', 'write-report')).toBe(true)
    expect(hasEdge(result.document.edges, 'write-report', 'review-report')).toBe(true)
    expect(hasEdge(result.document.edges, 'review-report', 'archive-record')).toBe(true)
    expect(hasEdge(result.document.edges, 'archive-record', 'end')).toBe(true)
  })

  it('uses default Flow layout with left-to-right anchors for AI drafts', async () => {
    const result = await normalizeAiMapDraft({
      title: 'DVP deviation handling',
      summary: 'Handle DVP trial deviations through risk and temporary-deviation decisions.',
      nodes: [
        { id: 'trigger', type: 'activity', title: 'DVP试验偏差产生' },
        { id: 'risk', type: 'decision', title: '步骤0：风险评估', decisionOutcomes: ['低风险', '高风险/法规类/中风险'] },
        { id: 'temporary', type: 'decision', title: '是否临时偏差', decisionOutcomes: ['否', '是'] },
        { id: 'formal-report', type: 'activity', title: '步骤1：DRE编制评审报告' },
        { id: 'archive', type: 'activity', title: '步骤6：归档' },
        { id: 'blocked', type: 'activity', title: '禁止偏差，必须整改' },
        { id: 'temporary-report', type: 'activity', title: '步骤1：DRE编制临时偏差评审报告' },
        { id: 'expiry', type: 'decision', title: '到期问题是否解决', decisionOutcomes: ['到期问题解决', '到期仍存在问题'] },
      ],
      edges: [
        { id: 'trigger-risk', sourceNodeId: 'trigger', targetNodeId: 'risk', label: '产生偏差' },
        { id: 'risk-blocked', sourceNodeId: 'risk', targetNodeId: 'blocked', label: '高风险/法规类/中风险' },
        { id: 'risk-temporary', sourceNodeId: 'risk', targetNodeId: 'temporary', label: '低风险' },
        { id: 'temporary-formal', sourceNodeId: 'temporary', targetNodeId: 'formal-report', label: '否' },
        { id: 'temporary-temp', sourceNodeId: 'temporary', targetNodeId: 'temporary-report', label: '是' },
        { id: 'formal-archive', sourceNodeId: 'formal-report', targetNodeId: 'archive', label: '正式修订完成' },
        { id: 'temporary-expiry', sourceNodeId: 'temporary-report', targetNodeId: 'expiry', label: '限期整改' },
        { id: 'expiry-archive', sourceNodeId: 'expiry', targetNodeId: 'archive', label: '到期问题解决' },
        { id: 'expiry-risk', sourceNodeId: 'expiry', targetNodeId: 'risk', label: '到期仍存在问题' },
      ],
      workProducts: [],
      guidanceItems: [],
      milestones: [],
      assumptions: [],
      risks: [],
      missingInformation: [],
    })

    expect(result.success).toBe(true)
    if (!result.success) return

    const { nodes, edges } = result.document
    expect(result.document.meta.layoutProfile).toBe('left-to-right')
    expect(centerX(nodes.trigger)).toBeLessThan(centerX(nodes.risk))
    expect(centerX(nodes.risk)).toBeLessThan(centerX(nodes.temporary))
    expect(centerX(nodes.temporary)).toBeLessThan(centerX(nodes['formal-report']))
    expect(centerX(nodes['formal-report'])).toBeLessThan(centerX(nodes.archive))
    expect(centerX(nodes['temporary-report'])).toBeGreaterThan(centerX(nodes.temporary))
    expect(edges['trigger-risk']).toMatchObject({ sourceAnchor: { side: 'right', offset: 0.5 }, targetAnchor: { side: 'left', offset: 0.5 } })
    expect(edges['risk-blocked']).toMatchObject({ sourceAnchor: { side: 'right', offset: 0.5 }, targetAnchor: { side: 'left', offset: 0.5 } })
    expect(edges['temporary-temp']).toMatchObject({ sourceAnchor: { side: 'right', offset: 0.5 }, targetAnchor: { side: 'left', offset: 0.5 } })
  })

  it('repairs decision-like activities into decision nodes before layout', async () => {
    const result = await normalizeAiMapDraft({
      title: 'Deviation review',
      summary: 'Review deviation risk and temporary path.',
      nodes: [
        { id: 'trigger', type: 'activity', title: 'DVP试验偏差产生' },
        { id: 'risk', type: 'activity', title: '步骤0：风险评估', decisionOutcomes: ['低风险', '高风险'] },
        { id: 'temporary', type: 'activity', title: '是否临时偏差', decisionOutcomes: ['否', '是'] },
        { id: 'archive', type: 'activity', title: '步骤6：归档' },
      ],
      edges: [
        { id: 'trigger-risk', sourceNodeId: 'trigger', targetNodeId: 'risk', label: '' },
        { id: 'risk-temporary', sourceNodeId: 'risk', targetNodeId: 'temporary', label: '' },
        { id: 'temporary-archive', sourceNodeId: 'temporary', targetNodeId: 'archive', label: '' },
      ],
      workProducts: [],
      guidanceItems: [],
      milestones: [],
      assumptions: [],
      risks: [],
      missingInformation: [],
    })

    expect(result.success).toBe(true)
    if (!result.success) return

    expect(result.document.nodes.risk.type).toBe('decision')
    expect(result.document.nodes.temporary.type).toBe('decision')
    expect(result.document.edges['risk-temporary'].label).toBe('低风险')
    expect(result.document.edges['temporary-archive'].label).toBe('否')
  })

  it('turns direct activity loopbacks into conditional decision branches', async () => {
    const result = await normalizeAiMapDraft({
      title: 'Deviation rework',
      summary: 'Review a deviation and rework only when required.',
      nodes: [
        { id: 'submit-report', type: 'activity', title: '提交偏差报告' },
        { id: 'fix-issue', type: 'activity', title: '整改问题' },
        { id: 'archive', type: 'activity', title: '归档' },
      ],
      edges: [
        { id: 'submit-fix', sourceNodeId: 'submit-report', targetNodeId: 'fix-issue', label: '' },
        { id: 'fix-submit', sourceNodeId: 'fix-issue', targetNodeId: 'submit-report', label: '' },
      ],
      workProducts: [],
      guidanceItems: [],
      milestones: [],
      assumptions: [],
      risks: [],
      missingInformation: [],
    })

    expect(result.success).toBe(true)
    if (!result.success) return

    expect(result.document.meta.layoutNodeOrder).toEqual([
      'submit-report',
      'fix-issue',
      'loop-decision-fix-issue',
      'archive',
    ])
    expect(result.document.nodes['loop-decision-fix-issue']).toMatchObject({
      type: 'decision',
      title: '是否需要返回提交偏差报告?',
      decisionOutcomes: ['需要返回', '继续'],
    })
    expect(result.document.edges['fix-submit']).toMatchObject({
      sourceNodeId: 'loop-decision-fix-issue',
      targetNodeId: 'submit-report',
      label: '需要返回',
    })
    expect(result.document.edges['handoff-mainline-2']).toMatchObject({
      sourceNodeId: 'loop-decision-fix-issue',
      targetNodeId: 'archive',
      label: '继续',
    })
    expect(Object.values(result.document.edges)).not.toContainEqual(expect.objectContaining({
      sourceNodeId: 'fix-issue',
      targetNodeId: 'submit-report',
    }))
  })

  it('rejects edges that reference unknown nodes', async () => {
    const result = await normalizeAiMapDraft({
      title: 'Broken',
      nodes: [{ id: 'activity-a', type: 'activity', title: 'A' }],
      edges: [{ id: 'edge-a-b', sourceNodeId: 'activity-a', targetNodeId: 'missing', label: '' }],
      workProducts: [],
      guidanceItems: [],
      milestones: [],
      assumptions: [],
      risks: [],
      missingInformation: [],
    })

    expect(result).toEqual({ success: false, error: 'Generated edge edge-a-b references an unknown node.' })
  })
})

function hasEdge(
  edges: Record<string, { sourceNodeId: string; targetNodeId: string }>,
  sourceNodeId: string,
  targetNodeId: string,
): boolean {
  return Object.values(edges).some((edge) =>
    edge.sourceNodeId === sourceNodeId && edge.targetNodeId === targetNodeId,
  )
}

function centerX(node: { x: number; width: number }): number {
  return node.x + node.width / 2
}
