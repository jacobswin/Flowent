import type { ProcessMap } from './types'

export const sampleProcessMap: ProcessMap = {
  id: 'product-experience-change',
  title: 'Product experience change process',
  status: 'draft',
  scenario:
    'A product team needs to change a role-navigation screen after a customer feedback review reveals unclear handoffs.',
  roles: [
    {
      id: 'product-manager',
      kind: 'role',
      name: 'Product Manager',
      focus: 'Clarifies user expectations and accepts release readiness.',
    },
    {
      id: 'frontend-engineer',
      kind: 'role',
      name: 'Frontend Engineer',
      focus: 'Turns agreed expectations into an inspectable interface change.',
    },
    {
      id: 'backend-engineer',
      kind: 'role',
      name: 'Backend Engineer',
      focus: 'Confirms API behavior and integration constraints.',
    },
    {
      id: 'qa-engineer',
      kind: 'role',
      name: 'QA Engineer',
      focus: 'Validates that the change satisfies the agreed behavior.',
    },
  ],
  stakeholders: [
    {
      id: 'design-lead',
      kind: 'stakeholder',
      name: 'Design Lead',
    },
  ],
  upstreamActors: [
    {
      id: 'customer-feedback-group',
      kind: 'upstream',
      name: 'Customer Feedback Group',
    },
  ],
  downstreamActors: [
    {
      id: 'release-team',
      kind: 'downstream',
      name: 'Release Team',
    },
  ],
  inputs: [
    {
      id: 'approved-change-request',
      title: 'Approved change request',
      sourceActorIds: ['product-manager'],
    },
    {
      id: 'updated-interaction-expectations',
      title: 'Updated interaction expectations',
      sourceActorIds: ['product-manager'],
    },
    {
      id: 'api-contract-notes',
      title: 'API contract notes',
      sourceActorIds: ['backend-engineer'],
    },
    {
      id: 'acceptance-criteria',
      title: 'Acceptance criteria',
      sourceActorIds: ['product-manager'],
    },
    {
      id: 'updated-role-navigation-screen-input',
      title: 'Updated role navigation screen',
      sourceActorIds: ['frontend-engineer'],
    },
  ],
  outputs: [
    {
      id: 'ui-impact-notes',
      title: 'UI impact notes',
      producerActorIds: ['frontend-engineer'],
      recipientActorIds: ['product-manager'],
    },
    {
      id: 'updated-role-navigation-screen',
      title: 'Updated role navigation screen',
      producerActorIds: ['frontend-engineer'],
      recipientActorIds: ['qa-engineer'],
    },
    {
      id: 'validation-result',
      title: 'Validation result',
      producerActorIds: ['qa-engineer'],
      recipientActorIds: ['product-manager'],
    },
  ],
  workProducts: [
    {
      id: 'role-navigation-spec',
      title: 'Role navigation expectation note',
      state: 'reviewed',
    },
    {
      id: 'interface-change',
      title: 'Role navigation interface change',
      state: 'ready for validation',
    },
    {
      id: 'release-readiness-note',
      title: 'Release readiness note',
      state: 'draft',
    },
  ],
  expectations: [
    {
      id: 'traceable-ui-change',
      title: 'UI change is traceable to the approved request',
      detail: 'The implemented interface maps back to the approved change request and expectation note.',
      roleIds: ['frontend-engineer'],
    },
    {
      id: 'qa-ready-without-assumptions',
      title: 'Implementation is ready for QA without hidden assumptions',
      detail: 'QA receives the changed screen with acceptance criteria and known integration notes.',
      roleIds: ['frontend-engineer', 'qa-engineer'],
    },
    {
      id: 'validation-is-actionable',
      title: 'Validation result explains release risk',
      detail: 'Validation output should state whether remaining risk is acceptable for release readiness.',
      roleIds: ['qa-engineer'],
    },
  ],
  decisions: [
    {
      id: 'api-clear-enough',
      title: 'Is API behavior clear enough to implement?',
      affectedActorIds: ['frontend-engineer', 'backend-engineer'],
      criteria: 'Frontend and backend agree on data availability, loading states, and error behavior.',
    },
    {
      id: 'release-risk-acceptable',
      title: 'Is release risk acceptable?',
      affectedActorIds: ['product-manager', 'frontend-engineer', 'qa-engineer', 'design-lead'],
      criteria: 'Validation result and remaining issues are understood by Product and QA.',
    },
  ],
  handoffs: [
    {
      id: 'product-clarifies-ui',
      title: 'Product clarifies UI expectations',
      fromActorIds: ['product-manager'],
      toActorIds: ['frontend-engineer'],
      inputIds: ['approved-change-request', 'updated-interaction-expectations'],
      outputIds: ['ui-impact-notes'],
      expectationIds: ['traceable-ui-change'],
    },
    {
      id: 'backend-confirms-contract',
      title: 'Backend confirms API contract',
      fromActorIds: ['backend-engineer'],
      toActorIds: ['frontend-engineer'],
      inputIds: ['api-contract-notes'],
      outputIds: [],
      expectationIds: ['qa-ready-without-assumptions'],
    },
    {
      id: 'frontend-hands-build-to-qa',
      title: 'Frontend hands build to QA',
      fromActorIds: ['frontend-engineer'],
      toActorIds: ['qa-engineer'],
      inputIds: ['updated-role-navigation-screen-input', 'acceptance-criteria'],
      outputIds: ['updated-role-navigation-screen'],
      expectationIds: ['qa-ready-without-assumptions'],
    },
  ],
  activities: [
    {
      id: 'assess-ui-impact',
      title: 'Assess UI impact',
      summary: 'Review the approved request and identify which role-navigation states need to change.',
      responsibilities: [
        { actorId: 'frontend-engineer', kind: 'responsible' },
        { actorId: 'product-manager', kind: 'consulted' },
        { actorId: 'design-lead', kind: 'consulted' },
      ],
      inputIds: ['approved-change-request', 'updated-interaction-expectations'],
      outputIds: ['ui-impact-notes'],
      decisionIds: [],
      handoffIds: ['product-clarifies-ui'],
      expectationIds: ['traceable-ui-change'],
      workProductIds: ['role-navigation-spec'],
    },
    {
      id: 'implement-interface-change',
      title: 'Implement interface change',
      summary: 'Update the interface according to clarified expectations and confirmed API behavior.',
      responsibilities: [
        { actorId: 'frontend-engineer', kind: 'responsible' },
        { actorId: 'backend-engineer', kind: 'supporting' },
      ],
      inputIds: ['updated-interaction-expectations', 'api-contract-notes'],
      outputIds: ['updated-role-navigation-screen'],
      decisionIds: ['api-clear-enough'],
      handoffIds: ['backend-confirms-contract', 'frontend-hands-build-to-qa'],
      expectationIds: ['traceable-ui-change', 'qa-ready-without-assumptions'],
      workProductIds: ['interface-change'],
    },
    {
      id: 'validate-change-behavior',
      title: 'Validate change behavior',
      summary: 'Confirm the changed role-navigation screen satisfies acceptance criteria.',
      responsibilities: [
        { actorId: 'qa-engineer', kind: 'responsible' },
        { actorId: 'product-manager', kind: 'consulted' },
      ],
      inputIds: ['updated-role-navigation-screen-input', 'acceptance-criteria'],
      outputIds: ['validation-result'],
      decisionIds: [],
      handoffIds: ['frontend-hands-build-to-qa'],
      expectationIds: ['validation-is-actionable'],
      workProductIds: ['release-readiness-note'],
    },
    {
      id: 'support-release-readiness-review',
      title: 'Support release readiness review',
      summary: 'Review validation outcome and decide whether the change is ready for release.',
      responsibilities: [
        { actorId: 'product-manager', kind: 'accountable' },
        { actorId: 'frontend-engineer', kind: 'supporting' },
        { actorId: 'qa-engineer', kind: 'supporting' },
      ],
      inputIds: ['updated-role-navigation-screen-input'],
      outputIds: [],
      decisionIds: ['release-risk-acceptable'],
      handoffIds: [],
      expectationIds: [],
      workProductIds: ['release-readiness-note'],
    },
  ],
}
