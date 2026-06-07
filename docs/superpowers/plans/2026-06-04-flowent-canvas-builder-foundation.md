# Flowent Canvas Builder Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first executable slice of the Flowent canvas-builder concept: fast process-element creation, quick-create, starter templates, semantic node/edge editing, readability focus tools, and alignment diagnostics.

**Architecture:** Keep PixiJS as the rendering core and React as the editor shell. Add small pure modules for process element definitions, quick-create planning, templates, focus derivation, and diagnostics so behavior is unit-testable before wiring it into `useCanvasState` and `ProcessCanvas`.

**Tech Stack:** TypeScript, React 19, Vite, Vitest, Testing Library, Playwright, PixiJS, existing file-backed library API.

---

## Scope Check

The approved concept in `docs/superpowers/specs/2026-06-04-flowent-canvas-builder-concept-design.md` spans five product phases. This plan implements the first self-contained foundation slice:

- Phase 1: Canvas creation quality
- Phase 2: Canvas readability foundation
- Phase 3: Process semantics foundation
- A lightweight Phase 4 bridge through diagnostics and review labels

Full comments, consensus activation, stakeholder share links, PDF/PNG/SVG export, and impact summaries are independent subsystems. They should be planned in separate implementation documents after this foundation lands.

## Current Codebase Anchors

- Canvas shell: `src/features/canvas/ProcessCanvas.tsx`
- Canvas state: `src/features/canvas/useCanvasState.ts`
- Shared graph types: `src/features/canvas/canvasTypes.ts`
- Commands: `src/features/canvas/engine/commands.ts`
- Graph document helpers: `src/features/canvas/engine/graphDocument.ts`
- Auto layout: `src/features/canvas/layout/autoLayout.ts`
- Pixi node drawing: `src/features/canvas/render/drawNodes.ts`
- Pixi edge drawing: `src/features/canvas/render/drawEdges.ts`
- Properties editor: `src/features/canvas/PropertiesPanel.tsx`
- Saved-map library: `src/features/canvas/Library.tsx`, `src/features/canvas/useLibrary.ts`, `src/features/canvas/library.ts`
- Existing tests: `src/features/canvas/*.test.tsx`, `src/features/canvas/**/*.test.ts`, `e2e/*.spec.ts`

## File Structure

### Create

- `src/features/canvas/processElements.ts`  
  Single source of truth for process element definitions, node defaults, ports, sizes, and handoff-edge defaults.

- `src/features/canvas/processElements.test.ts`  
  Unit tests for node and handoff factories.

- `src/features/canvas/engine/quickCreate.ts`  
  Pure quick-create planner that decides new node position and optional handoff edge.

- `src/features/canvas/engine/quickCreate.test.ts`  
  Unit tests for quick-create behavior.

- `src/features/canvas/templates/processMapTemplates.ts`  
  Starter template definitions that return `GraphDocument` instances.

- `src/features/canvas/templates/processMapTemplates.test.ts`  
  Unit tests proving templates contain readable semantic maps.

- `src/features/canvas/engine/graphSerialization.ts`  
  Boundary helpers that convert runtime `GraphDocument` Maps/Sets to JSON-safe records/arrays and back.

- `src/features/canvas/engine/graphSerialization.test.ts`  
  Unit tests that prevent template documents from being saved with empty `{}` Maps.

- `src/features/canvas/ProcessElementPalette.tsx`  
  Process-specific element palette for quick-create and drag-to-add.

- `src/features/canvas/ProcessElementPalette.test.tsx`  
  Component tests for palette click and drag payload behavior.

- `src/features/canvas/focus/processFocus.ts`  
  Pure helpers for deriving role, decision, handoff, and bottleneck focus views.

- `src/features/canvas/focus/processFocus.test.ts`  
  Unit tests for focus derivation.

- `src/features/canvas/FocusBar.tsx`  
  UI controls for readability focus modes.

- `src/features/canvas/diagnostics/processMapDiagnostics.ts`  
  Pure validation helpers that identify alignment gaps in maps.

- `src/features/canvas/diagnostics/processMapDiagnostics.test.ts`  
  Unit tests for alignment diagnostics.

- `src/features/canvas/AlignmentChecklist.tsx`  
  Read-only panel showing process-alignment diagnostics.

- `src/features/canvas/AlignmentChecklist.test.tsx`  
  Component tests for diagnostic rendering and click-to-select behavior.

- `e2e/canvas-builder-concept.spec.ts`  
  Playwright coverage for quick-create, palette drag-to-add, semantic editing, focus mode, and diagnostics.

### Modify

- `src/features/canvas/canvasTypes.ts`  
  Add `stage` and `bottleneck` nodes, semantic fields, review statuses, and handoff edge fields.

- `server/library/libraryStore.ts`  
  Extend Zod persistence schemas so saved maps can store the new semantic node and handoff fields.

- `src/features/canvas/engine/commands.ts`  
  Add `SelectEdge` and `UpdateEdge` commands.

- `src/features/canvas/useCanvasState.ts`  
  Use process-element factories, expose `addNodeByType`, `quickCreate`, edge selection/editing, and focus state.

- `src/features/canvas/ProcessCanvas.tsx`  
  Mount palette, focus bar, diagnostics panel, drag/drop handlers, focused rendering options, and edge click handling.

- `src/features/canvas/Toolbar.tsx`  
  Keep high-frequency actions in the toolbar and hand process-element creation to `ProcessElementPalette`.

- `src/features/canvas/PropertiesPanel.tsx`  
  Add stage, bottleneck, richer activity, richer decision, and handoff edge editors.

- `src/features/canvas/render/drawNodes.ts`  
  Draw stage and bottleneck nodes and dim nodes outside the active focus view.

- `src/features/canvas/render/drawEdges.ts`  
  Draw selected/focused handoffs, wider hit strokes, and edge click callbacks.

- `src/features/canvas/layout/autoLayout.ts`  
  Respect stage nodes and keep bottleneck markers near their connected process step.

- `src/features/canvas/Library.tsx`  
  Add map creation from starter templates.

- `src/styles.css`  
  Add palette, focus bar, semantic editor, edge editor, diagnostics, and template menu styling.

---

### Task 0: Branch and Baseline Verification

**Files:**
- No file changes

- [ ] **Step 1: Create a feature branch before committing**

Run:

```bash
git checkout -b feat/canvas-builder-foundation
```

Expected: branch changes from `main` to `feat/canvas-builder-foundation`.

- [ ] **Step 2: Run the existing fast test suite**

Run:

```bash
npm test
```

Expected: existing Vitest suite passes before feature work starts. If it fails, capture the failing test names in the implementation notes before changing code.

- [ ] **Step 3: Run lint before edits**

Run:

```bash
npm run lint
```

Expected: lint passes. If it fails, capture the existing failures in the implementation notes before changing code.

---

### Task 1: Process Element Types and Factories

**Files:**
- Modify: `src/features/canvas/canvasTypes.ts`
- Create: `src/features/canvas/processElements.ts`
- Create: `src/features/canvas/processElements.test.ts`

- [ ] **Step 1: Write the failing factory tests**

Create `src/features/canvas/processElements.test.ts`:

```typescript
import { describe, expect, it } from 'vitest'
import {
  PROCESS_ELEMENTS,
  createGraphNode,
  createHandoffEdge,
  getPortsForNodeType,
} from './processElements'

describe('processElements', () => {
  it('defines Flowent process elements instead of generic diagram shapes', () => {
    expect(PROCESS_ELEMENTS.map((item) => item.type)).toEqual([
      'stage',
      'activity',
      'decision',
      'bottleneck',
      'end',
    ])
  })

  it('creates an activity node with role and expectation fields', () => {
    const node = createGraphNode('activity', 'activity-1', { x: 120, y: 240 })

    expect(node).toMatchObject({
      id: 'activity-1',
      type: 'activity',
      x: 120,
      y: 240,
      width: 220,
      height: 112,
      title: 'New activity',
      summary: '',
      roleTags: [],
      expectations: '',
    })
    expect(node.ports).toEqual([
      { id: 'in', side: 'left' },
      { id: 'out', side: 'right' },
    ])
  })

  it('creates stage and bottleneck nodes with process-specific fields', () => {
    const stage = createGraphNode('stage', 'stage-1', { x: 40, y: 80 })
    const bottleneck = createGraphNode('bottleneck', 'bottleneck-1', { x: 520, y: 140 })

    expect(stage).toMatchObject({
      type: 'stage',
      title: 'New stage',
      goal: '',
      entryCondition: '',
      exitCondition: '',
      owner: '',
    })
    expect(bottleneck).toMatchObject({
      type: 'bottleneck',
      title: 'Potential bottleneck',
      symptom: '',
      impact: '',
      suspectedCause: '',
      reviewStatus: 'unclear',
    })
  })

  it('creates a semantic handoff edge between process nodes', () => {
    const edge = createHandoffEdge('edge-1', 'source', 'out', 'target', 'in')

    expect(edge).toMatchObject({
      id: 'edge-1',
      sourceNodeId: 'source',
      sourcePortId: 'out',
      targetNodeId: 'target',
      targetPortId: 'in',
      label: '',
      kind: 'handoff',
      fromRole: '',
      toRole: '',
      artifact: '',
      expectation: '',
      readinessSignal: '',
      reviewStatus: 'unclear',
    })
  })

  it('returns stable ports for every node type', () => {
    expect(getPortsForNodeType('start')).toEqual([{ id: 'out', side: 'right' }])
    expect(getPortsForNodeType('end')).toEqual([{ id: 'in', side: 'left' }])
    expect(getPortsForNodeType('decision')).toEqual([
      { id: 'in', side: 'left' },
      { id: 'out', side: 'right' },
    ])
  })
})
```

- [ ] **Step 2: Run the new tests to verify they fail**

Run:

```bash
npx vitest run src/features/canvas/processElements.test.ts
```

Expected: FAIL because `src/features/canvas/processElements.ts` does not exist.

- [ ] **Step 3: Extend the shared graph types**

Modify `src/features/canvas/canvasTypes.ts` so these exported types exist:

```typescript
export type ReviewStatus = 'unclear' | 'disputed' | 'needs-owner' | 'approved' | 'changed-since-approval'

export type PortSide = 'top' | 'right' | 'bottom' | 'left'

export type GraphPort = {
  id: string
  side: PortSide
}

export type GraphNodeType = 'activity' | 'decision' | 'stage' | 'bottleneck' | 'start' | 'end'

export type GraphNode = {
  id: string
  type: GraphNodeType
  x: number
  y: number
  width: number
  height: number
  title: string
  summary?: string
  criteria?: string
  decisionOutcomes?: string[]
  roleTags: string[]
  expectations?: string
  owner?: string
  goal?: string
  entryCondition?: string
  exitCondition?: string
  symptom?: string
  impact?: string
  suspectedCause?: string
  reviewStatus?: ReviewStatus
  ports: GraphPort[]
}

export type GraphEdge = {
  id: string
  sourceNodeId: string
  sourcePortId: string
  targetNodeId: string
  targetPortId: string
  label: string
  kind?: 'handoff'
  fromRole?: string
  toRole?: string
  artifact?: string
  expectation?: string
  readinessSignal?: string
  reviewStatus?: ReviewStatus
}
```

Also extend `GraphCommand` with edge selection and editing:

```typescript
export type GraphCommand =
  | { type: 'AddNode'; payload: GraphNode }
  | { type: 'AddEdge'; payload: GraphEdge }
  | {
      type: 'UpdateNode'
      payload: {
        id: string
        patch: Partial<Pick<GraphNode,
          | 'title'
          | 'summary'
          | 'criteria'
          | 'decisionOutcomes'
          | 'roleTags'
          | 'expectations'
          | 'owner'
          | 'goal'
          | 'entryCondition'
          | 'exitCondition'
          | 'symptom'
          | 'impact'
          | 'suspectedCause'
          | 'reviewStatus'
          | 'x'
          | 'y'
        >>
      }
    }
  | {
      type: 'UpdateEdge'
      payload: {
        id: string
        patch: Partial<Pick<GraphEdge,
          | 'label'
          | 'fromRole'
          | 'toRole'
          | 'artifact'
          | 'expectation'
          | 'readinessSignal'
          | 'reviewStatus'
        >>
      }
    }
  | { type: 'SelectNode'; payload: { id: string; additive: boolean } }
  | { type: 'SelectEdge'; payload: { id: string; additive: boolean } }
  | { type: 'MoveNodes'; payload: { ids: string[]; dx: number; dy: number } }
  | { type: 'UpdateViewport'; payload: Partial<GraphViewport> }
```

Extend process-node data unions:

```typescript
export type StageNodeData = {
  title: string
  goal: string
  entryCondition: string
  exitCondition: string
  owner: string
  kind: 'stage'
}

export type BottleneckNodeData = {
  title: string
  symptom: string
  impact: string
  suspectedCause: string
  reviewStatus: ReviewStatus
  kind: 'bottleneck'
}

export type ProcessNodeData = ActivityNodeData | DecisionNodeData | StageNodeData | BottleneckNodeData | StartEndNodeData

export type ProcessNode = {
  id: string
  type: 'activity' | 'decision' | 'stage' | 'bottleneck' | 'startEnd'
  position: { x: number; y: number }
  data: ProcessNodeData
}

export type ProcessEdge = {
  id: string
  type: 'handoff'
  source: string
  target: string
  sourceHandle?: string
  targetHandle?: string
  data?: {
    label?: string
    fromRole?: string
    toRole?: string
    artifact?: string
    expectation?: string
    readinessSignal?: string
    reviewStatus?: ReviewStatus
  }
}
```

Update `ActivityNodeData` and `DecisionNodeData`:

```typescript
export type ActivityNodeData = {
  title: string
  summary: string
  roleIds: string[]
  expectations?: string
  kind: 'activity'
}

export type DecisionNodeData = {
  title: string
  criteria: string
  decisionOutcomes?: string[]
  owner?: string
  kind: 'decision'
}
```

- [ ] **Step 4: Implement the process element factory module**

Create `src/features/canvas/processElements.ts`:

```typescript
import type { GraphEdge, GraphNode, GraphNodeType, GraphPort, ReviewStatus } from './canvasTypes'

export type ProcessElementType = 'stage' | 'activity' | 'decision' | 'bottleneck' | 'end'

export interface ProcessElementDefinition {
  type: ProcessElementType
  label: string
  description: string
  shortcut?: string
}

export const DEFAULT_REVIEW_STATUS: ReviewStatus = 'unclear'

export const PROCESS_ELEMENTS: ProcessElementDefinition[] = [
  {
    type: 'stage',
    label: 'Stage',
    description: 'Group work around a process phase with entry and exit expectations.',
  },
  {
    type: 'activity',
    label: 'Activity',
    description: 'Capture a step of work, responsible roles, and expectations.',
    shortcut: 'A',
  },
  {
    type: 'decision',
    label: 'Decision',
    description: 'Capture a decision point, owner, criteria, and outcomes.',
    shortcut: 'D',
  },
  {
    type: 'bottleneck',
    label: 'Bottleneck',
    description: 'Mark a waiting point, unclear owner, or recurring slowdown.',
  },
  {
    type: 'end',
    label: 'End',
    description: 'Mark the end of this process path.',
    shortcut: 'S',
  },
]

export function getPortsForNodeType(type: GraphNodeType): GraphPort[] {
  switch (type) {
    case 'start':
      return [{ id: 'out', side: 'right' }]
    case 'end':
      return [{ id: 'in', side: 'left' }]
    case 'activity':
    case 'decision':
    case 'stage':
    case 'bottleneck':
      return [
        { id: 'in', side: 'left' },
        { id: 'out', side: 'right' },
      ]
  }
}

export function createGraphNode(
  type: ProcessElementType | 'start',
  id: string,
  position: { x: number; y: number },
): GraphNode {
  switch (type) {
    case 'start':
      return {
        id,
        type,
        x: position.x,
        y: position.y,
        width: 120,
        height: 56,
        title: 'Start',
        roleTags: [],
        ports: getPortsForNodeType(type),
      }
    case 'end':
      return {
        id,
        type,
        x: position.x,
        y: position.y,
        width: 120,
        height: 56,
        title: 'End',
        roleTags: [],
        ports: getPortsForNodeType(type),
      }
    case 'stage':
      return {
        id,
        type,
        x: position.x,
        y: position.y,
        width: 280,
        height: 132,
        title: 'New stage',
        goal: '',
        entryCondition: '',
        exitCondition: '',
        owner: '',
        roleTags: [],
        ports: getPortsForNodeType(type),
      }
    case 'activity':
      return {
        id,
        type,
        x: position.x,
        y: position.y,
        width: 220,
        height: 112,
        title: 'New activity',
        summary: '',
        expectations: '',
        roleTags: [],
        ports: getPortsForNodeType(type),
      }
    case 'decision':
      return {
        id,
        type,
        x: position.x,
        y: position.y,
        width: 190,
        height: 124,
        title: 'New decision',
        criteria: '',
        decisionOutcomes: [],
        owner: '',
        roleTags: [],
        ports: getPortsForNodeType(type),
      }
    case 'bottleneck':
      return {
        id,
        type,
        x: position.x,
        y: position.y,
        width: 220,
        height: 104,
        title: 'Potential bottleneck',
        symptom: '',
        impact: '',
        suspectedCause: '',
        reviewStatus: DEFAULT_REVIEW_STATUS,
        roleTags: [],
        ports: getPortsForNodeType(type),
      }
  }
}

export function createHandoffEdge(
  id: string,
  sourceNodeId: string,
  sourcePortId: string,
  targetNodeId: string,
  targetPortId: string,
): GraphEdge {
  return {
    id,
    sourceNodeId,
    sourcePortId,
    targetNodeId,
    targetPortId,
    label: '',
    kind: 'handoff',
    fromRole: '',
    toRole: '',
    artifact: '',
    expectation: '',
    readinessSignal: '',
    reviewStatus: DEFAULT_REVIEW_STATUS,
  }
}
```

- [ ] **Step 5: Run factory tests**

Run:

```bash
npx vitest run src/features/canvas/processElements.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit the process element foundation**

Run:

```bash
git add src/features/canvas/canvasTypes.ts src/features/canvas/processElements.ts src/features/canvas/processElements.test.ts
git commit -m "feat: add process element model"
```

---

### Task 2: Starter Templates for New Process Maps

**Files:**
- Create: `src/features/canvas/templates/processMapTemplates.ts`
- Create: `src/features/canvas/templates/processMapTemplates.test.ts`
- Create: `src/features/canvas/engine/graphSerialization.ts`
- Create: `src/features/canvas/engine/graphSerialization.test.ts`
- Modify: `server/library/libraryStore.ts`
- Modify: `src/features/canvas/Library.tsx`
- Modify: `src/features/canvas/useLibrary.ts`

- [ ] **Step 1: Write failing template tests**

Create `src/features/canvas/templates/processMapTemplates.test.ts`:

```typescript
import { describe, expect, it } from 'vitest'
import { PROCESS_MAP_TEMPLATES, createTemplateDocument } from './processMapTemplates'

describe('processMapTemplates', () => {
  it('offers blank, discovery, and delivery handoff templates', () => {
    expect(PROCESS_MAP_TEMPLATES.map((template) => template.id)).toEqual([
      'blank',
      'product-discovery',
      'delivery-handoff',
    ])
  })

  it('creates a blank document with a start node', () => {
    const doc = createTemplateDocument('blank', 'map-1')

    expect(doc.id).toBe('map-1')
    expect(doc.nodes.has('start')).toBe(true)
    expect(doc.edges.size).toBe(0)
  })

  it('creates a product discovery template with decisions and handoffs', () => {
    const doc = createTemplateDocument('product-discovery', 'map-2')

    const nodeTypes = Array.from(doc.nodes.values()).map((node) => node.type)
    expect(nodeTypes).toContain('stage')
    expect(nodeTypes).toContain('activity')
    expect(nodeTypes).toContain('decision')
    expect(doc.edges.size).toBeGreaterThan(1)
  })

  it('creates a delivery handoff template with semantic handoff edges', () => {
    const doc = createTemplateDocument('delivery-handoff', 'map-3')

    const handoff = Array.from(doc.edges.values()).find((edge) => edge.kind === 'handoff')
    expect(handoff).toBeTruthy()
    expect(handoff?.expectation).toBe('Ready work moves with context, owner, and acceptance expectations.')
  })
})
```

- [ ] **Step 2: Run the new tests to verify they fail**

Run:

```bash
npx vitest run src/features/canvas/templates/processMapTemplates.test.ts
```

Expected: FAIL because `processMapTemplates.ts` does not exist.

- [ ] **Step 3: Implement template generation**

Create `src/features/canvas/templates/processMapTemplates.ts`:

```typescript
import type { GraphDocument } from '../canvasTypes'
import { createEmptyDocument, addEdge, addNode } from '../engine/graphDocument'
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
      return addNode(createEmptyDocument(mapId), createGraphNode('start', 'start', { x: 360, y: 200 }))
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

  return { ...doc, meta: { dirty: false, version: doc.meta.version } }
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

  for (const edge of [edgeOne, edgeTwo, edgeThree]) {
    doc = addEdge(doc, edge)
  }

  return { ...doc, meta: { dirty: false, version: doc.meta.version } }
}
```

- [ ] **Step 4: Add graph serialization helpers for persisted template documents**

Create `src/features/canvas/engine/graphSerialization.test.ts`:

```typescript
import { describe, expect, it } from 'vitest'
import { createEmptyDocument, addEdge, addNode } from './graphDocument'
import { createGraphNode, createHandoffEdge } from '../processElements'
import { deserializeGraphDocument, serializeGraphDocument } from './graphSerialization'

describe('graphSerialization', () => {
  it('serializes Maps and Sets to JSON-safe records and arrays', () => {
    let doc = createEmptyDocument('map-1')
    doc = addNode(doc, createGraphNode('activity', 'activity-1', { x: 120, y: 240 }))
    doc = addNode(doc, createGraphNode('decision', 'decision-1', { x: 420, y: 240 }))
    doc = addEdge(doc, createHandoffEdge('edge-1', 'activity-1', 'out', 'decision-1', 'in'))

    const serialized = serializeGraphDocument(doc)

    expect(serialized.nodes['activity-1']).toMatchObject({ type: 'activity' })
    expect(serialized.edges['edge-1']).toMatchObject({ kind: 'handoff' })
    expect(serialized.selectedNodeIds).toEqual([])
    expect(JSON.stringify(serialized)).toContain('activity-1')
  })

  it('deserializes records and arrays back into GraphDocument Maps and Sets', () => {
    const doc = deserializeGraphDocument({
      id: 'map-1',
      nodes: {
        start: createGraphNode('start', 'start', { x: 360, y: 200 }),
      },
      edges: {},
      selectedNodeIds: ['start'],
      selectedEdgeIds: [],
      viewport: { x: 0, y: 0, zoom: 1 },
      meta: { dirty: false, version: 1 },
    })

    expect(doc.nodes).toBeInstanceOf(Map)
    expect(doc.nodes.get('start')?.type).toBe('start')
    expect(doc.selectedNodeIds).toEqual(new Set(['start']))
  })
})
```

Create `src/features/canvas/engine/graphSerialization.ts`:

```typescript
import type { GraphDocument, GraphEdge, GraphNode } from '../canvasTypes'

export interface SerializedGraphDocument {
  id: string
  nodes: Record<string, GraphNode>
  edges: Record<string, GraphEdge>
  selectedNodeIds: string[]
  selectedEdgeIds: string[]
  viewport: { x: number; y: number; zoom: number }
  meta: { dirty: boolean; version: number }
}

export function serializeGraphDocument(doc: GraphDocument): SerializedGraphDocument {
  return {
    id: doc.id,
    nodes: Object.fromEntries(doc.nodes),
    edges: Object.fromEntries(doc.edges),
    selectedNodeIds: Array.from(doc.selectedNodeIds),
    selectedEdgeIds: Array.from(doc.selectedEdgeIds),
    viewport: doc.viewport,
    meta: { dirty: false, version: doc.meta.version },
  }
}

export function deserializeGraphDocument(document: SerializedGraphDocument): GraphDocument {
  return {
    id: document.id,
    nodes: new Map(Object.entries(document.nodes)),
    edges: new Map(Object.entries(document.edges)),
    selectedNodeIds: new Set(document.selectedNodeIds),
    selectedEdgeIds: new Set(document.selectedEdgeIds),
    viewport: document.viewport,
    meta: document.meta,
  }
}
```

- [ ] **Step 5: Extend the library persistence schema for semantic template documents**

In `server/library/libraryStore.ts`, update the node schema type enum and fields:

```typescript
const reviewStatusSchema = z.enum(['unclear', 'disputed', 'needs-owner', 'approved', 'changed-since-approval'])

const nodeSchema = z.object({
  id: z.string(),
  type: z.enum(['activity', 'decision', 'stage', 'bottleneck', 'start', 'end']),
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
  title: z.string(),
  summary: z.string().optional(),
  criteria: z.string().optional(),
  decisionOutcomes: z.array(z.string()).optional(),
  roleTags: z.array(z.string()),
  expectations: z.string().optional(),
  owner: z.string().optional(),
  goal: z.string().optional(),
  entryCondition: z.string().optional(),
  exitCondition: z.string().optional(),
  symptom: z.string().optional(),
  impact: z.string().optional(),
  suspectedCause: z.string().optional(),
  reviewStatus: reviewStatusSchema.optional(),
  ports: z.array(z.object({ id: z.string(), side: z.enum(['top', 'right', 'bottom', 'left']) })),
})

const edgeSchema = z.object({
  id: z.string(),
  sourceNodeId: z.string(),
  sourcePortId: z.string(),
  targetNodeId: z.string(),
  targetPortId: z.string(),
  label: z.string(),
  kind: z.literal('handoff').optional(),
  fromRole: z.string().optional(),
  toRole: z.string().optional(),
  artifact: z.string().optional(),
  expectation: z.string().optional(),
  readinessSignal: z.string().optional(),
  reviewStatus: reviewStatusSchema.optional(),
})
```

The existing `server/library/libraryRoute.ts` already accepts `document: z.any().optional()` for `PATCH /api/library/maps/:id`, but the current `POST /api/library/maps` schema only accepts `name` and `folderId`. Do not extend POST in this task. The client will create the map first, then save the serialized template document through the existing `PATCH` path so the generated server id and document id stay aligned.

- [ ] **Step 6: Add template-aware map creation to the library hook**

In `src/features/canvas/useLibrary.ts`, import the template and serialization helpers:

```typescript
import { serializeGraphDocument } from './engine/graphSerialization'
import { createTemplateDocument, type ProcessMapTemplateId } from './templates/processMapTemplates'
```

Extend `UseLibraryResult`:

```typescript
createMapFromTemplate: (name: string, folderId: string | null, templateId: ProcessMapTemplateId) => Promise<SavedMap>
```

Add this callback after `createMap`:

```typescript
const createMapFromTemplate = useCallback(
  async (name: string, folderId: string | null, templateId: ProcessMapTemplateId): Promise<SavedMap> => {
    return run('createMapFromTemplate', async () => {
      const createRes = await fetch('/api/library/maps', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name, folderId }),
      })
      if (!createRes.ok) throw new Error(`HTTP ${createRes.status}`)
      const createdBody = (await createRes.json()) as { data: SavedMap }
      const document = serializeGraphDocument(createTemplateDocument(templateId, createdBody.data.id))

      const patchRes = await fetch(`/api/library/maps/${createdBody.data.id}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ document }),
      })
      if (!patchRes.ok) throw new Error(`HTTP ${patchRes.status}`)
      const patchedBody = (await patchRes.json()) as { data: SavedMap }
      setLibrary((lib) => ({ ...lib, maps: [...lib.maps, patchedBody.data] }))
      return patchedBody.data
    })
  },
  [run],
)
```

Return `createMapFromTemplate` in the hook result.

- [ ] **Step 7: Add template menu to the map library**

In `src/features/canvas/Library.tsx`, import templates:

```typescript
import { PROCESS_MAP_TEMPLATES, type ProcessMapTemplateId } from './templates/processMapTemplates'
```

Replace the `creating === 'map'` branch with a template-aware form:

```tsx
{creating === 'map' && (
  <NewMapForm
    onSubmit={async (name, templateId) => {
      const map = await library.createMapFromTemplate(name, null, templateId)
      onSelectMap(map.id)
      setCreating(null)
    }}
    onCancel={() => setCreating(null)}
  />
)}
```

Add this component near `NewItemForm`:

```tsx
function NewMapForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (name: string, templateId: ProcessMapTemplateId) => Promise<void>
  onCancel: () => void
}) {
  const [name, setName] = useState('')
  const [templateId, setTemplateId] = useState<ProcessMapTemplateId>('blank')

  async function handleSubmit(event: FormEvent): Promise<void> {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    await onSubmit(trimmed, templateId)
  }

  return (
    <form className="library-new-form" onSubmit={handleSubmit}>
      <input
        autoFocus
        aria-label="New map name"
        placeholder="New map name"
        value={name}
        onChange={(event) => setName(event.target.value)}
      />
      <label className="library-template-label" htmlFor="new-map-template">
        Template
      </label>
      <select
        id="new-map-template"
        value={templateId}
        onChange={(event) => setTemplateId(event.target.value as ProcessMapTemplateId)}
      >
        {PROCESS_MAP_TEMPLATES.map((template) => (
          <option key={template.id} value={template.id}>
            {template.name}
          </option>
        ))}
      </select>
      <div className="library-template-description">
        {PROCESS_MAP_TEMPLATES.find((template) => template.id === templateId)?.description}
      </div>
      <div className="library-new-actions">
        <button type="submit">Create</button>
        <button type="button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  )
}
```

- [ ] **Step 8: Run template tests**

Run:

```bash
npx vitest run src/features/canvas/templates/processMapTemplates.test.ts src/features/canvas/engine/graphSerialization.test.ts
```

Expected: PASS.

- [ ] **Step 9: Run library-related tests**

Run:

```bash
npx vitest run src/features/canvas/library.test.ts src/features/canvas/templates/processMapTemplates.test.ts src/features/canvas/engine/graphSerialization.test.ts
```

Expected: PASS.

- [ ] **Step 10: Commit starter templates**

Run:

```bash
git add server/library/libraryStore.ts src/features/canvas/templates src/features/canvas/engine/graphSerialization.ts src/features/canvas/engine/graphSerialization.test.ts src/features/canvas/Library.tsx src/features/canvas/useLibrary.ts
git commit -m "feat: add process map starter templates"
```

---

### Task 3: Quick-Create Planner and Canvas State Wiring

**Files:**
- Create: `src/features/canvas/engine/quickCreate.ts`
- Create: `src/features/canvas/engine/quickCreate.test.ts`
- Modify: `src/features/canvas/useCanvasState.ts`
- Modify: `src/features/canvas/useCanvasState.test.ts`

- [ ] **Step 1: Write failing quick-create tests**

Create `src/features/canvas/engine/quickCreate.test.ts`:

```typescript
import { describe, expect, it } from 'vitest'
import { createEmptyDocument, addNode } from './graphDocument'
import { createGraphNode } from '../processElements'
import { planQuickCreate } from './quickCreate'

describe('planQuickCreate', () => {
  it('places a new node to the right of the selected source and creates a handoff edge', () => {
    const source = createGraphNode('activity', 'activity-1', { x: 100, y: 200 })
    const doc = addNode(createEmptyDocument('doc'), source)

    const plan = planQuickCreate(doc, {
      sourceNodeId: 'activity-1',
      targetType: 'decision',
      newNodeId: 'decision-1',
      newEdgeId: 'edge-1',
      fallbackPosition: { x: 500, y: 500 },
    })

    expect(plan.node.type).toBe('decision')
    expect(plan.node.x).toBe(source.x + source.width + 180)
    expect(plan.node.y).toBe(source.y)
    expect(plan.edge).toMatchObject({
      id: 'edge-1',
      sourceNodeId: 'activity-1',
      sourcePortId: 'out',
      targetNodeId: 'decision-1',
      targetPortId: 'in',
      kind: 'handoff',
    })
  })

  it('creates only a node when there is no selected source', () => {
    const doc = createEmptyDocument('doc')

    const plan = planQuickCreate(doc, {
      sourceNodeId: null,
      targetType: 'activity',
      newNodeId: 'activity-1',
      newEdgeId: 'edge-1',
      fallbackPosition: { x: 320, y: 180 },
    })

    expect(plan.node).toMatchObject({ id: 'activity-1', x: 320, y: 180 })
    expect(plan.edge).toBeNull()
  })

  it('creates only a node when the selected source is missing from the document', () => {
    const doc = createEmptyDocument('doc')

    const plan = planQuickCreate(doc, {
      sourceNodeId: 'missing',
      targetType: 'bottleneck',
      newNodeId: 'bottleneck-1',
      newEdgeId: 'edge-1',
      fallbackPosition: { x: 320, y: 180 },
    })

    expect(plan.node.type).toBe('bottleneck')
    expect(plan.edge).toBeNull()
  })
})
```

- [ ] **Step 2: Run quick-create tests to verify failure**

Run:

```bash
npx vitest run src/features/canvas/engine/quickCreate.test.ts
```

Expected: FAIL because `quickCreate.ts` does not exist.

- [ ] **Step 3: Implement the quick-create planner**

Create `src/features/canvas/engine/quickCreate.ts`:

```typescript
import type { GraphDocument, GraphEdge, GraphNode } from '../canvasTypes'
import { createGraphNode, createHandoffEdge, type ProcessElementType } from '../processElements'

interface QuickCreateOptions {
  sourceNodeId: string | null
  targetType: ProcessElementType
  newNodeId: string
  newEdgeId: string
  fallbackPosition: { x: number; y: number }
}

interface QuickCreatePlan {
  node: GraphNode
  edge: GraphEdge | null
}

const QUICK_CREATE_GAP_X = 180

export function planQuickCreate(doc: GraphDocument, options: QuickCreateOptions): QuickCreatePlan {
  const source = options.sourceNodeId ? doc.nodes.get(options.sourceNodeId) ?? null : null
  const position = source
    ? { x: source.x + source.width + QUICK_CREATE_GAP_X, y: source.y }
    : options.fallbackPosition

  const node = createGraphNode(options.targetType, options.newNodeId, position)
  const sourcePort = source?.ports.find((port) => port.id === 'out') ?? source?.ports[0] ?? null
  const targetPort = node.ports.find((port) => port.id === 'in') ?? node.ports[0] ?? null

  if (!source || !sourcePort || !targetPort) {
    return { node, edge: null }
  }

  return {
    node,
    edge: createHandoffEdge(options.newEdgeId, source.id, sourcePort.id, node.id, targetPort.id),
  }
}
```

- [ ] **Step 4: Update canvas state to use factories and quick-create**

In `src/features/canvas/useCanvasState.ts`, import the helpers and the `ReviewStatus` type:

```typescript
import type { ReviewStatus } from './canvasTypes'
import { planQuickCreate } from './engine/quickCreate'
import { createGraphNode, createHandoffEdge, type ProcessElementType } from './processElements'
```

Update `toProcessNode` so it supports new semantic node types:

```typescript
function toProcessNode(node: GraphNode): ProcessNode {
  if (node.type === 'activity') {
    return {
      id: node.id,
      type: 'activity',
      position: { x: node.x, y: node.y },
      data: {
        title: node.title,
        summary: node.summary ?? '',
        roleIds: node.roleTags,
        expectations: node.expectations ?? '',
        kind: 'activity',
      },
    }
  }

  if (node.type === 'decision') {
    return {
      id: node.id,
      type: 'decision',
      position: { x: node.x, y: node.y },
      data: {
        title: node.title,
        criteria: node.criteria ?? '',
        decisionOutcomes: node.decisionOutcomes ?? [],
        owner: node.owner ?? '',
        kind: 'decision',
      },
    }
  }

  if (node.type === 'stage') {
    return {
      id: node.id,
      type: 'stage',
      position: { x: node.x, y: node.y },
      data: {
        title: node.title,
        goal: node.goal ?? '',
        entryCondition: node.entryCondition ?? '',
        exitCondition: node.exitCondition ?? '',
        owner: node.owner ?? '',
        kind: 'stage',
      },
    }
  }

  if (node.type === 'bottleneck') {
    return {
      id: node.id,
      type: 'bottleneck',
      position: { x: node.x, y: node.y },
      data: {
        title: node.title,
        symptom: node.symptom ?? '',
        impact: node.impact ?? '',
        suspectedCause: node.suspectedCause ?? '',
        reviewStatus: node.reviewStatus ?? 'unclear',
        kind: 'bottleneck',
      },
    }
  }

  return {
    id: node.id,
    type: 'startEnd',
    position: { x: node.x, y: node.y },
    data: {
      label: node.title,
      kind: node.type === 'start' ? 'start' : 'end',
    },
  }
}
```

Update `toProcessEdge`:

```typescript
function toProcessEdge(edge: GraphEdge): ProcessEdge {
  return {
    id: edge.id,
    type: 'handoff',
    source: edge.sourceNodeId,
    target: edge.targetNodeId,
    sourceHandle: edge.sourcePortId,
    targetHandle: edge.targetPortId,
    data: {
      label: edge.label,
      fromRole: edge.fromRole ?? '',
      toRole: edge.toRole ?? '',
      artifact: edge.artifact ?? '',
      expectation: edge.expectation ?? '',
      readinessSignal: edge.readinessSignal ?? '',
      reviewStatus: edge.reviewStatus ?? 'unclear',
    },
  }
}
```

Add this reusable node-creation callback before `addActivity`:

```typescript
const addNodeByType = useCallback((type: ProcessElementType, position?: { x: number; y: number }) => {
  const id = `${type}-${Date.now()}`
  setHistory((current) => {
    let next = runCommand(current.present, {
      type: 'AddNode',
      payload: createGraphNode(type, id, position ?? { x: 320, y: 240 }),
    })
    next = runCommand(next, {
      type: 'SelectNode',
      payload: { id, additive: false },
    })
    return pushHistory(current, next)
  })
}, [])
```

Replace `addActivity`, `addDecision`, and `addEnd` with wrappers:

```typescript
const addActivity = useCallback((position?: { x: number; y: number }) => {
  addNodeByType('activity', position)
}, [addNodeByType])

const addDecision = useCallback((position?: { x: number; y: number }) => {
  addNodeByType('decision', position)
}, [addNodeByType])

const addEnd = useCallback((position?: { x: number; y: number }) => {
  addNodeByType('end', position)
}, [addNodeByType])
```

Add stage, bottleneck, and quick-create callbacks:

```typescript
const addStage = useCallback((position?: { x: number; y: number }) => {
  addNodeByType('stage', position)
}, [addNodeByType])

const addBottleneck = useCallback((position?: { x: number; y: number }) => {
  addNodeByType('bottleneck', position)
}, [addNodeByType])

const quickCreate = useCallback((targetType: ProcessElementType) => {
  setHistory((current) => {
    const sourceNodeId = Array.from(current.present.selectedNodeIds)[0] ?? null
    const newNodeId = `${targetType}-${Date.now()}`
    const newEdgeId = `edge-${Date.now()}`
    const plan = planQuickCreate(current.present, {
      sourceNodeId,
      targetType,
      newNodeId,
      newEdgeId,
      fallbackPosition: { x: 320, y: 240 },
    })

    let next = runCommand(current.present, { type: 'AddNode', payload: plan.node })
    if (plan.edge) {
      next = runCommand(next, { type: 'AddEdge', payload: plan.edge })
    }
    next = runCommand(next, { type: 'SelectNode', payload: { id: plan.node.id, additive: false } })
    return pushHistory(current, next)
  })
}, [])
```

Update `onConnect` to use `createHandoffEdge`:

```typescript
const onConnect = useCallback(
  (sourceNodeId: string, targetNodeId: string, sourcePortId = 'out', targetPortId = 'in') => {
    const edgeId = `edge-${Date.now()}`
    applyCommand({
      type: 'AddEdge',
      payload: createHandoffEdge(edgeId, sourceNodeId, sourcePortId, targetNodeId, targetPortId),
    })
  },
  [applyCommand],
)
```

Include these values in the hook return object:

```typescript
addNodeByType,
addStage,
addBottleneck,
quickCreate,
```

- [ ] **Step 5: Add hook tests for quick-create**

Append to `src/features/canvas/useCanvasState.test.ts`:

```typescript
it('quick-creates a connected activity from the selected start node', () => {
  const { result } = renderHook(() => useCanvasState())

  act(() => {
    result.current.onNodeClick('start', false)
  })
  act(() => {
    result.current.quickCreate('activity')
  })

  expect(result.current.nodes.some((node) => node.data.kind === 'activity')).toBe(true)
  expect(result.current.edges).toHaveLength(1)
  expect(result.current.edges[0]).toMatchObject({ source: 'start', type: 'handoff' })
})

it('adds stage and bottleneck nodes from typed canvas actions', () => {
  const { result } = renderHook(() => useCanvasState())

  act(() => result.current.addStage({ x: 100, y: 120 }))
  act(() => result.current.addBottleneck({ x: 400, y: 120 }))

  expect(result.current.nodes.some((node) => node.data.kind === 'stage')).toBe(true)
  expect(result.current.nodes.some((node) => node.data.kind === 'bottleneck')).toBe(true)
})
```

- [ ] **Step 6: Run quick-create and hook tests**

Run:

```bash
npx vitest run src/features/canvas/engine/quickCreate.test.ts src/features/canvas/useCanvasState.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit quick-create state behavior**

Run:

```bash
git add src/features/canvas/engine/quickCreate.ts src/features/canvas/engine/quickCreate.test.ts src/features/canvas/useCanvasState.ts src/features/canvas/useCanvasState.test.ts
git commit -m "feat: add canvas quick-create"
```

---

### Task 4: Process Element Palette and Drag-to-Add

**Files:**
- Create: `src/features/canvas/ProcessElementPalette.tsx`
- Create: `src/features/canvas/ProcessElementPalette.test.tsx`
- Modify: `src/features/canvas/ProcessCanvas.tsx`
- Modify: `src/features/canvas/Toolbar.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Write failing palette component tests**

Create `src/features/canvas/ProcessElementPalette.test.tsx`:

```typescript
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ProcessElementPalette } from './ProcessElementPalette'

describe('ProcessElementPalette', () => {
  it('renders process-specific elements', () => {
    render(<ProcessElementPalette onQuickCreate={() => {}} />)

    expect(screen.getByRole('button', { name: /stage/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /activity/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /decision/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /bottleneck/i })).toBeInTheDocument()
  })

  it('quick-creates the selected element when clicked', () => {
    const onQuickCreate = vi.fn()
    render(<ProcessElementPalette onQuickCreate={onQuickCreate} />)

    fireEvent.click(screen.getByRole('button', { name: /activity/i }))

    expect(onQuickCreate).toHaveBeenCalledWith('activity')
  })

  it('stores the element type in the drag payload', () => {
    const setData = vi.fn()
    render(<ProcessElementPalette onQuickCreate={() => {}} />)

    fireEvent.dragStart(screen.getByRole('button', { name: /decision/i }), {
      dataTransfer: { setData, effectAllowed: '' },
    })

    expect(setData).toHaveBeenCalledWith('application/x-flowent-process-element', 'decision')
  })
})
```

- [ ] **Step 2: Run palette tests to verify failure**

Run:

```bash
npx vitest run src/features/canvas/ProcessElementPalette.test.tsx
```

Expected: FAIL because `ProcessElementPalette.tsx` does not exist.

- [ ] **Step 3: Implement the process element palette**

Create `src/features/canvas/ProcessElementPalette.tsx`:

```tsx
import { PROCESS_ELEMENTS, type ProcessElementType } from './processElements'

interface ProcessElementPaletteProps {
  onQuickCreate: (type: ProcessElementType) => void
}

const DRAG_MIME_TYPE = 'application/x-flowent-process-element'

export function ProcessElementPalette({ onQuickCreate }: ProcessElementPaletteProps) {
  return (
    <section className="process-element-palette" aria-label="Process element library">
      <div className="process-element-palette-header">
        <span className="process-element-palette-title">Elements</span>
        <span className="process-element-palette-hint">Click to quick-create · drag to place</span>
      </div>
      <div className="process-element-list">
        {PROCESS_ELEMENTS.map((element) => (
          <button
            key={element.type}
            type="button"
            className={`process-element-button process-element-${element.type}`}
            draggable
            onClick={() => onQuickCreate(element.type)}
            onDragStart={(event) => {
              event.dataTransfer.effectAllowed = 'copy'
              event.dataTransfer.setData(DRAG_MIME_TYPE, element.type)
            }}
            aria-label={`${element.label}: ${element.description}`}
            title={element.description}
          >
            <span className="process-element-icon" aria-hidden="true">
              {getElementGlyph(element.type)}
            </span>
            <span className="process-element-copy">
              <span className="process-element-label">{element.label}</span>
              <span className="process-element-description">{element.description}</span>
            </span>
            {element.shortcut && <kbd>{element.shortcut}</kbd>}
          </button>
        ))}
      </div>
    </section>
  )
}

export function readDraggedProcessElement(dataTransfer: DataTransfer): ProcessElementType | null {
  const raw = dataTransfer.getData(DRAG_MIME_TYPE)
  if (raw === 'stage' || raw === 'activity' || raw === 'decision' || raw === 'bottleneck' || raw === 'end') {
    return raw
  }
  return null
}

function getElementGlyph(type: ProcessElementType): string {
  switch (type) {
    case 'stage':
      return '▦'
    case 'activity':
      return '▭'
    case 'decision':
      return '◇'
    case 'bottleneck':
      return '⚠'
    case 'end':
      return '●'
  }
}
```

- [ ] **Step 4: Mount the palette and handle drag-to-add**

In `src/features/canvas/ProcessCanvas.tsx`, import the React drag event type and the palette:

```typescript
import type { DragEvent } from 'react'
import { ProcessElementPalette, hasDraggedProcessElement, readDraggedProcessElement } from './ProcessElementPalette'
```

Update `ProcessElementPalette.tsx` to export a drag-over-safe type check:

```typescript
export function hasDraggedProcessElement(dataTransfer: DataTransfer): boolean {
  return Array.from(dataTransfer.types).includes(DRAG_MIME_TYPE)
}
```

Add these callbacks inside `ProcessCanvas`, after refs are created:

```typescript
const handleDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
  if (hasDraggedProcessElement(event.dataTransfer)) {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
  }
}, [])

const handleDrop = useCallback((event: DragEvent<HTMLDivElement>) => {
  const type = readDraggedProcessElement(event.dataTransfer)
  if (!type) return

  event.preventDefault()
  const rect = event.currentTarget.getBoundingClientRect()
  const screenX = event.clientX - rect.left
  const screenY = event.clientY - rect.top
  const worldX = (screenX - canvas.viewport.x) / canvas.viewport.zoom
  const worldY = (screenY - canvas.viewport.y) / canvas.viewport.zoom
  canvas.addNodeByType(type, { x: worldX, y: worldY })
}, [canvas])
```

Mount the palette between `Toolbar` and `pixi-host`:

```tsx
<ProcessElementPalette onQuickCreate={canvas.quickCreate} />

<div
  ref={hostRef}
  className="pixi-host"
  aria-label="Process canvas"
  tabIndex={0}
  onDragOver={handleDragOver}
  onDrop={handleDrop}
/>
```

- [ ] **Step 5: Simplify toolbar creation buttons**

In `src/features/canvas/Toolbar.tsx`, keep actions that are not duplicated by the palette: connector, layout, undo, redo, delete. Remove direct Activity, Decision, and End buttons from the toolbar after the palette is mounted. The toolbar props should become:

```typescript
interface ToolbarProps {
  onToggleConnector: ReturnType<typeof useCanvasState>['toggleConnectorMode']
  onRemove: ReturnType<typeof useCanvasState>['removeSelected']
  onAutoLayout: () => void
  onUndo: () => void
  onRedo: () => void
  canUndo: boolean
  canRedo: boolean
  hasSelection: boolean
  connectorMode: boolean
}
```

Update the `Toolbar` call in `ProcessCanvas.tsx` by removing `onAddActivity`, `onAddDecision`, and `onAddEnd` props.

- [ ] **Step 6: Add palette styles**

Append to `src/styles.css`:

```css
.process-element-palette {
  position: absolute;
  top: 96px;
  right: 18px;
  z-index: 8;
  width: 260px;
  padding: 12px;
  border: 1px solid color-mix(in srgb, var(--border) 78%, transparent);
  border-radius: 20px;
  background: color-mix(in srgb, var(--surface) 94%, transparent);
  box-shadow: 0 18px 48px rgba(15, 23, 42, 0.12);
  backdrop-filter: blur(18px);
}

.process-element-palette-header {
  display: grid;
  gap: 2px;
  margin-bottom: 10px;
}

.process-element-palette-title {
  color: var(--text);
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.process-element-palette-hint {
  color: var(--muted);
  font-size: 0.72rem;
}

.process-element-list {
  display: grid;
  gap: 8px;
}

.process-element-button {
  display: grid;
  grid-template-columns: 28px 1fr auto;
  gap: 10px;
  align-items: center;
  width: 100%;
  padding: 10px;
  border: 1px solid color-mix(in srgb, var(--border) 70%, transparent);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.74);
  color: var(--text);
  text-align: left;
  cursor: grab;
  transition: transform 160ms ease, border-color 160ms ease, box-shadow 160ms ease;
}

.process-element-button:hover,
.process-element-button:focus-visible {
  transform: translateY(-1px);
  border-color: color-mix(in srgb, var(--accent) 45%, var(--border));
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.12);
  outline: none;
}

.process-element-icon {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: 10px;
  background: color-mix(in srgb, var(--accent) 10%, white);
  color: var(--accent);
  font-weight: 800;
}

.process-element-copy {
  display: grid;
  gap: 2px;
}

.process-element-label {
  font-size: 0.85rem;
  font-weight: 700;
}

.process-element-description {
  color: var(--muted);
  font-size: 0.72rem;
  line-height: 1.25;
}
```

- [ ] **Step 7: Run palette tests**

Run:

```bash
npx vitest run src/features/canvas/ProcessElementPalette.test.tsx src/features/canvas/useCanvasState.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit palette and drag-to-add**

Run:

```bash
git add src/features/canvas/ProcessElementPalette.tsx src/features/canvas/ProcessElementPalette.test.tsx src/features/canvas/ProcessCanvas.tsx src/features/canvas/Toolbar.tsx src/styles.css
git commit -m "feat: add process element palette"
```

---

### Task 5: Semantic Node Editors and Rendering

**Files:**
- Modify: `src/features/canvas/PropertiesPanel.tsx`
- Modify: `src/features/canvas/PropertiesPanel.test.tsx`
- Modify: `src/features/canvas/render/drawNodes.ts`
- Modify: `src/features/canvas/useCanvasState.ts`

- [ ] **Step 1: Write failing editor tests for semantic nodes**

Append to `src/features/canvas/PropertiesPanel.test.tsx`:

```typescript
function makeStage(): ProcessNode {
  return {
    id: 'stage-1',
    type: 'stage',
    position: { x: 100, y: 100 },
    data: {
      kind: 'stage',
      title: 'Discovery',
      goal: 'Validate the problem',
      entryCondition: 'Opportunity is selected',
      exitCondition: 'Decision is made',
      owner: 'PM',
    },
  }
}

function makeBottleneck(): ProcessNode {
  return {
    id: 'bottleneck-1',
    type: 'bottleneck',
    position: { x: 100, y: 100 },
    data: {
      kind: 'bottleneck',
      title: 'Waiting for review',
      symptom: 'Work pauses before design approval',
      impact: 'Delivery waits',
      suspectedCause: 'Owner is unclear',
      reviewStatus: 'unclear',
    },
  }
}

it('edits stage process semantics', () => {
  const onUpdate = vi.fn()
  render(<PropertiesPanel node={makeStage()} edge={null} onUpdateNode={onUpdate} onUpdateEdge={() => {}} onClose={() => {}} />)

  const goal = screen.getByLabelText('Goal')
  fireEvent.change(goal, { target: { value: 'Align on validated direction' } })
  fireEvent.blur(goal)

  expect(onUpdate).toHaveBeenCalledWith('stage-1', { goal: 'Align on validated direction' })
})

it('edits bottleneck review status', () => {
  const onUpdate = vi.fn()
  render(<PropertiesPanel node={makeBottleneck()} edge={null} onUpdateNode={onUpdate} onUpdateEdge={() => {}} onClose={() => {}} />)

  fireEvent.change(screen.getByLabelText('Review status'), { target: { value: 'needs-owner' } })

  expect(onUpdate).toHaveBeenCalledWith('bottleneck-1', { reviewStatus: 'needs-owner' })
})

it('edits activity expectations', () => {
  const onUpdate = vi.fn()
  render(<PropertiesPanel node={makeActivity()} edge={null} onUpdateNode={onUpdate} onUpdateEdge={() => {}} onClose={() => {}} />)

  const expectations = screen.getByLabelText('Expectations')
  fireEvent.change(expectations, { target: { value: 'Ready when scope and owner are clear' } })
  fireEvent.blur(expectations)

  expect(onUpdate).toHaveBeenCalledWith('a1', { expectations: 'Ready when scope and owner are clear' })
})
```

- [ ] **Step 2: Run editor tests to verify failure**

Run:

```bash
npx vitest run src/features/canvas/PropertiesPanel.test.tsx
```

Expected: FAIL because `PropertiesPanel` has no stage, bottleneck, or expectations editor yet.

- [ ] **Step 3: Extend properties panel props for future edge editing**

Modify `PropertiesPanelProps` in `src/features/canvas/PropertiesPanel.tsx`:

```typescript
interface PropertiesPanelProps {
  node: ProcessNode | null
  edge: ProcessEdge | null
  onUpdateNode: (nodeId: string, data: Record<string, unknown>) => void
  onUpdateEdge: (edgeId: string, data: Record<string, unknown>) => void
  onClose: () => void
}
```

Update existing call sites and tests to pass `onUpdateEdge={() => {}}` until edge editing is wired in Task 6.

- [ ] **Step 4: Add semantic node editors**

In `NodeEditor`, add branches:

```tsx
if (data.kind === 'stage') {
  return <StageEditor nodeId={node.id} data={data} onUpdate={onUpdate} />
}

if (data.kind === 'bottleneck') {
  return <BottleneckEditor nodeId={node.id} data={data} onUpdate={onUpdate} />
}
```

Add these editors to `PropertiesPanel.tsx`:

```tsx
function StageEditor({
  nodeId,
  data,
  onUpdate,
}: {
  nodeId: string
  data: Extract<ProcessNode['data'], { kind: 'stage' }>
  onUpdate: (nodeId: string, data: Record<string, unknown>) => void
}) {
  return (
    <form className="properties-form">
      <SemanticTextInput label="Title" value={data.title} onCommit={(value) => onUpdate(nodeId, { title: value })} />
      <SemanticTextArea label="Goal" value={data.goal} onCommit={(value) => onUpdate(nodeId, { goal: value })} />
      <SemanticTextArea label="Entry condition" value={data.entryCondition} onCommit={(value) => onUpdate(nodeId, { entryCondition: value })} />
      <SemanticTextArea label="Exit condition" value={data.exitCondition} onCommit={(value) => onUpdate(nodeId, { exitCondition: value })} />
      <SemanticTextInput label="Owner" value={data.owner} onCommit={(value) => onUpdate(nodeId, { owner: value })} />
    </form>
  )
}

function BottleneckEditor({
  nodeId,
  data,
  onUpdate,
}: {
  nodeId: string
  data: Extract<ProcessNode['data'], { kind: 'bottleneck' }>
  onUpdate: (nodeId: string, data: Record<string, unknown>) => void
}) {
  return (
    <form className="properties-form">
      <SemanticTextInput label="Title" value={data.title} onCommit={(value) => onUpdate(nodeId, { title: value })} />
      <SemanticTextArea label="Symptom" value={data.symptom} onCommit={(value) => onUpdate(nodeId, { symptom: value })} />
      <SemanticTextArea label="Impact" value={data.impact} onCommit={(value) => onUpdate(nodeId, { impact: value })} />
      <SemanticTextArea label="Suspected cause" value={data.suspectedCause} onCommit={(value) => onUpdate(nodeId, { suspectedCause: value })} />
      <label htmlFor="prop-review-status">Review status</label>
      <select
        id="prop-review-status"
        value={data.reviewStatus}
        onChange={(event) => onUpdate(nodeId, { reviewStatus: event.target.value })}
      >
        <option value="unclear">Unclear</option>
        <option value="disputed">Disputed</option>
        <option value="needs-owner">Needs owner</option>
        <option value="approved">Approved</option>
        <option value="changed-since-approval">Changed since approval</option>
      </select>
    </form>
  )
}

function SemanticTextInput({
  label,
  value,
  onCommit,
}: {
  label: string
  value: string
  onCommit: (value: string) => void
}) {
  const [draft, setDraft] = useState(value)
  const id = `prop-${label.toLowerCase().replaceAll(' ', '-')}`
  return (
    <>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => onCommit(draft)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') (event.currentTarget as HTMLInputElement).blur()
        }}
      />
    </>
  )
}

function SemanticTextArea({
  label,
  value,
  onCommit,
}: {
  label: string
  value: string
  onCommit: (value: string) => void
}) {
  const [draft, setDraft] = useState(value)
  const id = `prop-${label.toLowerCase().replaceAll(' ', '-')}`
  return (
    <>
      <label htmlFor={id}>{label}</label>
      <textarea
        id={id}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => onCommit(draft)}
        rows={3}
      />
    </>
  )
}
```

Update `ActivityEditor` props to include `expectations`, render this field after summary, and commit on blur:

```tsx
<label htmlFor="prop-expectations">Expectations</label>
<textarea
  id="prop-expectations"
  value={expectationsDraft}
  onChange={(event) => setExpectationsDraft(event.target.value)}
  onBlur={() => onUpdate(nodeId, { expectations: expectationsDraft })}
  rows={3}
/>
```

- [ ] **Step 5: Update node data patching**

In `src/features/canvas/useCanvasState.ts`, extend `NodeDataPatch`:

```typescript
type NodeDataPatch = {
  title?: string
  summary?: string
  criteria?: string
  decisionOutcomes?: string[]
  roleIds?: string[]
  expectations?: string
  owner?: string
  goal?: string
  entryCondition?: string
  exitCondition?: string
  symptom?: string
  impact?: string
  suspectedCause?: string
  reviewStatus?: ReviewStatus
}
```

Update `updateNodeData` patch mapping:

```typescript
patch: {
  ...(typeof data.title === 'string' ? { title: data.title } : {}),
  ...(typeof data.summary === 'string' ? { summary: data.summary } : {}),
  ...(typeof data.criteria === 'string' ? { criteria: data.criteria } : {}),
  ...(Array.isArray(data.decisionOutcomes) ? { decisionOutcomes: data.decisionOutcomes } : {}),
  ...(Array.isArray(data.roleIds) ? { roleTags: data.roleIds } : {}),
  ...(typeof data.expectations === 'string' ? { expectations: data.expectations } : {}),
  ...(typeof data.owner === 'string' ? { owner: data.owner } : {}),
  ...(typeof data.goal === 'string' ? { goal: data.goal } : {}),
  ...(typeof data.entryCondition === 'string' ? { entryCondition: data.entryCondition } : {}),
  ...(typeof data.exitCondition === 'string' ? { exitCondition: data.exitCondition } : {}),
  ...(typeof data.symptom === 'string' ? { symptom: data.symptom } : {}),
  ...(typeof data.impact === 'string' ? { impact: data.impact } : {}),
  ...(typeof data.suspectedCause === 'string' ? { suspectedCause: data.suspectedCause } : {}),
  ...(isReviewStatus(data.reviewStatus) ? { reviewStatus: data.reviewStatus } : {}),
},
```

Add the local guard:

```typescript
function isReviewStatus(value: unknown): value is ReviewStatus {
  return value === 'unclear' ||
    value === 'disputed' ||
    value === 'needs-owner' ||
    value === 'approved' ||
    value === 'changed-since-approval'
}
```

- [ ] **Step 6: Draw stage and bottleneck nodes**

In `src/features/canvas/render/drawNodes.ts`, add branches before the generic activity branch:

```typescript
} else if (node.type === 'stage') {
  shadow.roundRect(0, 5, node.width, node.height, 22)
  shadow.fill({ color: 0x0f172a, alpha: 0.1 })
  shape.roundRect(0, 0, node.width, node.height, 22)
  shape.fill(0xf8fafc)
  shape.stroke({ color: selected ? 0x2563eb : 0x94a3b8, width: selected ? 2.5 : 1.6 })
} else if (node.type === 'bottleneck') {
  shadow.roundRect(0, 4, node.width, node.height, 18)
  shadow.fill({ color: 0x7c2d12, alpha: 0.12 })
  shape.roundRect(0, 0, node.width, node.height, 18)
  shape.fill(0xfff7ed)
  shape.stroke({ color: selected ? 0x2563eb : 0xea580c, width: selected ? 2.5 : 1.6 })
```

Render owner/status text under the title:

```typescript
if (node.owner && (node.type === 'stage' || node.type === 'decision')) {
  const owner = new Text({
    text: `Owner: ${node.owner}`,
    style: {
      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", "Segoe UI", sans-serif',
      fontSize: 11,
      fill: 0x64748b,
    },
  })
  owner.x = 14
  owner.y = 38
  container.addChild(owner)
}

if (node.reviewStatus && node.type === 'bottleneck') {
  const status = new Text({
    text: node.reviewStatus,
    style: {
      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", "Segoe UI", sans-serif',
      fontSize: 11,
      fontWeight: '600',
      fill: 0xc2410c,
    },
  })
  status.x = 14
  status.y = 38
  container.addChild(status)
}
```

- [ ] **Step 7: Run semantic editor tests**

Run:

```bash
npx vitest run src/features/canvas/PropertiesPanel.test.tsx src/features/canvas/useCanvasState.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit semantic node editing**

Run:

```bash
git add src/features/canvas/PropertiesPanel.tsx src/features/canvas/PropertiesPanel.test.tsx src/features/canvas/render/drawNodes.ts src/features/canvas/useCanvasState.ts
git commit -m "feat: add semantic node editors"
```

---

### Task 6: Handoff Edge Selection and Editing

**Files:**
- Modify: `src/features/canvas/engine/commands.ts`
- Modify: `src/features/canvas/useCanvasState.ts`
- Modify: `src/features/canvas/ProcessCanvas.tsx`
- Modify: `src/features/canvas/PropertiesPanel.tsx`
- Modify: `src/features/canvas/render/drawEdges.ts`
- Modify: `src/features/canvas/useCanvasState.test.ts`
- Modify: `src/features/canvas/PropertiesPanel.test.tsx`

- [ ] **Step 1: Write failing edge editing hook test**

Append to `src/features/canvas/useCanvasState.test.ts`:

```typescript
it('selects and updates a handoff edge by id', () => {
  const { result } = renderHook(() => useCanvasState())

  act(() => result.current.addActivity({ x: 120, y: 160 }))
  act(() => result.current.onConnect('start', result.current.nodes.find((node) => node.data.kind === 'activity')!.id, 'out', 'in'))

  const edge = result.current.edges[0]
  act(() => result.current.onEdgeClick(edge.id, false))
  act(() => result.current.updateEdgeData(edge.id, { expectation: 'Context moves with the work.' }))

  expect(result.current.selectedEdgeIds.has(edge.id)).toBe(true)
  expect(result.current.editorEdge?.data?.expectation).toBe('Context moves with the work.')
})
```

- [ ] **Step 2: Write failing handoff editor component test**

Append to `src/features/canvas/PropertiesPanel.test.tsx`:

```typescript
it('edits handoff expectation from the edge panel', () => {
  const onUpdateEdge = vi.fn()
  render(
    <PropertiesPanel
      node={null}
      edge={{
        id: 'edge-1',
        type: 'handoff',
        source: 'a',
        target: 'b',
        data: {
          label: '',
          fromRole: 'PM',
          toRole: 'Engineer',
          artifact: 'Ready brief',
          expectation: '',
          readinessSignal: '',
          reviewStatus: 'unclear',
        },
      }}
      onUpdateNode={() => {}}
      onUpdateEdge={onUpdateEdge}
      onClose={() => {}}
    />,
  )

  const expectation = screen.getByLabelText('Handoff expectation')
  fireEvent.change(expectation, { target: { value: 'Ready work includes context and acceptance expectations.' } })
  fireEvent.blur(expectation)

  expect(onUpdateEdge).toHaveBeenCalledWith('edge-1', {
    expectation: 'Ready work includes context and acceptance expectations.',
  })
})
```

- [ ] **Step 3: Run tests to verify failure**

Run:

```bash
npx vitest run src/features/canvas/useCanvasState.test.ts src/features/canvas/PropertiesPanel.test.tsx
```

Expected: FAIL because edge editing is not wired.

- [ ] **Step 4: Implement edge commands**

In `src/features/canvas/engine/commands.ts`, add cases:

```typescript
case 'UpdateEdge': {
  const edge = doc.edges.get(command.payload.id)
  if (!edge) return doc

  const edges = new Map(doc.edges)
  edges.set(edge.id, {
    ...edge,
    ...command.payload.patch,
  })

  return {
    ...doc,
    edges,
    meta: {
      dirty: true,
      version: doc.meta.version + 1,
    },
  }
}
case 'SelectEdge': {
  const selectedEdgeIds = new Set(doc.selectedEdgeIds)
  if (command.payload.additive) {
    if (selectedEdgeIds.has(command.payload.id)) {
      selectedEdgeIds.delete(command.payload.id)
    } else {
      selectedEdgeIds.add(command.payload.id)
    }
  } else {
    selectedEdgeIds.clear()
    selectedEdgeIds.add(command.payload.id)
  }

  return {
    ...doc,
    selectedNodeIds: command.payload.additive ? doc.selectedNodeIds : new Set(),
    selectedEdgeIds,
    meta: {
      dirty: true,
      version: doc.meta.version + 1,
    },
  }
}
```

- [ ] **Step 5: Add edge state actions**

In `src/features/canvas/useCanvasState.ts`, add computed selected edge and editor edge:

```typescript
const selectedEdgeIds = useMemo(() => document.selectedEdgeIds, [document])
const selectedEdge = useMemo(() => {
  const ids = Array.from(selectedEdgeIds)
  if (ids.length !== 1) return null
  const edge = document.edges.get(ids[0])
  return edge ? toProcessEdge(edge) : null
}, [document.edges, selectedEdgeIds])
const [editorEdgeId, setEditorEdgeId] = useState<string | null>(null)
const editorEdge = useMemo(() => {
  if (!editorEdgeId) return null
  const edge = document.edges.get(editorEdgeId)
  return edge ? toProcessEdge(edge) : null
}, [document.edges, editorEdgeId])
```

Replace `onEdgeClick`:

```typescript
const onEdgeClick = useCallback((edgeId: string, additive: boolean) => {
  applyCommand({ type: 'SelectEdge', payload: { id: edgeId, additive } })
  setEditorEdgeId(edgeId)
  setEditorNodeId(null)
}, [applyCommand])
```

Add `updateEdgeData`:

```typescript
type EdgeDataPatch = {
  label?: string
  fromRole?: string
  toRole?: string
  artifact?: string
  expectation?: string
  readinessSignal?: string
  reviewStatus?: ReviewStatus
}

const updateEdgeData = useCallback((edgeId: string, data: EdgeDataPatch) => {
  applyCommand({
    type: 'UpdateEdge',
    payload: {
      id: edgeId,
      patch: {
        ...(typeof data.label === 'string' ? { label: data.label } : {}),
        ...(typeof data.fromRole === 'string' ? { fromRole: data.fromRole } : {}),
        ...(typeof data.toRole === 'string' ? { toRole: data.toRole } : {}),
        ...(typeof data.artifact === 'string' ? { artifact: data.artifact } : {}),
        ...(typeof data.expectation === 'string' ? { expectation: data.expectation } : {}),
        ...(typeof data.readinessSignal === 'string' ? { readinessSignal: data.readinessSignal } : {}),
        ...(isReviewStatus(data.reviewStatus) ? { reviewStatus: data.reviewStatus } : {}),
      },
    },
  })
}, [applyCommand])
```

Clear edge editor in `onPaneClick`, `openEditor`, `closeEditor`, `undoAction`, and `redoAction` using `setEditorEdgeId(null)`.

Return:

```typescript
selectedEdgeIds,
selectedEdge,
editorEdge,
onEdgeClick,
updateEdgeData,
```

- [ ] **Step 6: Add handoff editor UI**

In `PropertiesPanel.tsx`, replace `EdgeInfo` with `HandoffEditor`:

```tsx
{edge && !node && <HandoffEditor edge={edge} onUpdate={onUpdateEdge} />}
```

Add:

```tsx
function HandoffEditor({
  edge,
  onUpdate,
}: {
  edge: ProcessEdge
  onUpdate: (edgeId: string, data: Record<string, unknown>) => void
}) {
  const data = edge.data ?? {}
  return (
    <form className="properties-form">
      <SemanticTextInput label="Label" value={data.label ?? ''} onCommit={(value) => onUpdate(edge.id, { label: value })} />
      <SemanticTextInput label="From role" value={data.fromRole ?? ''} onCommit={(value) => onUpdate(edge.id, { fromRole: value })} />
      <SemanticTextInput label="To role" value={data.toRole ?? ''} onCommit={(value) => onUpdate(edge.id, { toRole: value })} />
      <SemanticTextInput label="Artifact" value={data.artifact ?? ''} onCommit={(value) => onUpdate(edge.id, { artifact: value })} />
      <SemanticTextArea label="Handoff expectation" value={data.expectation ?? ''} onCommit={(value) => onUpdate(edge.id, { expectation: value })} />
      <SemanticTextArea label="Readiness signal" value={data.readinessSignal ?? ''} onCommit={(value) => onUpdate(edge.id, { readinessSignal: value })} />
      <label htmlFor="prop-edge-review-status">Review status</label>
      <select
        id="prop-edge-review-status"
        value={data.reviewStatus ?? 'unclear'}
        onChange={(event) => onUpdate(edge.id, { reviewStatus: event.target.value })}
      >
        <option value="unclear">Unclear</option>
        <option value="disputed">Disputed</option>
        <option value="needs-owner">Needs owner</option>
        <option value="approved">Approved</option>
        <option value="changed-since-approval">Changed since approval</option>
      </select>
    </form>
  )
}
```

- [ ] **Step 7: Make edges clickable in Pixi rendering**

Update `DrawEdgesOptions` in `src/features/canvas/render/drawEdges.ts`:

```typescript
export interface DrawEdgesOptions {
  preview?: boolean
  selectedEdgeIds?: Set<string>
  onEdgeClick?: (edgeId: string, event: { shiftKey: boolean; ctrlKey: boolean; metaKey: boolean }) => void
}
```

Inside `drawEdges`, draw a hit route before the visible route:

```typescript
const selected = options.selectedEdgeIds?.has(edge.id) ?? false
const hit = new Graphics()
hit.label = `edge-hit:${edge.id}`
;(hit as Graphics & { eventMode?: string; cursor?: string }).eventMode = 'static'
;(hit as Graphics & { eventMode?: string; cursor?: string }).cursor = 'pointer'
drawRoute(hit, edge.points, { preview: true })
hit.alpha = 0.001
hit.on('pointertap', (event) => {
  options.onEdgeClick?.(edge.id, {
    shiftKey: event.shiftKey,
    ctrlKey: event.ctrlKey,
    metaKey: event.metaKey,
  })
})
layer.addChild(hit)

const graphics = new Graphics()
graphics.label = `edge:${edge.id}`
;(graphics as Graphics & { eventMode?: string }).eventMode = 'none'
drawRoute(graphics, edge.points, { ...options, selected })
drawArrow(graphics, edge.points, { ...options, selected })
layer.addChild(graphics)
```

Extend `DrawEdgesOptions` locally to include `selected?: boolean` for `drawRoute` and `drawArrow`, then use selected color:

```typescript
const EDGE_SELECTED_STROKE = 0x2563eb
```

Use:

```typescript
color: options.preview ? EDGE_PREVIEW_STROKE : options.selected ? EDGE_SELECTED_STROKE : EDGE_STROKE,
width: options.preview ? EDGE_PREVIEW_WIDTH : options.selected ? 3 : EDGE_WIDTH,
```

In `ProcessCanvas.tsx`, call `drawEdges` with edge selection and click callback:

```typescript
drawEdges(layers.edgeLayer, buildRoutedEdges(graphEdgesRef.current, nodesByIdRef.current), {
  selectedEdgeIds: canvasRef.current.selectedEdgeIds,
  onEdgeClick: (edgeId, event) => {
    canvasRef.current.onEdgeClick(edgeId, event.shiftKey || event.ctrlKey || event.metaKey)
  },
})
```

Pass edge editor props to `PropertiesPanel`:

```tsx
<PropertiesPanel
  node={canvas.editorNode}
  edge={canvas.editorEdge}
  onUpdateNode={canvas.updateNodeData}
  onUpdateEdge={canvas.updateEdgeData}
  onClose={() => canvas.closeEditor()}
/>
```

- [ ] **Step 8: Run edge tests**

Run:

```bash
npx vitest run src/features/canvas/useCanvasState.test.ts src/features/canvas/PropertiesPanel.test.tsx
```

Expected: PASS.

- [ ] **Step 9: Commit handoff editing**

Run:

```bash
git add src/features/canvas/engine/commands.ts src/features/canvas/useCanvasState.ts src/features/canvas/ProcessCanvas.tsx src/features/canvas/PropertiesPanel.tsx src/features/canvas/render/drawEdges.ts src/features/canvas/useCanvasState.test.ts src/features/canvas/PropertiesPanel.test.tsx
git commit -m "feat: add semantic handoff editing"
```

---

### Task 7: Readability Focus Modes

**Files:**
- Create: `src/features/canvas/focus/processFocus.ts`
- Create: `src/features/canvas/focus/processFocus.test.ts`
- Create: `src/features/canvas/FocusBar.tsx`
- Modify: `src/features/canvas/useCanvasState.ts`
- Modify: `src/features/canvas/ProcessCanvas.tsx`
- Modify: `src/features/canvas/render/drawNodes.ts`
- Modify: `src/features/canvas/render/drawEdges.ts`
- Modify: `src/styles.css`

- [ ] **Step 1: Write failing focus helper tests**

Create `src/features/canvas/focus/processFocus.test.ts`:

```typescript
import { describe, expect, it } from 'vitest'
import { createEmptyDocument, addEdge, addNode } from '../engine/graphDocument'
import { createGraphNode, createHandoffEdge } from '../processElements'
import { deriveProcessFocus } from './processFocus'

describe('deriveProcessFocus', () => {
  it('focuses nodes owned by a selected role and their connected handoffs', () => {
    let doc = createEmptyDocument('doc')
    const activity = { ...createGraphNode('activity', 'activity-1', { x: 0, y: 0 }), roleTags: ['PM'] }
    const decision = { ...createGraphNode('decision', 'decision-1', { x: 300, y: 0 }), roleTags: ['Engineer'] }
    doc = addNode(addNode(doc, activity), decision)
    doc = addEdge(doc, createHandoffEdge('edge-1', 'activity-1', 'out', 'decision-1', 'in'))

    const focus = deriveProcessFocus(doc, { mode: 'role', role: 'PM' })

    expect(focus.focusedNodeIds).toEqual(new Set(['activity-1']))
    expect(focus.dimmedNodeIds).toEqual(new Set(['decision-1']))
    expect(focus.focusedEdgeIds).toEqual(new Set(['edge-1']))
  })

  it('focuses decision nodes in decision mode', () => {
    let doc = createEmptyDocument('doc')
    doc = addNode(doc, createGraphNode('activity', 'activity-1', { x: 0, y: 0 }))
    doc = addNode(doc, createGraphNode('decision', 'decision-1', { x: 300, y: 0 }))

    const focus = deriveProcessFocus(doc, { mode: 'decisions' })

    expect(focus.focusedNodeIds).toEqual(new Set(['decision-1']))
    expect(focus.dimmedNodeIds).toEqual(new Set(['activity-1']))
  })

  it('focuses bottleneck nodes in bottleneck mode', () => {
    let doc = createEmptyDocument('doc')
    doc = addNode(doc, createGraphNode('bottleneck', 'bottleneck-1', { x: 0, y: 0 }))
    doc = addNode(doc, createGraphNode('activity', 'activity-1', { x: 300, y: 0 }))

    const focus = deriveProcessFocus(doc, { mode: 'bottlenecks' })

    expect(focus.focusedNodeIds).toEqual(new Set(['bottleneck-1']))
    expect(focus.dimmedNodeIds).toEqual(new Set(['activity-1']))
  })
})
```

- [ ] **Step 2: Run focus tests to verify failure**

Run:

```bash
npx vitest run src/features/canvas/focus/processFocus.test.ts
```

Expected: FAIL because `processFocus.ts` does not exist.

- [ ] **Step 3: Implement focus derivation**

Create `src/features/canvas/focus/processFocus.ts`:

```typescript
import type { GraphDocument } from '../canvasTypes'

export type ProcessFocusState =
  | { mode: 'all' }
  | { mode: 'role'; role: string }
  | { mode: 'decisions' }
  | { mode: 'handoffs' }
  | { mode: 'bottlenecks' }

export interface ProcessFocusView {
  focusedNodeIds: Set<string>
  dimmedNodeIds: Set<string>
  focusedEdgeIds: Set<string>
  dimmedEdgeIds: Set<string>
}

export function deriveProcessFocus(doc: GraphDocument, focus: ProcessFocusState): ProcessFocusView {
  const allNodeIds = new Set(doc.nodes.keys())
  const allEdgeIds = new Set(doc.edges.keys())

  if (focus.mode === 'all') {
    return {
      focusedNodeIds: allNodeIds,
      dimmedNodeIds: new Set(),
      focusedEdgeIds: allEdgeIds,
      dimmedEdgeIds: new Set(),
    }
  }

  const focusedNodeIds = new Set<string>()
  const focusedEdgeIds = new Set<string>()

  if (focus.mode === 'role') {
    for (const node of doc.nodes.values()) {
      if (node.roleTags.includes(focus.role) || node.owner === focus.role) {
        focusedNodeIds.add(node.id)
      }
    }
    for (const edge of doc.edges.values()) {
      if (focusedNodeIds.has(edge.sourceNodeId) || focusedNodeIds.has(edge.targetNodeId) || edge.fromRole === focus.role || edge.toRole === focus.role) {
        focusedEdgeIds.add(edge.id)
      }
    }
  }

  if (focus.mode === 'decisions') {
    for (const node of doc.nodes.values()) {
      if (node.type === 'decision') focusedNodeIds.add(node.id)
    }
  }

  if (focus.mode === 'handoffs') {
    for (const edge of doc.edges.values()) {
      focusedEdgeIds.add(edge.id)
      focusedNodeIds.add(edge.sourceNodeId)
      focusedNodeIds.add(edge.targetNodeId)
    }
  }

  if (focus.mode === 'bottlenecks') {
    for (const node of doc.nodes.values()) {
      if (node.type === 'bottleneck') focusedNodeIds.add(node.id)
    }
  }

  return {
    focusedNodeIds,
    dimmedNodeIds: difference(allNodeIds, focusedNodeIds),
    focusedEdgeIds,
    dimmedEdgeIds: focus.mode === 'handoffs' || focus.mode === 'role' ? difference(allEdgeIds, focusedEdgeIds) : allEdgeIds,
  }
}

export function collectRoles(doc: GraphDocument): string[] {
  const roles = new Set<string>()
  for (const node of doc.nodes.values()) {
    for (const role of node.roleTags) roles.add(role)
    if (node.owner) roles.add(node.owner)
  }
  for (const edge of doc.edges.values()) {
    if (edge.fromRole) roles.add(edge.fromRole)
    if (edge.toRole) roles.add(edge.toRole)
  }
  return Array.from(roles).sort((a, b) => a.localeCompare(b))
}

function difference(left: Set<string>, right: Set<string>): Set<string> {
  const result = new Set<string>()
  for (const value of left) {
    if (!right.has(value)) result.add(value)
  }
  return result
}
```

- [ ] **Step 4: Add focus bar UI**

Create `src/features/canvas/FocusBar.tsx`:

```tsx
import type { ProcessFocusState } from './focus/processFocus'

interface FocusBarProps {
  focus: ProcessFocusState
  roles: string[]
  onChange: (focus: ProcessFocusState) => void
}

export function FocusBar({ focus, roles, onChange }: FocusBarProps) {
  return (
    <section className="focus-bar" aria-label="Readability focus tools">
      <button type="button" className={focus.mode === 'all' ? 'active' : ''} onClick={() => onChange({ mode: 'all' })}>
        All
      </button>
      <button type="button" className={focus.mode === 'decisions' ? 'active' : ''} onClick={() => onChange({ mode: 'decisions' })}>
        Decisions
      </button>
      <button type="button" className={focus.mode === 'handoffs' ? 'active' : ''} onClick={() => onChange({ mode: 'handoffs' })}>
        Handoffs
      </button>
      <button type="button" className={focus.mode === 'bottlenecks' ? 'active' : ''} onClick={() => onChange({ mode: 'bottlenecks' })}>
        Bottlenecks
      </button>
      <label htmlFor="focus-role">Role</label>
      <select
        id="focus-role"
        value={focus.mode === 'role' ? focus.role : ''}
        onChange={(event) => {
          if (event.target.value) onChange({ mode: 'role', role: event.target.value })
        }}
      >
        <option value="">Choose role</option>
        {roles.map((role) => (
          <option key={role} value={role}>{role}</option>
        ))}
      </select>
    </section>
  )
}
```

- [ ] **Step 5: Wire focus into canvas rendering**

In `useCanvasState.ts`, add focus state and derived roles:

```typescript
const [focus, setFocus] = useState<ProcessFocusState>({ mode: 'all' })
const focusView = useMemo(() => deriveProcessFocus(document, focus), [document, focus])
const roles = useMemo(() => collectRoles(document), [document])
```

Return:

```typescript
focus,
setFocus,
focusView,
roles,
```

In `ProcessCanvas.tsx`, import and mount `FocusBar`:

```typescript
import { FocusBar } from './FocusBar'
```

```tsx
<FocusBar focus={canvas.focus} roles={canvas.roles} onChange={canvas.setFocus} />
```

Pass `dimmedNodeIds` to node drawing:

```typescript
drawNodes(layers.nodeLayer, currentGraphNodes, currentCanvas.selectedNodeIds, {
  dimmedNodeIds: currentCanvas.focusView.dimmedNodeIds,
})
```

Pass focus edge ids to edge drawing:

```typescript
drawEdges(layers.edgeLayer, buildRoutedEdges(graphEdgesRef.current, nodesByIdRef.current), {
  selectedEdgeIds: canvasRef.current.selectedEdgeIds,
  dimmedEdgeIds: canvasRef.current.focusView.dimmedEdgeIds,
  onEdgeClick: (edgeId, event) => {
    canvasRef.current.onEdgeClick(edgeId, event.shiftKey || event.ctrlKey || event.metaKey)
  },
})
```

- [ ] **Step 6: Update draw functions for dimmed rendering**

Change `drawNodes` signature:

```typescript
export interface DrawNodesOptions {
  dimmedNodeIds?: Set<string>
}

export function drawNodes(layer: Container, nodes: GraphNode[], selectedNodeIds: Set<string>, options: DrawNodesOptions = {}): void {
```

After creating `container`, apply dimming:

```typescript
const dimmed = options.dimmedNodeIds?.has(node.id) ?? false
container.alpha = dimmed ? 0.28 : 1
```

Change `DrawEdgesOptions` in `drawEdges.ts`:

```typescript
export interface DrawEdgesOptions {
  preview?: boolean
  selected?: boolean
  selectedEdgeIds?: Set<string>
  dimmedEdgeIds?: Set<string>
  onEdgeClick?: (edgeId: string, event: { shiftKey: boolean; ctrlKey: boolean; metaKey: boolean }) => void
}
```

When drawing a visible edge, set alpha:

```typescript
const dimmed = options.dimmedEdgeIds?.has(edge.id) ?? false
graphics.alpha = dimmed ? 0.22 : 1
```

- [ ] **Step 7: Add focus styles**

Append to `src/styles.css`:

```css
.focus-bar {
  position: absolute;
  left: 50%;
  bottom: 54px;
  z-index: 8;
  display: flex;
  gap: 6px;
  align-items: center;
  transform: translateX(-50%);
  padding: 7px;
  border: 1px solid color-mix(in srgb, var(--border) 72%, transparent);
  border-radius: 999px;
  background: color-mix(in srgb, var(--surface) 94%, transparent);
  box-shadow: 0 14px 36px rgba(15, 23, 42, 0.12);
  backdrop-filter: blur(18px);
}

.focus-bar button,
.focus-bar select {
  min-height: 30px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--text);
  font: inherit;
  font-size: 0.78rem;
}

.focus-bar button {
  padding: 0 11px;
  cursor: pointer;
}

.focus-bar button.active {
  background: var(--text);
  color: white;
}

.focus-bar label {
  color: var(--muted);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
```

- [ ] **Step 8: Run focus tests**

Run:

```bash
npx vitest run src/features/canvas/focus/processFocus.test.ts src/features/canvas/useCanvasState.test.ts
```

Expected: PASS.

- [ ] **Step 9: Commit readability focus modes**

Run:

```bash
git add src/features/canvas/focus src/features/canvas/FocusBar.tsx src/features/canvas/ProcessCanvas.tsx src/features/canvas/render/drawNodes.ts src/features/canvas/render/drawEdges.ts src/features/canvas/useCanvasState.ts src/styles.css
git commit -m "feat: add process readability focus modes"
```

---

### Task 8: Alignment Diagnostics Checklist

**Files:**
- Create: `src/features/canvas/diagnostics/processMapDiagnostics.ts`
- Create: `src/features/canvas/diagnostics/processMapDiagnostics.test.ts`
- Create: `src/features/canvas/AlignmentChecklist.tsx`
- Create: `src/features/canvas/AlignmentChecklist.test.tsx`
- Modify: `src/features/canvas/useCanvasState.ts`
- Modify: `src/features/canvas/ProcessCanvas.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Write failing diagnostics tests**

Create `src/features/canvas/diagnostics/processMapDiagnostics.test.ts`:

```typescript
import { describe, expect, it } from 'vitest'
import { createEmptyDocument, addEdge, addNode } from '../engine/graphDocument'
import { createGraphNode, createHandoffEdge } from '../processElements'
import { getProcessMapDiagnostics } from './processMapDiagnostics'

describe('getProcessMapDiagnostics', () => {
  it('flags activities without responsible roles', () => {
    let doc = createEmptyDocument('doc')
    doc = addNode(doc, createGraphNode('activity', 'activity-1', { x: 0, y: 0 }))

    const diagnostics = getProcessMapDiagnostics(doc)

    expect(diagnostics).toContainEqual(expect.objectContaining({
      targetType: 'node',
      targetId: 'activity-1',
      severity: 'warning',
      title: 'Activity needs responsible roles',
    }))
  })

  it('flags handoffs without expectations', () => {
    let doc = createEmptyDocument('doc')
    doc = addNode(doc, createGraphNode('activity', 'a', { x: 0, y: 0 }))
    doc = addNode(doc, createGraphNode('activity', 'b', { x: 300, y: 0 }))
    doc = addEdge(doc, createHandoffEdge('edge-1', 'a', 'out', 'b', 'in'))

    const diagnostics = getProcessMapDiagnostics(doc)

    expect(diagnostics).toContainEqual(expect.objectContaining({
      targetType: 'edge',
      targetId: 'edge-1',
      title: 'Handoff expectation is missing',
    }))
  })

  it('does not flag a complete activity and handoff', () => {
    let doc = createEmptyDocument('doc')
    const a = {
      ...createGraphNode('activity', 'a', { x: 0, y: 0 }),
      roleTags: ['PM'],
      expectations: 'Problem, owner, and next step are clear.',
    }
    const b = {
      ...createGraphNode('activity', 'b', { x: 300, y: 0 }),
      roleTags: ['Engineer'],
      expectations: 'Implementation can start without another clarification loop.',
    }
    doc = addNode(addNode(doc, a), b)
    doc = addEdge(doc, {
      ...createHandoffEdge('edge-1', 'a', 'out', 'b', 'in'),
      expectation: 'Ready work includes context and owner.',
    })

    const diagnostics = getProcessMapDiagnostics(doc)

    expect(diagnostics.find((item) => item.targetId === 'a')).toBeUndefined()
    expect(diagnostics.find((item) => item.targetId === 'edge-1')).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run diagnostics tests to verify failure**

Run:

```bash
npx vitest run src/features/canvas/diagnostics/processMapDiagnostics.test.ts
```

Expected: FAIL because diagnostics helper does not exist.

- [ ] **Step 3: Implement diagnostics helper**

Create `src/features/canvas/diagnostics/processMapDiagnostics.ts`:

```typescript
import type { GraphDocument } from '../canvasTypes'

export type DiagnosticSeverity = 'info' | 'warning'

export interface ProcessMapDiagnostic {
  id: string
  targetType: 'node' | 'edge'
  targetId: string
  severity: DiagnosticSeverity
  title: string
  detail: string
}

export function getProcessMapDiagnostics(doc: GraphDocument): ProcessMapDiagnostic[] {
  const diagnostics: ProcessMapDiagnostic[] = []

  for (const node of doc.nodes.values()) {
    if (node.type === 'activity' && node.roleTags.length === 0) {
      diagnostics.push({
        id: `node-${node.id}-missing-role`,
        targetType: 'node',
        targetId: node.id,
        severity: 'warning',
        title: 'Activity needs responsible roles',
        detail: 'Add at least one responsible role so ownership is visible on the map.',
      })
    }

    if (node.type === 'activity' && !hasText(node.expectations)) {
      diagnostics.push({
        id: `node-${node.id}-missing-expectations`,
        targetType: 'node',
        targetId: node.id,
        severity: 'info',
        title: 'Activity expectation is missing',
        detail: 'Describe what makes this activity ready, complete, or acceptable.',
      })
    }

    if (node.type === 'decision' && !hasText(node.criteria)) {
      diagnostics.push({
        id: `node-${node.id}-missing-criteria`,
        targetType: 'node',
        targetId: node.id,
        severity: 'warning',
        title: 'Decision criteria are missing',
        detail: 'Add criteria so the team knows how this decision is made.',
      })
    }

    if (node.type === 'stage' && !hasText(node.exitCondition)) {
      diagnostics.push({
        id: `node-${node.id}-missing-exit`,
        targetType: 'node',
        targetId: node.id,
        severity: 'info',
        title: 'Stage exit condition is missing',
        detail: 'Add an exit condition so the team knows when the stage is complete.',
      })
    }

    if (node.type === 'bottleneck' && node.reviewStatus !== 'approved') {
      diagnostics.push({
        id: `node-${node.id}-open-bottleneck`,
        targetType: 'node',
        targetId: node.id,
        severity: 'warning',
        title: 'Bottleneck needs review',
        detail: 'Clarify owner, cause, and next action before marking this bottleneck approved.',
      })
    }
  }

  for (const edge of doc.edges.values()) {
    if (!hasText(edge.expectation)) {
      diagnostics.push({
        id: `edge-${edge.id}-missing-expectation`,
        targetType: 'edge',
        targetId: edge.id,
        severity: 'warning',
        title: 'Handoff expectation is missing',
        detail: 'Describe what context, artifact, or signal moves across this handoff.',
      })
    }
  }

  return diagnostics
}

function hasText(value: string | undefined): boolean {
  return typeof value === 'string' && value.trim().length > 0
}
```

- [ ] **Step 4: Write failing checklist component tests**

Create `src/features/canvas/AlignmentChecklist.test.tsx`:

```typescript
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AlignmentChecklist } from './AlignmentChecklist'
import type { ProcessMapDiagnostic } from './diagnostics/processMapDiagnostics'

const diagnostics: ProcessMapDiagnostic[] = [
  {
    id: 'node-a-missing-role',
    targetType: 'node',
    targetId: 'a',
    severity: 'warning',
    title: 'Activity needs responsible roles',
    detail: 'Add at least one responsible role.',
  },
]

describe('AlignmentChecklist', () => {
  it('renders diagnostics as alignment work, not diagram feedback', () => {
    render(<AlignmentChecklist diagnostics={diagnostics} onSelectDiagnostic={() => {}} />)

    expect(screen.getByText('Alignment checklist')).toBeInTheDocument()
    expect(screen.getByText('Activity needs responsible roles')).toBeInTheDocument()
    expect(screen.getByText('Add at least one responsible role.')).toBeInTheDocument()
  })

  it('selects the diagnostic target when clicked', () => {
    const onSelectDiagnostic = vi.fn()
    render(<AlignmentChecklist diagnostics={diagnostics} onSelectDiagnostic={onSelectDiagnostic} />)

    fireEvent.click(screen.getByRole('button', { name: /activity needs responsible roles/i }))

    expect(onSelectDiagnostic).toHaveBeenCalledWith(diagnostics[0])
  })
})
```

- [ ] **Step 5: Implement checklist component**

Create `src/features/canvas/AlignmentChecklist.tsx`:

```tsx
import type { ProcessMapDiagnostic } from './diagnostics/processMapDiagnostics'

interface AlignmentChecklistProps {
  diagnostics: ProcessMapDiagnostic[]
  onSelectDiagnostic: (diagnostic: ProcessMapDiagnostic) => void
}

export function AlignmentChecklist({ diagnostics, onSelectDiagnostic }: AlignmentChecklistProps) {
  return (
    <aside className="alignment-checklist" aria-label="Alignment checklist">
      <div className="alignment-checklist-header">
        <span>Alignment checklist</span>
        <strong>{diagnostics.length}</strong>
      </div>
      {diagnostics.length === 0 ? (
        <p className="alignment-checklist-empty">No alignment gaps found in the current map.</p>
      ) : (
        <ul className="alignment-diagnostic-list">
          {diagnostics.map((diagnostic) => (
            <li key={diagnostic.id}>
              <button
                type="button"
                className={`alignment-diagnostic alignment-diagnostic-${diagnostic.severity}`}
                onClick={() => onSelectDiagnostic(diagnostic)}
                aria-label={`${diagnostic.title}: ${diagnostic.detail}`}
              >
                <span className="alignment-diagnostic-title">{diagnostic.title}</span>
                <span className="alignment-diagnostic-detail">{diagnostic.detail}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </aside>
  )
}
```

- [ ] **Step 6: Wire diagnostics into canvas**

In `useCanvasState.ts`, import and compute diagnostics:

```typescript
import { getProcessMapDiagnostics } from './diagnostics/processMapDiagnostics'
```

```typescript
const diagnostics = useMemo(() => getProcessMapDiagnostics(document), [document])
```

Add helper to select diagnostic target:

```typescript
const selectDiagnosticTarget = useCallback((targetType: 'node' | 'edge', targetId: string) => {
  if (targetType === 'node') {
    applyCommand({ type: 'SelectNode', payload: { id: targetId, additive: false } })
    setEditorNodeId(targetId)
    setEditorEdgeId(null)
  } else {
    applyCommand({ type: 'SelectEdge', payload: { id: targetId, additive: false } })
    setEditorEdgeId(targetId)
    setEditorNodeId(null)
  }
}, [applyCommand])
```

Return:

```typescript
diagnostics,
selectDiagnosticTarget,
```

In `ProcessCanvas.tsx`, import and render:

```typescript
import { AlignmentChecklist } from './AlignmentChecklist'
```

```tsx
<AlignmentChecklist
  diagnostics={canvas.diagnostics}
  onSelectDiagnostic={(diagnostic) => canvas.selectDiagnosticTarget(diagnostic.targetType, diagnostic.targetId)}
/>
```

- [ ] **Step 7: Add checklist styles**

Append to `src/styles.css`:

```css
.alignment-checklist {
  position: absolute;
  right: 18px;
  bottom: 98px;
  z-index: 8;
  width: 300px;
  max-height: 34vh;
  overflow: auto;
  padding: 12px;
  border: 1px solid color-mix(in srgb, var(--border) 76%, transparent);
  border-radius: 20px;
  background: color-mix(in srgb, var(--surface) 94%, transparent);
  box-shadow: 0 18px 48px rgba(15, 23, 42, 0.12);
  backdrop-filter: blur(18px);
}

.alignment-checklist-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
  color: var(--text);
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.alignment-checklist-header strong {
  display: grid;
  place-items: center;
  min-width: 24px;
  height: 24px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--accent) 12%, white);
  color: var(--accent);
}

.alignment-checklist-empty {
  margin: 0;
  color: var(--muted);
  font-size: 0.82rem;
  line-height: 1.4;
}

.alignment-diagnostic-list {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.alignment-diagnostic {
  display: grid;
  gap: 4px;
  width: 100%;
  padding: 10px;
  border: 1px solid color-mix(in srgb, var(--border) 72%, transparent);
  border-radius: 14px;
  background: white;
  color: var(--text);
  text-align: left;
  cursor: pointer;
}

.alignment-diagnostic-warning {
  border-color: color-mix(in srgb, #f97316 34%, var(--border));
}

.alignment-diagnostic-title {
  font-size: 0.84rem;
  font-weight: 750;
}

.alignment-diagnostic-detail {
  color: var(--muted);
  font-size: 0.74rem;
  line-height: 1.35;
}
```

- [ ] **Step 8: Run diagnostics and checklist tests**

Run:

```bash
npx vitest run src/features/canvas/diagnostics/processMapDiagnostics.test.ts src/features/canvas/AlignmentChecklist.test.tsx src/features/canvas/useCanvasState.test.ts
```

Expected: PASS.

- [ ] **Step 9: Commit alignment diagnostics**

Run:

```bash
git add src/features/canvas/diagnostics src/features/canvas/AlignmentChecklist.tsx src/features/canvas/AlignmentChecklist.test.tsx src/features/canvas/ProcessCanvas.tsx src/features/canvas/useCanvasState.ts src/styles.css
git commit -m "feat: add process alignment diagnostics"
```

---

### Task 9: End-to-End Canvas Builder Coverage

**Files:**
- Create: `e2e/canvas-builder-concept.spec.ts`
- Modify: `playwright.config.ts` only if the existing config lacks a web server for `npm run dev`

- [ ] **Step 1: Write the E2E test**

Create `e2e/canvas-builder-concept.spec.ts`:

```typescript
import { test, expect } from '@playwright/test'

const pixiCanvas = '.pixi-host canvas'
const statusBar = '.status-bar'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.evaluate(async () => {
    try { localStorage.clear() } catch { /* noop */ }
    history.replaceState(null, '', '/')
    const res = await fetch('/api/library')
    const body = (await res.json()) as { data: { maps: { id: string }[] } }
    for (const map of body.data.maps) {
      await fetch(`/api/library/maps/${map.id}`, { method: 'DELETE' })
    }
  })
  await page.reload()
  await page.waitForSelector(pixiCanvas)
})

test('quick-create builds a process flow from the selected start node', async ({ page }) => {
  await expect(page.locator(statusBar)).toContainText('1 nodes')

  await page.locator('canvas').click({ position: { x: 420, y: 230 } })
  await page.getByRole('button', { name: /activity/i }).click()

  await expect(page.locator(statusBar)).toContainText('2 nodes')
  await expect(page.locator(statusBar)).toContainText('1 edges')
})

test('dragging a palette element places a semantic node on the canvas', async ({ page }) => {
  const canvasBox = await page.locator(pixiCanvas).boundingBox()
  const buttonBox = await page.getByRole('button', { name: /bottleneck/i }).boundingBox()
  if (!canvasBox || !buttonBox) throw new Error('missing drag source or canvas')

  await page.mouse.move(buttonBox.x + buttonBox.width / 2, buttonBox.y + buttonBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(canvasBox.x + 520, canvasBox.y + 360)
  await page.mouse.up()

  await expect(page.locator(statusBar)).toContainText('2 nodes')
  await expect(page.getByText('Alignment checklist')).toBeVisible()
})

test('semantic editing updates activity expectations', async ({ page }) => {
  await page.locator('canvas').click({ position: { x: 420, y: 230 } })
  await page.getByRole('button', { name: /activity/i }).click()

  const box = await page.locator(pixiCanvas).boundingBox()
  if (!box) throw new Error('missing canvas')

  await page.mouse.dblclick(box.x + 700, box.y + 245)
  await page.getByLabel('Expectations').fill('Ready when scope and owner are clear')
  await page.getByLabel('Expectations').blur()

  await expect(page.getByDisplayValue('Ready when scope and owner are clear')).toBeVisible()
})

test('focus bar exposes decision and bottleneck readability modes', async ({ page }) => {
  await page.getByRole('button', { name: /decision/i }).click()
  await page.getByRole('button', { name: /bottleneck/i }).click()

  await page.getByRole('button', { name: 'Decisions' }).click()
  await expect(page.getByRole('button', { name: 'Decisions' })).toHaveClass(/active/)

  await page.getByRole('button', { name: 'Bottlenecks' }).click()
  await expect(page.getByRole('button', { name: 'Bottlenecks' })).toHaveClass(/active/)
})
```

- [ ] **Step 2: Run the new E2E spec**

Run:

```bash
npx playwright test e2e/canvas-builder-concept.spec.ts
```

Expected: PASS. If drag-and-drop is flaky in Chromium, replace only the drag test with a click-based bottleneck creation assertion and keep drag covered by `ProcessElementPalette.test.tsx`.

- [ ] **Step 3: Commit E2E coverage**

Run:

```bash
git add e2e/canvas-builder-concept.spec.ts playwright.config.ts
git commit -m "test: cover canvas builder concept flow"
```

---

### Task 10: Quality Gate and Documentation Update

**Files:**
- Modify: `docs/superpowers/specs/2026-06-04-flowent-canvas-builder-concept-design.md`
- Modify: `docs/superpowers/plans/2026-06-04-flowent-canvas-builder-foundation.md` if execution notes reveal corrected commands or file paths

- [ ] **Step 1: Update the concept spec status**

In `docs/superpowers/specs/2026-06-04-flowent-canvas-builder-concept-design.md`, change:

```markdown
**Status**: Draft (approved in conversation; pending final user review)
```

to:

```markdown
**Status**: Approved for Canvas Builder Foundation implementation
```

- [ ] **Step 2: Run focused unit tests**

Run:

```bash
npx vitest run \
  src/features/canvas/processElements.test.ts \
  src/features/canvas/templates/processMapTemplates.test.ts \
  src/features/canvas/engine/graphSerialization.test.ts \
  src/features/canvas/engine/quickCreate.test.ts \
  src/features/canvas/ProcessElementPalette.test.tsx \
  src/features/canvas/PropertiesPanel.test.tsx \
  src/features/canvas/focus/processFocus.test.ts \
  src/features/canvas/diagnostics/processMapDiagnostics.test.ts \
  src/features/canvas/AlignmentChecklist.test.tsx \
  src/features/canvas/useCanvasState.test.ts
```

Expected: PASS.

- [ ] **Step 3: Run full unit test suite**

Run:

```bash
npm test
```

Expected: PASS.

- [ ] **Step 4: Run lint**

Run:

```bash
npm run lint
```

Expected: PASS.

- [ ] **Step 5: Run production build**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 6: Run E2E suite**

Run:

```bash
npm run test:e2e
```

Expected: PASS. If existing unrelated E2E specs fail, record the failing spec names and commands in the implementation summary.

- [ ] **Step 7: Review changed code**

Run:

```bash
git diff --stat
git diff -- src/features/canvas docs/superpowers e2e/canvas-builder-concept.spec.ts
```

Expected: diff shows only canvas builder, docs, styles, and tests related to this plan.

- [ ] **Step 8: Commit final docs/status update**

Run:

```bash
git add docs/superpowers/specs/2026-06-04-flowent-canvas-builder-concept-design.md docs/superpowers/plans/2026-06-04-flowent-canvas-builder-foundation.md
git commit -m "docs: finalize canvas builder foundation plan"
```

---

## Validation Summary

Run these commands before handing off the branch:

```bash
npm run lint
npm test
npm run test:e2e
npm run build
```

Manual verification checklist:

- Create a new map from the blank template.
- Create a new map from the product discovery template.
- Select the start node, click Activity in the element palette, and confirm a connected activity appears.
- Drag a Bottleneck element from the palette to the canvas.
- Double-click an activity and edit responsible roles plus expectations.
- Click a handoff edge and edit from role, to role, artifact, expectation, readiness signal, and review status.
- Switch focus to Decisions, Handoffs, Bottlenecks, and one populated Role.
- Confirm the alignment checklist flags missing roles, missing handoff expectations, and open bottlenecks.
- Run Auto Layout and confirm the map remains left-to-right and readable.

## Spec Coverage Review

Covered by this plan:

- Fast process-map creation: Tasks 2, 3, 4
- Blank and template starts: Task 2
- Quick-create: Task 3
- Drag-and-drop process element library: Task 4
- Keyboard-first creation remains supported through existing shortcuts and `quickCreate` wiring: Task 3
- Template persistence without Map/Set JSON loss: Task 2
- Auto layout and connector readability foundation: existing implementation plus Tasks 6 and 7
- Stage, activity, decision, handoff, bottleneck semantics: Tasks 1, 5, 6
- Team alignment bridge through review status and diagnostics: Tasks 5, 6, 8

Deferred to separate implementation plans:

- AI draft entry from scenario generation into the visual canvas
- Node, edge, stage, and version comments
- Consensus approval and activation flow
- Change impact summary for activated maps
- Stakeholder share links and read-only views
- PDF, PNG, and SVG export

## Risk Controls

- Keep factory, quick-create, template, focus, and diagnostics behavior in pure modules with unit tests.
- Do not add a general-purpose shape library.
- Keep element naming process-specific: Stage, Activity, Decision, Handoff, Bottleneck, End.
- Avoid adding decorative styling controls unless they improve process readability.
- Keep large UI changes behind existing canvas shell boundaries.
- If `ProcessCanvas.tsx` grows beyond a maintainable size during execution, extract pointer/drop helpers into focused modules inside `src/features/canvas/interaction/` as part of the task being implemented.
