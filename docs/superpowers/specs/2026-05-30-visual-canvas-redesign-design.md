# Visual Canvas Redesign Design

**Date**: 2026-05-30  
**Project**: Flowent  
**Status**: Draft (approved in conversation; pending final user review)

## 1. Problem and Direction Shift

Flowent MVP was completed with 7 milestones, but the interaction model became too text-heavy and workflow-heavy. The product currently emphasizes forms, multi-tab state, and lifecycle workflows before making modeling feel fast.

The new direction is to prioritize **rapid visual process modeling**:

- build process structure quickly on a canvas
- render process flow immediately
- keep interface minimal, focused, and calm
- use Apple-inspired minimalist design language

## 2. Confirmed Product Decisions

These are fixed by user decisions:

1. Core speed target: **structure speed** (minimum clicks to place and connect nodes)
2. Primary interaction: **toolbar selects type, canvas click places node**
3. Initial node set: **Activity + Decision + Start/End**
4. Edge behavior (v1): **free connections**
5. Theme default: **light minimalist**
6. Property editing: **double-click node opens floating editor**
7. Migration strategy: **fully replace old MVP flow UI** (no fallback path in main UI)
8. Node density default: **title + summary + role tags**
9. Keyboard support in v1: **required**
10. Box selection + multi-drag in v1: **required**
11. Auto Layout in v1: **required**
12. Scale target: **large graph support in first release**
13. Rendering stack: **Canvas/WebGL**
14. Engine strategy: **mature rendering engine with custom editor layer**
15. Chosen technical approach: **PixiJS + custom graph editing layer**

## 3. Product Scope (v1)

### In Scope

- single-screen visual modeling experience
- toolbar-driven node creation
- free edge connection
- selection, box selection, multi-drag
- keyboard shortcuts for creation and editing commands
- double-click floating node editor
- Auto Layout command
- undo/redo
- Apple-style minimalist visual system

### Out of Scope

- existing tabbed MVP flow as user-facing path
- form-first workflow UI
- scenario-generation-centric entry flow
- collaborative consensus workflow as primary interface
- persistence/export/import
- real-time multi-user collaboration

## 4. Information Architecture

Single screen layout:

1. **Top Bar**
   - brand and file state indicator
   - zoom/fit actions
2. **Floating Toolbar**
   - Start/End, Activity, Decision, Connector, Auto Layout
3. **Infinite Canvas**
   - main modeling surface
4. **Floating Properties Editor**
   - appears on node double-click
5. **Bottom Status Strip**
   - node/edge counts, mode, FPS/perf hint, key hints

No tab navigation in main flow.

## 5. Interaction Model

### Creation

- choose tool from toolbar
- click canvas to place entity
- entity appears immediately with editable defaults

### Connection

- choose connector tool or drag from port
- drag to target node
- free connection allowed in v1

### Selection and Movement

- click node to select
- drag marquee for multi-select
- drag selected group together

### Editing

- double-click node opens floating editor
- edit title, summary, role tags
- close editor by click-outside or explicit close

### Command and Control

- delete removes current selection
- undo/redo for all structural edits
- Auto Layout triggers layered graph arrangement

## 6. Keyboard Shortcuts (v1)

- `A`: Activity tool
- `D`: Decision tool
- `S`: Start/End tool cycle
- `C`: Connector tool
- `V`: Select tool
- `Cmd/Ctrl + A`: select all
- `Delete/Backspace`: delete selection
- `Space + Drag`: pan
- `+` / `-` / `0`: zoom in/out/reset
- `L`: Auto Layout
- `Cmd/Ctrl + Z`: undo
- `Cmd/Ctrl + Shift + Z` or `Ctrl + Y`: redo

## 7. Visual Language (Apple Minimalist)

### Palette

- near-white canvas background
- charcoal primary text
- grayscale surfaces and borders
- one restrained accent blue

### Typography

- SF Pro / Inter stack
- strong title hierarchy
- compact, low-noise labels

### Components

- rounded cards (12–16px)
- subtle shadows
- restrained focus rings
- clean, sparse iconography

### Motion

- 150–220ms ease-out transitions
- subtle hover/selection animation
- no decorative motion overload

## 8. Technical Architecture

## 8.1 Layered System

1. **Rendering Core (PixiJS/WebGL)**
   - stage, camera, render layers
   - draw-focused only
2. **Graph Engine (custom)**
   - nodes/edges/ports/selection
   - commands for add/move/connect/delete/edit
3. **Layout Engine (ELK.js or Dagre)**
   - Auto Layout and coordinate output
4. **UI Shell (React)**
   - toolbar, editor, status controls

## 8.2 Data Model

`GraphDocument`:
- nodes: Map<NodeId, NodeModel>
- edges: Map<EdgeId, EdgeModel>
- selection: Set<EntityId>
- viewport: {x, y, zoom}
- meta: {dirty, version}

`NodeModel`:
- id, type, x, y, width, height
- title, summary, roleTags
- ports

`EdgeModel`:
- id, sourceNodeId/sourcePortId
- targetNodeId/targetPortId
- label

## 8.3 Rendering Pipeline

Layers:
- grid layer
- edge layer
- node layer
- overlay layer (marquee, handles, previews)

Optimizations:
- viewport culling
- dirty-region update strategy
- text/object caching
- minimal reflow between frames

## 8.4 Performance Strategy

v1 baseline targets:
- 500 nodes / 800 edges: smooth interaction
- 1000 nodes / 1500 edges: fully operable
- Auto Layout is asynchronous and non-blocking

Techniques:
- progressive layout batching
- worker-based layout execution
- object pools for repeated visuals
- avoid full graph redraws on local edits

## 9. Migration and Compatibility

- main app UI moves to canvas-first modeler
- old MVP interaction paths removed from primary navigation
- internal mapping adapters retained where needed:
  - ProcessMap -> GraphDocument
  - GraphDocument -> ProcessMap

This preserves future optional re-linking to governance workflows without exposing old UX now.

## 10. Testing and Acceptance

## 10.1 Unit Testing

Cover:
- graph commands
- selection/multi-selection logic
- connection creation/deletion
- undo/redo correctness
- keyboard command dispatch

## 10.2 Component Testing

Cover:
- toolbar tool switching
- double-click editor behavior
- delete behavior
- Auto Layout trigger feedback
- selected/hover visual classes

## 10.3 E2E Testing

`e2e/canvas-modeling.spec.ts` should cover:
1. place Start, Activities, Decision, End
2. connect nodes
3. marquee select + multi-drag
4. edit node via double-click editor
5. run Auto Layout
6. verify undo/redo reversibility

## 10.4 Performance Validation

Must demonstrate:
- responsive interaction at medium/large graph size
- non-blocking layout run
- no catastrophic frame drops during normal manipulation

## 10.5 Done Criteria

- all required interactions implemented
- visual style matches minimalist direction
- keyboard flow and mouse flow both usable
- lint/test/build/e2e all pass
- large graph baseline met

## 11. Risks and Mitigations

1. **Complexity risk** (custom editor layer on top of PixiJS)
   - mitigate with strict layer boundaries and command architecture
2. **Performance risk** (large graph requirement in v1)
   - mitigate with culling, caching, worker layout, staged profiling
3. **Regression risk** (full replacement of old UX)
   - mitigate with focused end-to-end flows and adapters for future bridge-back
4. **Over-polish risk** (visual polish delaying core speed)
   - enforce "speed first, polish second" milestone gates

## 12. Rollout Shape

- Phase 1: canvas core + node/edge placement + selection
- Phase 2: editing, keyboard, undo/redo
- Phase 3: Auto Layout + performance hardening
- Phase 4: visual polish + acceptance test completion

This sequence ensures fast-modeling core lands early, then scales and polishes.
