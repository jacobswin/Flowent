# Plan: Visual Canvas Redesign

**Source**: User feedback — MVP too text-heavy, needs Stages-like fast visual modeling with Apple minimalist design.  
**Complexity**: Large  
**Status**: In progress

## Product Direction Change

Current MVP has text-heavy forms, multiple tab panels, and complex consensus workflows. User wants:

1. **Visual canvas modeling** — drag/drop/click on a canvas to create activities, decisions, handoffs, rendered as a connected flow diagram
2. **Apple minimalist design** — refined animations, restrained colors (black/white/gray + minimal accent), clear hierarchy, low info density
3. **Fast modeling** — like Stages, quickly build and render process maps visually

## Design Direction

### Visual Style
- **Palette**: Near-white background (`#fafafa`), charcoal text (`#1d1d1f`), one accent (blue `#0071e3`)
- **Typography**: SF Pro / Inter, large titles (48px+), small body (14px), generous line height
- **Surfaces**: Subtle depth with light shadows, 12-16px radius, frosted glass panels
- **Motion**: 200-300ms ease-out transitions, spring physics for drag, subtle scale on hover
- **Density**: One thing at a time, large whitespace, no crowded panels

### Canvas Architecture
- **Library**: React Flow (@xyflow/react) — mature, well-maintained, handles nodes/edges/viewport
- **Node types**: Activity (rectangular card), Decision (diamond/rhombus), Start/End (pill)
- **Edge types**: Handoff connections (animated bezier curves)
- **Interactions**: Click canvas to add, drag to move, connect by dragging handles, click to select/edit

### Layout
```
┌─────────────────────────────────────────────┐
│  [Flowent]              [toolbar icons]      │ ← minimal top bar
├─────────────────────────────────────────────┤
│                                             │
│         ┌─────────┐                         │
│         │ Start   │                         │
│         └────┬────┘                         │
│              │                              │
│         ┌────▼────┐    ┌─────────┐         │
│         │Activity │───▶│Decision │         │
│         └─────────┘    └────┬────┘         │
│                             │              │
│                        ┌────▼────┐         │
│                        │ Activity │         │
│                        └─────────┘         │
│                                             │
│  ┌─────────────────┐                        │
│  │ Properties panel │ ← slide-in sidebar   │
│  │ (when selected)  │                       │
│  └─────────────────┘                        │
└─────────────────────────────────────────────┘
```

## Files to Change

| File | Action | Why |
|---|---|---|
| `package.json` | UPDATE | Add `@xyflow/react` |
| `src/App.tsx` | REWRITE | Single-screen canvas app, no tabs |
| `src/styles.css` | REWRITE | Apple minimalist design system |
| `src/features/canvas/ProcessCanvas.tsx` | CREATE | Main React Flow canvas component |
| `src/features/canvas/ProcessCanvas.test.tsx` | CREATE | Canvas component tests |
| `src/features/canvas/nodes/ActivityNode.tsx` | CREATE | Activity node component |
| `src/features/canvas/nodes/DecisionNode.tsx` | CREATE | Decision node component |
| `src/features/canvas/nodes/StartEndNode.tsx` | CREATE | Start/End node component |
| `src/features/canvas/edges/HandoffEdge.tsx` | CREATE | Handoff edge component |
| `src/features/canvas/Toolbar.tsx` | CREATE | Floating toolbar for adding elements |
| `src/features/canvas/Toolbar.test.tsx` | CREATE | Toolbar tests |
| `src/features/canvas/PropertiesPanel.tsx` | CREATE | Slide-in properties panel for selected element |
| `src/features/canvas/PropertiesPanel.test.tsx` | CREATE | Properties panel tests |
| `src/features/canvas/useCanvasState.ts` | CREATE | Hook managing canvas nodes/edges state |
| `src/features/canvas/useCanvasState.test.ts` | CREATE | State hook tests |
| `src/features/canvas/canvasTypes.ts` | CREATE | Canvas-specific types mapping to ProcessMap |
| `e2e/canvas-modeling.spec.ts` | CREATE | E2E: add nodes, connect, edit properties |

## Tasks

### Task 1: Install React Flow and set up canvas
- Install `@xyflow/react`
- Create basic ProcessCanvas with React Flow provider
- Render empty canvas with Apple-style background

### Task 2: Define canvas node/edge types
- Map ProcessMap concepts to React Flow nodes/edges
- Activity → custom node, Decision → custom node, Handoff → custom edge
- Create canvasTypes.ts with typed node data

### Task 3: Build custom node components
- ActivityNode: clean card with title, subtle shadow, hover scale
- DecisionNode: diamond shape or styled card with icon
- StartEndNode: pill shape for start/end markers
- All nodes: Apple minimalist styling, smooth transitions

### Task 4: Build custom edge components
- HandoffEdge: animated bezier with label
- Clean connection handles, subtle hover states

### Task 5: Build toolbar
- Floating toolbar: Add Activity, Add Decision, Add Start/End
- Minimal icon buttons, frosted glass background
- Click to add node at center of viewport

### Task 6: Build properties panel
- Slide-in panel when node/edge selected
- Inline edit: title, summary, responsibilities
- Smooth slide animation, frosted glass

### Task 7: Wire canvas state to ProcessMap model
- useCanvasState hook: sync nodes/edges with ProcessMap
- Source tracking preserved
- Readiness check works

### Task 8: Add scenario generation integration
- After LLM generation, render the draft as a canvas
- Nodes positioned by layout algorithm
- User can then rearrange visually

### Task 9: E2E tests and validation
- Playwright: add activity, connect to decision, edit title
- Full validation: lint, test, build, e2e

### Task 10: Polish and review
- Smooth animations
- Responsive layout
- Accessibility (keyboard nav for canvas)
- Code review

## Not Included
- Persistence
- Real-time collaboration
- Complex layout algorithms (auto-layout)
- Export/import
- Undo/redo (defer to later)
