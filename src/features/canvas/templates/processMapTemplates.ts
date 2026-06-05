import type { GraphDocument } from '../canvasTypes'
import { addEdge, addNode, createEmptyDocument } from '../engine/graphDocument'
import { createGraphNode, createHandoffEdge } from '../processElements'

export type ProcessMapTemplateId = 'blank' | 'product-discovery' | 'delivery-handoff'

export interface ProcessMapTemplate {
  id: ProcessMapTemplateId
  name: string
  description: string
}

export const PROCESS_MAP_TEMPLATES: ProcessMapTemplate[] = [
  {
    id: 'blank',
    name: 'Blank process map',
    description: 'Start with a clean canvas and one start marker.',
  },
  {
    id: 'product-discovery',
    name: 'Product discovery',
    description: 'Map discovery intake, validation, decision, and handoff into delivery.',
  },
  {
    id: 'delivery-handoff',
    name: 'Delivery handoff',
    description: 'Clarify how product, design, engineering, and QA move work into delivery.',
  },
]

export function createTemplateDocument(templateId: ProcessMapTemplateId, mapId: string): GraphDocument {
  switch (templateId) {
    case 'blank':
      return cleanDocument(addNode(createEmptyDocument(mapId), createGraphNode('start', 'start', { x: 360, y: 200 })))
    case 'product-discovery':
      return createProductDiscoveryTemplate(mapId)
    case 'delivery-handoff':
      return createDeliveryHandoffTemplate(mapId)
  }
}

function createProductDiscoveryTemplate(mapId: string): GraphDocument {
  let doc = createEmptyDocument(mapId)
  const start = createGraphNode('start', 'start', { x: 160, y: 260 })
  const stage = {
    ...createGraphNode('stage', 'stage-discovery', { x: 340, y: 220 }),
    title: 'Discovery',
    goal: 'Turn a product question into a validated direction.',
    entryCondition: 'Problem or opportunity is worth exploring.',
    exitCondition: 'Team agrees whether to proceed, pivot, or stop.',
    owner: 'PM',
  }
  const activity = {
    ...createGraphNode('activity', 'activity-research', { x: 680, y: 240 }),
    title: 'Validate problem',
    summary: 'Collect customer evidence and align on the core problem.',
    roleTags: ['PM', 'Designer'],
    expectations: 'Evidence is summarized before solution framing starts.',
  }
  const decision = {
    ...createGraphNode('decision', 'decision-proceed', { x: 980, y: 238 }),
    title: 'Proceed to delivery?',
    criteria: 'Evidence quality, strategic fit, team capacity, and risk are clear.',
    owner: 'PM',
    decisionOutcomes: ['Proceed', 'Rework discovery', 'Stop'],
  }
  const end = createGraphNode('end', 'end', { x: 1280, y: 270 })

  for (const node of [start, stage, activity, decision, end]) {
    doc = addNode(doc, node)
  }

  const edges = [
    createHandoffEdge('edge-start-stage', 'start', 'out', 'stage-discovery', 'in'),
    createHandoffEdge('edge-stage-activity', 'stage-discovery', 'out', 'activity-research', 'in'),
    createHandoffEdge('edge-activity-decision', 'activity-research', 'out', 'decision-proceed', 'in'),
    createHandoffEdge('edge-decision-end', 'decision-proceed', 'out', 'end', 'in'),
  ]

  for (const edge of edges) {
    doc = addEdge(doc, edge)
  }

  return cleanDocument(doc)
}

function createDeliveryHandoffTemplate(mapId: string): GraphDocument {
  let doc = createEmptyDocument(mapId)
  const start = createGraphNode('start', 'start', { x: 160, y: 300 })
  const define = {
    ...createGraphNode('activity', 'activity-define-ready', { x: 360, y: 270 }),
    title: 'Define ready work',
    summary: 'Clarify scope, acceptance expectations, and delivery owner.',
    roleTags: ['PM', 'Designer'],
    expectations: 'Ready work includes context, owner, risks, and acceptance expectations.',
  }
  const handoff = {
    ...createGraphNode('activity', 'activity-handoff', { x: 680, y: 270 }),
    title: 'Handoff to engineering',
    summary: 'Walk through the work with engineering and QA.',
    roleTags: ['PM', 'Engineer', 'QA'],
    expectations: 'Questions are resolved before implementation starts.',
  }
  const bottleneck = {
    ...createGraphNode('bottleneck', 'bottleneck-unclear-acceptance', { x: 680, y: 430 }),
    title: 'Unclear acceptance',
    symptom: 'Implementation starts with repeated clarification loops.',
    impact: 'Engineering waits and delivery scope changes late.',
    suspectedCause: 'Acceptance expectations are not explicit at handoff.',
  }
  const end = createGraphNode('end', 'end', { x: 1010, y: 300 })

  for (const node of [start, define, handoff, bottleneck, end]) {
    doc = addNode(doc, node)
  }

  const edgeOne = {
    ...createHandoffEdge('edge-start-define', 'start', 'out', 'activity-define-ready', 'in'),
    expectation: 'Work starts with shared context and an accountable owner.',
  }
  const edgeTwo = {
    ...createHandoffEdge('edge-define-handoff', 'activity-define-ready', 'out', 'activity-handoff', 'in'),
    fromRole: 'PM',
    toRole: 'Engineer',
    artifact: 'Ready brief',
    expectation: 'Ready work moves with context, owner, and acceptance expectations.',
    readinessSignal: 'Engineering can restate scope and risks.',
  }
  const edgeThree = createHandoffEdge('edge-handoff-end', 'activity-handoff', 'out', 'end', 'in')

  for (const edge of [edgeTwo, edgeOne, edgeThree]) {
    doc = addEdge(doc, edge)
  }

  return cleanDocument(doc)
}

function cleanDocument(doc: GraphDocument): GraphDocument {
  return { ...doc, meta: { dirty: false, version: doc.meta.version } }
}
