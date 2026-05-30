# Visual Canvas Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the old Flowent MVP tabbed workflow with a single-screen, high-performance, Apple-minimalist visual process modeling canvas using PixiJS + custom graph editor logic.

**Architecture:** Keep React as UI shell (toolbar, overlays, property editor), move graph rendering to PixiJS/WebGL layers, and implement a focused custom graph engine for commands, selection, and editing. Use an async layout engine with worker-capable interfaces and enforce TDD for graph behavior, UI interactions, and E2E modeling journeys.

**Tech Stack:** React 19, TypeScript, Vite, PixiJS, Vitest, Testing Library, Playwright.

---

## File Structure and Responsibilities

### Core entry and app shell
- Modify: `src/App.tsx`
  - Replace current React Flow-based entry with Pixi-powered canvas root.
- Modify: `src/main.tsx`
  - Ensure bootstrapping remains compatible with new single-screen app shell.

### Canvas feature (new authoritative modeling surface)
- Modify: `src/features/canvas/canvasTypes.ts`
  - Define strict graph document, node, edge, port, selection, and command types.
- Modify: `src/features/canvas/useCanvasState.ts`
  - Become graph command orchestrator + undo/redo + keyboard dispatch + selection model.
- Modify: `src/features/canvas/ProcessCanvas.tsx`
  - Integrate Pixi canvas, toolbar, overlays, and editor entry points.
- Modify: `src/features/canvas/Toolbar.tsx`
  - Tool-mode switching and quick actions (Auto Layout, delete, fit view).
- Modify: `src/features/canvas/PropertiesPanel.tsx`
  - Floating editor for node fields on double-click.
- Modify: `src/features/canvas/nodes/ActivityNode.tsx`
- Modify: `src/features/canvas/nodes/DecisionNode.tsx`
- Modify: `src/features/canvas/nodes/StartEndNode.tsx`
- Modify: `src/features/canvas/edges/HandoffEdge.tsx`
  - Keep semantic node/edge presentation contract, but route drawing through Pixi-backed layer.

### New graph engine internals (split for clarity)
- Create: `src/features/canvas/engine/graphDocument.ts`
  - Immutable graph document helpers (node/edge CRUD, id integrity).
- Create: `src/features/canvas/engine/commands.ts`
  - Command handlers: add/move/connect/delete/update.
- Create: `src/features/canvas/engine/history.ts`
  - Undo/redo stacks and command inversion.
- Create: `src/features/canvas/engine/selection.ts`
  - Single-select, marquee-select, multi-select drag payload.
- Create: `src/features/canvas/engine/hitTest.ts`
  - Node/edge hit-testing for pointer events.
- Create: `src/features/canvas/engine/keyboard.ts`
  - Shortcut map and dispatch.

### Pixi rendering layer
- Create: `src/features/canvas/render/pixiStage.ts`
  - Stage/camera setup and lifecycle management.
- Create: `src/features/canvas/render/layers.ts`
  - Grid, edges, nodes, overlays layer composition.
- Create: `src/features/canvas/render/drawNodes.ts`
  - Batched node drawing with style variants.
- Create: `src/features/canvas/render/drawEdges.ts`
  - Curved edge drawing + labels.
- Create: `src/features/canvas/render/viewportCulling.ts`
  - Visible-region culling helpers.

### Layout integration
- Create: `src/features/canvas/layout/autoLayout.ts`
  - Async layout adapter API (`layoutGraph(document)`).
- Create: `src/features/canvas/layout/layoutWorker.ts`
  - Worker entrypoint (phase-2 hook-up; initial no-op fallback allowed if API contract is fixed).

### Legacy model adapters
- Create: `src/features/canvas/adapters/processMapToGraph.ts`
- Create: `src/features/canvas/adapters/graphToProcessMap.ts`
  - Preserve mapping bridge for future compatibility while removing old UI path.

### Styling
- Modify: `src/styles.css`
  - Replace with single-screen Apple-minimal style tokens, spacing, motion, and canvas UI styles.

### Tests (unit + component + e2e)
- Create: `src/features/canvas/engine/graphDocument.test.ts`
- Create: `src/features/canvas/engine/commands.test.ts`
- Create: `src/features/canvas/engine/history.test.ts`
- Create: `src/features/canvas/engine/selection.test.ts`
- Create: `src/features/canvas/engine/keyboard.test.ts`
- Modify: `src/features/canvas/useCanvasState.test.ts`
- Modify: `src/features/canvas/ProcessCanvas.test.tsx` (if missing, create)
- Modify: `src/features/canvas/Toolbar.test.tsx` (if missing, create)
- Modify: `src/features/canvas/PropertiesPanel.test.tsx` (if missing, create)
- Create: `e2e/canvas-modeling.spec.ts`
- Update/replace old flow E2E specs:
  - Modify or delete: `e2e/role-navigation.spec.ts`
  - Modify or delete: `e2e/multi-role-process-views.spec.ts`
  - Modify or delete: `e2e/scenario-generation.spec.ts`
  - Modify or delete: `e2e/collaborative-workspace.spec.ts`
  - Modify or delete: `e2e/consensus-activation.spec.ts`
  - Modify or delete: `e2e/validation-prototype.spec.ts`

### Documentation
- Modify: `.claude/prds/flowent-mvp.prd.md`
  - Reflect product direction replacement from old tabbed MVP to canvas-first modeler.
- Create: `docs/superpowers/specs/2026-05-30-visual-canvas-redesign-design.md` (already exists; keep current)
- Create: `docs/superpowers/plans/2026-05-30-visual-canvas-redesign.md` (this file)

---

## Task 1: Stabilize baseline and define GraphDocument types

**Files:**
- Modify: `src/features/canvas/canvasTypes.ts`
- Create: `src/features/canvas/engine/graphDocument.ts`
- Test: `src/features/canvas/engine/graphDocument.test.ts`

- [ ] **Step 1: Write failing GraphDocument tests**

```ts
import { describe, expect, it } from 'vitest'
import { createEmptyDocument, addNode, addEdge } from './graphDocument'

describe('graphDocument', () => {
  it('creates empty document with deterministic defaults', () => {
    const doc = createEmptyDocument('test-doc')
    expect(doc.id).toBe('test-doc')
    expect(doc.nodes.size).toBe(0)
    expect(doc.edges.size).toBe(0)
    expect(doc.selection.size).toBe(0)
    expect(doc.viewport).toEqual({ x: 0, y: 0, zoom: 1 })
  })

  it('adds node immutably and keeps previous doc untouched', () => {
    const doc = createEmptyDocument('d1')
    const next = addNode(doc, {
      id: 'n1', type: 'activity', x: 100, y: 100,
      width: 220, height: 96,
      title: 'Activity 1', summary: 'desc', roleTags: ['PM'], ports: []
    })
    expect(doc.nodes.size).toBe(0)
    expect(next.nodes.size).toBe(1)
  })

  it('rejects edge creation when endpoint ids are missing', () => {
    const doc = createEmptyDocument('d1')
    expect(() => addEdge(doc, {
      id: 'e1', sourceNodeId: 'a', sourcePortId: 'out',
      targetNodeId: 'b', targetPortId: 'in', label: ''
    })).toThrow(/missing endpoint/i)
  })
})
```

- [ ] **Step 2: Run tests to verify RED**

Run: `npm test -- src/features/canvas/engine/graphDocument.test.ts`
Expected: FAIL with module/function-not-found errors.

- [ ] **Step 3: Implement minimal GraphDocument module**

```ts
// src/features/canvas/engine/graphDocument.ts
import type { GraphDocument, GraphNode, GraphEdge } from '../canvasTypes'

export function createEmptyDocument(id: string): GraphDocument {
  return {
    id,
    nodes: new Map(),
    edges: new Map(),
    selection: new Set(),
    viewport: { x: 0, y: 0, zoom: 1 },
    meta: { dirty: false, version: 1 },
  }
}

export function addNode(doc: GraphDocument, node: GraphNode): GraphDocument {
  const nodes = new Map(doc.nodes)
  nodes.set(node.id, node)
  return { ...doc, nodes, meta: { ...doc.meta, dirty: true, version: doc.meta.version + 1 } }
}

export function addEdge(doc: GraphDocument, edge: GraphEdge): GraphDocument {
  if (!doc.nodes.has(edge.sourceNodeId) || !doc.nodes.has(edge.targetNodeId)) {
    throw new Error('Missing endpoint node for edge')
  }
  const edges = new Map(doc.edges)
  edges.set(edge.id, edge)
  return { ...doc, edges, meta: { ...doc.meta, dirty: true, version: doc.meta.version + 1 } }
}
```

- [ ] **Step 4: Run tests to verify GREEN**

Run: `npm test -- src/features/canvas/engine/graphDocument.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/canvas/canvasTypes.ts src/features/canvas/engine/graphDocument.ts src/features/canvas/engine/graphDocument.test.ts
git commit -m "feat: define graph document core model"
```

---

## Task 2: Implement command engine (CRUD + connect + update)

**Files:**
- Create: `src/features/canvas/engine/commands.ts`
- Test: `src/features/canvas/engine/commands.test.ts`

- [ ] **Step 1: Write failing command tests**

```ts
import { describe, expect, it } from 'vitest'
import { createEmptyDocument } from './graphDocument'
import { runCommand } from './commands'

describe('commands', () => {
  it('applies AddNode command', () => {
    const doc = createEmptyDocument('d1')
    const next = runCommand(doc, {
      type: 'AddNode',
      payload: {
        id: 'n1', type: 'activity', x: 80, y: 120, width: 220, height: 96,
        title: 'A1', summary: '', roleTags: [], ports: []
      }
    })
    expect(next.nodes.has('n1')).toBe(true)
  })

  it('applies UpdateNode command to title/summary/roleTags', () => {
    const doc = runCommand(createEmptyDocument('d1'), {
      type: 'AddNode', payload: {
        id: 'n1', type: 'activity', x: 0, y: 0, width: 220, height: 96,
        title: 'Old', summary: 's', roleTags: [], ports: []
      }
    })
    const next = runCommand(doc, {
      type: 'UpdateNode',
      payload: { id: 'n1', patch: { title: 'New', summary: 'Updated', roleTags: ['PM'] } }
    })
    expect(next.nodes.get('n1')?.title).toBe('New')
    expect(next.nodes.get('n1')?.summary).toBe('Updated')
    expect(next.nodes.get('n1')?.roleTags).toEqual(['PM'])
  })
})
```

- [ ] **Step 2: Run tests to verify RED**

Run: `npm test -- src/features/canvas/engine/commands.test.ts`
Expected: FAIL (missing commands module).

- [ ] **Step 3: Implement minimal command dispatcher**

```ts
// src/features/canvas/engine/commands.ts
import type { GraphDocument, GraphCommand } from '../canvasTypes'
import { addNode, addEdge } from './graphDocument'

export function runCommand(doc: GraphDocument, command: GraphCommand): GraphDocument {
  switch (command.type) {
    case 'AddNode':
      return addNode(doc, command.payload)
    case 'AddEdge':
      return addEdge(doc, command.payload)
    case 'UpdateNode': {
      const node = doc.nodes.get(command.payload.id)
      if (!node) return doc
      const nodes = new Map(doc.nodes)
      nodes.set(node.id, { ...node, ...command.payload.patch })
      return { ...doc, nodes, meta: { ...doc.meta, dirty: true, version: doc.meta.version + 1 } }
    }
    default:
      return doc
  }
}
```

- [ ] **Step 4: Run tests to verify GREEN**

Run: `npm test -- src/features/canvas/engine/commands.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/canvas/engine/commands.ts src/features/canvas/engine/commands.test.ts
git commit -m "feat: add graph command dispatcher"
```

---

## Task 3: Add history engine (undo/redo)

**Files:**
- Create: `src/features/canvas/engine/history.ts`
- Test: `src/features/canvas/engine/history.test.ts`

- [ ] **Step 1: Write failing undo/redo tests**

```ts
import { describe, expect, it } from 'vitest'
import { createHistoryState, pushHistory, undo, redo } from './history'

describe('history', () => {
  it('pushes snapshot and supports undo/redo', () => {
    const h0 = createHistoryState('d1')
    const h1 = pushHistory(h0, { marker: 'state-1' })
    const h2 = pushHistory(h1, { marker: 'state-2' })

    const u1 = undo(h2)
    expect(u1.present).toEqual({ marker: 'state-1' })

    const r1 = redo(u1)
    expect(r1.present).toEqual({ marker: 'state-2' })
  })
})
```

- [ ] **Step 2: Run tests to verify RED**

Run: `npm test -- src/features/canvas/engine/history.test.ts`
Expected: FAIL (missing module/functions).

- [ ] **Step 3: Implement minimal history state**

```ts
// src/features/canvas/engine/history.ts
export type HistoryState<T> = { past: T[]; present: T; future: T[] }

export function createHistoryState<T>(initial: T): HistoryState<T> {
  return { past: [], present: initial, future: [] }
}

export function pushHistory<T>(state: HistoryState<T>, next: T): HistoryState<T> {
  return { past: [...state.past, state.present], present: next, future: [] }
}

export function undo<T>(state: HistoryState<T>): HistoryState<T> {
  if (!state.past.length) return state
  const prev = state.past[state.past.length - 1]
  return {
    past: state.past.slice(0, -1),
    present: prev,
    future: [state.present, ...state.future],
  }
}

export function redo<T>(state: HistoryState<T>): HistoryState<T> {
  if (!state.future.length) return state
  const next = state.future[0]
  return {
    past: [...state.past, state.present],
    present: next,
    future: state.future.slice(1),
  }
}
```

- [ ] **Step 4: Run tests to verify GREEN**

Run: `npm test -- src/features/canvas/engine/history.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/canvas/engine/history.ts src/features/canvas/engine/history.test.ts
git commit -m "feat: add undo redo history state"
```

---

## Task 4: Implement keyboard mapping engine

**Files:**
- Create: `src/features/canvas/engine/keyboard.ts`
- Test: `src/features/canvas/engine/keyboard.test.ts`

- [ ] **Step 1: Write failing keyboard map tests**

```ts
import { describe, expect, it } from 'vitest'
import { mapKeyToAction } from './keyboard'

describe('keyboard map', () => {
  it('maps creation shortcuts', () => {
    expect(mapKeyToAction({ key: 'a', metaKey: false, ctrlKey: false, shiftKey: false })).toBe('tool-activity')
    expect(mapKeyToAction({ key: 'd', metaKey: false, ctrlKey: false, shiftKey: false })).toBe('tool-decision')
    expect(mapKeyToAction({ key: 'l', metaKey: false, ctrlKey: false, shiftKey: false })).toBe('auto-layout')
  })

  it('maps undo redo shortcuts', () => {
    expect(mapKeyToAction({ key: 'z', metaKey: true, ctrlKey: false, shiftKey: false })).toBe('undo')
    expect(mapKeyToAction({ key: 'z', metaKey: true, ctrlKey: false, shiftKey: true })).toBe('redo')
  })
})
```

- [ ] **Step 2: Run tests to verify RED**

Run: `npm test -- src/features/canvas/engine/keyboard.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement keyboard mapper**

```ts
// src/features/canvas/engine/keyboard.ts
export type KeyEventLike = {
  key: string
  metaKey: boolean
  ctrlKey: boolean
  shiftKey: boolean
}

export type CanvasAction =
  | 'tool-activity'
  | 'tool-decision'
  | 'tool-start-end'
  | 'tool-connector'
  | 'tool-select'
  | 'auto-layout'
  | 'undo'
  | 'redo'
  | 'delete'
  | null

export function mapKeyToAction(e: KeyEventLike): CanvasAction {
  const key = e.key.toLowerCase()
  const mod = e.metaKey || e.ctrlKey

  if (mod && key === 'z' && e.shiftKey) return 'redo'
  if (mod && key === 'z') return 'undo'
  if (!mod && key === 'a') return 'tool-activity'
  if (!mod && key === 'd') return 'tool-decision'
  if (!mod && key === 's') return 'tool-start-end'
  if (!mod && key === 'c') return 'tool-connector'
  if (!mod && key === 'v') return 'tool-select'
  if (!mod && key === 'l') return 'auto-layout'
  if (!mod && (key === 'delete' || key === 'backspace')) return 'delete'

  return null
}
```

- [ ] **Step 4: Run tests to verify GREEN**

Run: `npm test -- src/features/canvas/engine/keyboard.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/canvas/engine/keyboard.ts src/features/canvas/engine/keyboard.test.ts
git commit -m "feat: add canvas keyboard action mapping"
```

---

## Task 5: Refactor useCanvasState to use graph engine + history + keyboard

**Files:**
- Modify: `src/features/canvas/useCanvasState.ts`
- Test: `src/features/canvas/useCanvasState.test.ts`

- [ ] **Step 1: Write failing hook tests for tool switching and command behavior**

```ts
import { renderHook, act } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useCanvasState } from './useCanvasState'

describe('useCanvasState', () => {
  it('adds activity node from toolbar action', () => {
    const { result } = renderHook(() => useCanvasState())
    act(() => result.current.addActivity())
    expect(result.current.nodes.some((n) => n.data.kind === 'activity')).toBe(true)
  })

  it('undoes and redoes node creation', () => {
    const { result } = renderHook(() => useCanvasState())
    act(() => result.current.addActivity())
    const count = result.current.nodes.length

    act(() => result.current.undo())
    expect(result.current.nodes.length).toBeLessThan(count)

    act(() => result.current.redo())
    expect(result.current.nodes.length).toBe(count)
  })
})
```

- [ ] **Step 2: Run tests to verify RED**

Run: `npm test -- src/features/canvas/useCanvasState.test.ts`
Expected: FAIL on behavior mismatch.

- [ ] **Step 3: Implement hook changes minimally**

```ts
// Key implementation expectations (apply in existing file)
// - store GraphDocument as source of truth
// - derive ReactFlow nodes/edges via adapter
// - route add/update/delete through runCommand + history
// - expose currentTool and setCurrentTool
// - expose handleKeyAction(action)
// - keep existing API shape where possible to reduce breakage
```

- [ ] **Step 4: Run tests to verify GREEN**

Run: `npm test -- src/features/canvas/useCanvasState.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/canvas/useCanvasState.ts src/features/canvas/useCanvasState.test.ts
git commit -m "refactor: route canvas state through graph engine and history"
```

---

## Task 6: Rebuild ProcessCanvas around Pixi stage + React overlays

**Files:**
- Create: `src/features/canvas/render/pixiStage.ts`
- Create: `src/features/canvas/render/layers.ts`
- Create: `src/features/canvas/render/drawNodes.ts`
- Create: `src/features/canvas/render/drawEdges.ts`
- Create: `src/features/canvas/render/viewportCulling.ts`
- Modify: `src/features/canvas/ProcessCanvas.tsx`
- Test: `src/features/canvas/ProcessCanvas.test.tsx`

- [ ] **Step 1: Write failing canvas render shell test**

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ProcessCanvas } from './ProcessCanvas'

describe('ProcessCanvas', () => {
  it('renders toolbar and properties region entry points', () => {
    render(<ProcessCanvas />)
    expect(screen.getByRole('toolbar', { name: /canvas tools/i })).toBeInTheDocument()
    expect(screen.getByText('Flowent')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests to verify RED**

Run: `npm test -- src/features/canvas/ProcessCanvas.test.tsx`
Expected: FAIL if shell changes missing.

- [ ] **Step 3: Implement Pixi stage bootstrap and wire ProcessCanvas**

```ts
// src/features/canvas/render/pixiStage.ts (minimal)
import { Application, Container } from 'pixi.js'

export type PixiStage = {
  app: Application
  root: Container
  destroy: () => void
}

export async function createPixiStage(host: HTMLDivElement): Promise<PixiStage> {
  const app = new Application()
  await app.init({
    resizeTo: host,
    background: '#fafafa',
    antialias: true,
  })
  host.appendChild(app.canvas)

  const root = new Container()
  app.stage.addChild(root)

  return {
    app,
    root,
    destroy: () => {
      app.destroy(true)
      if (app.canvas.parentElement === host) host.removeChild(app.canvas)
    },
  }
}
```

```tsx
// ProcessCanvas expectations:
// - mount a div ref as pixi host
// - initialize stage in useEffect
// - keep Toolbar + PropertiesPanel overlays in React layer
```

- [ ] **Step 4: Run tests to verify GREEN**

Run: `npm test -- src/features/canvas/ProcessCanvas.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/canvas/render src/features/canvas/ProcessCanvas.tsx src/features/canvas/ProcessCanvas.test.tsx
git commit -m "feat: mount pixi canvas stage with react overlay shell"
```

---

## Task 7: Implement double-click floating editor behavior

**Files:**
- Modify: `src/features/canvas/PropertiesPanel.tsx`
- Modify: `src/features/canvas/ProcessCanvas.tsx`
- Test: `src/features/canvas/PropertiesPanel.test.tsx`

- [ ] **Step 1: Write failing editor interaction test**

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { ProcessCanvas } from './ProcessCanvas'

describe('double-click editing', () => {
  it('opens properties panel on node double-click', async () => {
    const user = userEvent.setup()
    render(<ProcessCanvas />)

    const activityButton = screen.getByRole('button', { name: /activity/i })
    await user.click(activityButton)

    // test helper target should expose a rendered node label in DOM overlay
    const nodeLabel = await screen.findByText('New activity')
    await user.dblClick(nodeLabel)

    expect(screen.getByRole('complementary', { name: /properties/i })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests to verify RED**

Run: `npm test -- src/features/canvas/PropertiesPanel.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement minimal double-click open/close logic**

```tsx
// ProcessCanvas expectations:
// - maintain selected node id
// - on node double-click, set editor target
// - PropertiesPanel onClose clears editor target
```

- [ ] **Step 4: Run tests to verify GREEN**

Run: `npm test -- src/features/canvas/PropertiesPanel.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/canvas/ProcessCanvas.tsx src/features/canvas/PropertiesPanel.tsx src/features/canvas/PropertiesPanel.test.tsx
git commit -m "feat: enable double click floating node editor"
```

---

## Task 8: Implement marquee selection + multi-drag

**Files:**
- Create: `src/features/canvas/engine/selection.ts`
- Test: `src/features/canvas/engine/selection.test.ts`
- Modify: `src/features/canvas/useCanvasState.ts`
- Modify: `src/features/canvas/ProcessCanvas.tsx`

- [ ] **Step 1: Write failing selection engine tests**

```ts
import { describe, expect, it } from 'vitest'
import { selectByMarquee, moveSelection } from './selection'

describe('selection', () => {
  it('selects all nodes fully inside marquee box', () => {
    const selected = selectByMarquee(
      [
        { id: 'n1', x: 10, y: 10, width: 100, height: 80 },
        { id: 'n2', x: 300, y: 300, width: 100, height: 80 },
      ],
      { x1: 0, y1: 0, x2: 200, y2: 200 }
    )
    expect(selected).toEqual(new Set(['n1']))
  })

  it('moves selected node positions by delta', () => {
    const moved = moveSelection(
      [{ id: 'n1', x: 10, y: 10 }, { id: 'n2', x: 40, y: 40 }],
      new Set(['n1', 'n2']),
      { dx: 5, dy: -3 }
    )
    expect(moved.find((n) => n.id === 'n1')).toMatchObject({ x: 15, y: 7 })
  })
})
```

- [ ] **Step 2: Run tests to verify RED**

Run: `npm test -- src/features/canvas/engine/selection.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement selection helpers and wire pointer drag**

```ts
// src/features/canvas/engine/selection.ts minimal pure helpers
export function selectByMarquee(...) { ... }
export function moveSelection(...) { ... }
```

```tsx
// ProcessCanvas expectations:
// - track marquee drag rectangle in overlay layer
// - on mouse up compute selection
// - dragging selected group updates all selected nodes
```

- [ ] **Step 4: Run tests to verify GREEN**

Run: `npm test -- src/features/canvas/engine/selection.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/canvas/engine/selection.ts src/features/canvas/engine/selection.test.ts src/features/canvas/useCanvasState.ts src/features/canvas/ProcessCanvas.tsx
git commit -m "feat: add marquee selection and multi drag"
```

---

## Task 9: Implement Auto Layout adapter and trigger

**Files:**
- Create: `src/features/canvas/layout/autoLayout.ts`
- Create: `src/features/canvas/layout/layoutWorker.ts`
- Modify: `src/features/canvas/useCanvasState.ts`
- Test: `src/features/canvas/layout/autoLayout.test.ts`

- [ ] **Step 1: Write failing layout adapter tests**

```ts
import { describe, expect, it } from 'vitest'
import { layoutGraph } from './autoLayout'

describe('auto layout', () => {
  it('returns nodes with updated coordinates preserving ids', async () => {
    const result = await layoutGraph({
      nodes: [
        { id: 'start', type: 'start', x: 0, y: 0 },
        { id: 'a1', type: 'activity', x: 0, y: 0 },
      ],
      edges: [{ id: 'e1', sourceNodeId: 'start', targetNodeId: 'a1' }],
    })

    expect(result.nodes.map((n) => n.id)).toEqual(['start', 'a1'])
    expect(result.nodes[0].x).not.toBeUndefined()
    expect(result.nodes[0].y).not.toBeUndefined()
  })
})
```

- [ ] **Step 2: Run tests to verify RED**

Run: `npm test -- src/features/canvas/layout/autoLayout.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement minimal async layout adapter**

```ts
// autoLayout.ts
export async function layoutGraph(graph: LayoutInput): Promise<LayoutOutput> {
  // phase-1 deterministic layered fallback (YAGNI):
  // assign y by depth, x by index in level
  // preserve ids and edge relationships
}
```

- [ ] **Step 4: Wire Toolbar L action to layoutGraph in useCanvasState**

Expected behavior:
- clicking Auto Layout or pressing L runs async layout
- UI remains responsive
- node positions update in one commit

- [ ] **Step 5: Run tests to verify GREEN**

Run:
- `npm test -- src/features/canvas/layout/autoLayout.test.ts`
- `npm test -- src/features/canvas/useCanvasState.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/canvas/layout src/features/canvas/useCanvasState.ts src/features/canvas/Toolbar.tsx
git commit -m "feat: add async auto layout command"
```

---

## Task 10: Replace legacy app routes/tests and enforce single-screen canvas entry

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`
- Delete/replace old flow tests that no longer apply:
  - `src/features/role-navigation/*.test.tsx`
  - `src/features/process-views/*.test.tsx`
  - `src/features/scenario-generation/*.test.tsx`
  - `src/features/process-map/ProcessMapWorkspace.test.tsx` (if no longer in UI path)

- [ ] **Step 1: Write failing top-level app test for single-screen modeler**

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('App', () => {
  it('renders single-screen visual modeler', () => {
    render(<App />)
    expect(screen.getByRole('toolbar', { name: /canvas tools/i })).toBeInTheDocument()
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify RED**

Run: `npm test -- src/App.test.tsx`
Expected: FAIL if old assumptions remain.

- [ ] **Step 3: Implement minimal app-shell replacement and remove dead test paths**

- `src/App.tsx` should render only canvas modeler
- remove outdated tests tied to removed flows

- [ ] **Step 4: Run tests to verify GREEN**

Run: `npm test`
Expected: PASS with new canonical test set.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/App.test.tsx src/features
git commit -m "refactor: replace tabbed MVP shell with single canvas modeler"
```

---

## Task 11: Update styling for Apple-minimal consistency and accessibility

**Files:**
- Modify: `src/styles.css`

- [ ] **Step 1: Write/adjust style assertions in component tests**

Add assertions to existing canvas tests:
- selected node class applied
- toolbar buttons visible and labeled
- properties panel opens/closes and is keyboard reachable

- [ ] **Step 2: Run tests to verify RED (if assertions new)**

Run: `npm test -- src/features/canvas`
Expected: FAIL before style/accessibility alignment.

- [ ] **Step 3: Implement minimal style + a11y fixes**

Required outcomes:
- sufficient contrast for text and focus states
- motion respects reduced-motion media query
- keyboard focus ring visible on actionable controls

- [ ] **Step 4: Run tests to verify GREEN**

Run: `npm test -- src/features/canvas`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/styles.css src/features/canvas
git commit -m "style: align canvas modeler with apple minimalist system"
```

---

## Task 12: Add end-to-end canvas modeling journey

**Files:**
- Create: `e2e/canvas-modeling.spec.ts`
- Modify/remove old E2E specs that validate removed flows

- [ ] **Step 1: Write failing E2E scenario**

```ts
import { test, expect } from '@playwright/test'

test('user can model a process quickly on canvas', async ({ page }) => {
  await page.goto('/')

  await page.getByRole('button', { name: /activity/i }).click()
  await page.mouse.click(500, 220)

  await page.getByRole('button', { name: /decision/i }).click()
  await page.mouse.click(760, 320)

  await expect(page.getByText('New activity')).toBeVisible()
  await expect(page.getByText('New decision')).toBeVisible()

  await page.keyboard.press('l')

  // Open editor by double-click
  const activityLabel = page.getByText('New activity').first()
  await activityLabel.dblclick()
  await expect(page.getByRole('complementary', { name: /properties/i })).toBeVisible()
})
```

- [ ] **Step 2: Run E2E to verify RED**

Run: `npm run test:e2e -- e2e/canvas-modeling.spec.ts`
Expected: FAIL until interactions are complete.

- [ ] **Step 3: Implement missing interaction glue for E2E pass**

- ensure toolbar buttons have stable accessible names
- ensure newly created nodes have visible labels
- ensure double-click target opens panel reliably

- [ ] **Step 4: Run E2E to verify GREEN**

Run: `npm run test:e2e -- e2e/canvas-modeling.spec.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add e2e/canvas-modeling.spec.ts src/features/canvas
git commit -m "test: add e2e canvas modeling workflow"
```

---

## Task 13: Final validation and docs alignment

**Files:**
- Modify: `.claude/prds/flowent-mvp.prd.md`
- Modify: `docs/superpowers/specs/2026-05-30-visual-canvas-redesign-design.md` (only if implementation decisions changed)
- Modify: `CLAUDE.md` (if project direction text now diverges from implemented entry flow)

- [ ] **Step 1: Run full validation suite**

Run:
- `npm run lint`
- `npm test`
- `npm run build`
- `npm run test:e2e`

Expected: all pass.

- [ ] **Step 2: Reconcile docs with implementation**

Checklist:
- app is single-screen modeler
- old tabbed flow removed from user-facing path
- keyboard shortcuts list matches implemented behavior
- auto layout behavior documented as async and non-blocking

- [ ] **Step 3: Commit final validation and doc sync**

```bash
git add .claude/prds/flowent-mvp.prd.md docs/superpowers/specs/2026-05-30-visual-canvas-redesign-design.md CLAUDE.md
git commit -m "docs: align product docs with canvas-first redesign"
```

---

## Verification Commands (full project)

```bash
npm run lint
npm test
npm run build
npm run test:e2e
```

Expected final state:
- zero lint errors
- all unit/component tests passing
- production build passing
- E2E modeling journey passing

---

## Risk Controls

1. **Large-graph performance regressions**
   - Add visible-node culling before adding visual polish details.
2. **Interaction drift from spec**
   - Keep keyboard map in one module and unit-test it directly.
3. **Legacy test noise**
   - Remove or rewrite obsolete tests early (Task 10), not at the end.
4. **Overbuilding too soon**
   - Worker layout and deep performance optimization should stay behind stable adapter interfaces first; avoid speculative micro-optimizations before baseline is measured.

---

## Spec Coverage Self-Check

- Single-screen IA → covered by Tasks 6, 10.
- Toolbar-first node creation → covered by Tasks 5, 6, 12.
- Free edge connection → covered by Tasks 2, 5.
- Double-click floating editor → covered by Task 7.
- Keyboard shortcuts → covered by Tasks 4, 5.
- Box select + multi-drag → covered by Task 8.
- Auto Layout async → covered by Task 9.
- Apple-minimal visual consistency → covered by Task 11.
- Large-graph readiness architecture (culling/layering) → covered by Task 6 + risk controls.
- Full replacement of legacy flow UI → covered by Task 10.

No uncovered spec requirements remain.

---

Plan complete and saved to `docs/superpowers/plans/2026-05-30-visual-canvas-redesign.md`. Two execution options:

1. Subagent-Driven (recommended) - I dispatch a fresh subagent per task, review between tasks, fast iteration

2. Inline Execution - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
