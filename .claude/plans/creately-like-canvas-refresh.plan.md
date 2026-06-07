# Creately-like Professional Canvas Refresh Plan

Approved: 2026-06-04

## Goal

Upgrade Flowent's canvas from a plain white prototype surface into a professional process-diagram workspace inspired by Creately-like diagramming tools while preserving Flowent's process-map identity.

The first implementation pass focuses on:

1. Professional canvas surface polish.
2. More mature process-node visuals.
3. Smart orthogonal connectors rendered in Pixi.
4. Connector drag preview that matches final edge routing.
5. Better diagram-editor toolbar/status treatment.
6. Basic creation/layout efficiency improvements.

## Scope

### Include

- Replace DOM canvas Bezier edge rendering with Pixi `edgeLayer` rendering.
- Add pure TypeScript routing helpers for port anchors and orthogonal routes.
- Preserve source/target port IDs end-to-end.
- Normalize decision nodes to stable `in` / `out` ports for this phase.
- Render edge arrows along the final orthogonal segment.
- Render drag-to-connect previews as orthogonal routes.
- Improve canvas background, grid, toolbar, status bar, properties panel, and node styling.
- Adjust auto-layout spacing for cleaner orthogonal connectors.
- Add unit tests for routing and port preservation.
- Add/adjust E2E coverage for edge creation and orthogonal routes where practical.

### Defer

- Edge selection and hit testing.
- Edge label editing.
- Manual bend handles.
- Advanced crossing minimization and full obstacle routing.
- Collaboration, comments, and multi-user cursors.
- Full template gallery.

## Implementation Phases

### Phase A — Canvas polish

- Make the canvas surface feel intentional instead of a blank white board.
- Use a subtle professional background with grid/dot atmosphere.
- Strengthen toolbar, status bar, panel, and empty-state hierarchy.
- Improve node fill/stroke/shadow/role-chip treatment.

### Phase B — Smart orthogonal connectors

- Add `routing/ports.ts` for shared port-anchor resolution.
- Add `routing/orthogonalRouter.ts` for deterministic orthogonal route points.
- Add `render/drawEdges.ts` for Pixi edge rendering.
- Remove DOM edge canvas rendering from `ProcessCanvas.tsx`.
- Draw committed edges in `layers.edgeLayer`.
- Draw connector preview in `layers.overlayLayer` with the same route logic.

### Phase C — Creation efficiency and process expression

- Tune auto-layout spacing.
- Make new-node defaults less overlapping where possible.
- Surface connector mode visibly in the toolbar.
- Keep role tags and decision shape visually meaningful.

### Phase D — Verification and review

- Run unit tests, lint/build, and targeted E2E checks.
- Run code review agents after code changes.
- Fix critical/high issues and report remaining follow-ups.

## Acceptance Criteria

- Opening the app no longer feels like a blank white canvas prototype.
- Edges render in Pixi below nodes and above the grid.
- All committed edge routes are orthogonal.
- Drag-to-connect preview is orthogonal.
- Edge arrowheads align with the final segment.
- Port IDs are preserved through state conversions.
- Decision nodes use consistent `in` / `out` ports in this phase.
- Moving nodes automatically updates connected routes.
- Toolbar/status/node styling looks cohesive and professional.
- Unit tests cover router invariants and port preservation.
- Targeted E2E edge creation remains green or known issues are reported.
