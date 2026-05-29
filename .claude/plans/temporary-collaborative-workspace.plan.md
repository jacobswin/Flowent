# Plan: Temporary Collaborative Workspace

**Source PRD**: `.claude/prds/flowent-mvp.prd.md`  
**Selected Milestone**: Temporary collaborative workspace  
**Complexity**: Large  
**Status**: Complete — validated with lint, 82 unit tests, production build, 4 Playwright E2E tests, TypeScript review, accessibility review, security review, and code-quality review on 2026-05-29.

## Summary

Add a temporary collaborative workspace where a team can refine a generated draft map or create a new map while discussing the work. The workspace provides structured editing of the `ProcessMap` model — modify activities, decisions, handoffs, roles, inputs, outputs, expectations, and work products — while maintaining source attribution (user-provided, model-inferred, system-derived) and tracking draft readiness for eventual consensus activation.

Because Flowent is still a frontend-only prototype (no persistence, no auth, no real-time sync), the workspace operates entirely in-memory. The generated draft from Milestone 4 becomes the starting point; users edit it in structured panels. The workspace state is ephemeral and lives within the React component tree.

This milestone should not add persistence, authentication, real-time collaboration, conflict resolution, approval workflows, consensus activation, or impact analysis. It should establish the editing contract, source attribution during edits, structured add/remove/modify operations, draft readiness indicators, and tests for all editing operations.

## Patterns to Mirror

| Category | Source | Pattern |
|---|---|---|
| Domain model | `src/features/process-map/types.ts:82` | `ProcessMap` is the shared model; workspace edits must produce valid `ProcessMap` instances. |
| Source attribution | `src/features/scenario-generation/types.ts:8` | `GeneratedSource = 'user-provided' | 'model-inferred' | 'system-derived'` tracks provenance. |
| Scenario draft | `src/features/scenario-generation/types.ts:47` | `ScenarioDraft` includes `processMap`, `sourcesById`, `findings`; workspace extends this with editing operations. |
| Derived views | `src/features/role-navigation/deriveRoleView.ts:28` | Role views are pure derivations; editing must keep the map valid for downstream derivation. |
| Multi-view tabs | `src/features/process-views/MultiRoleProcessViews.tsx:50` | Tab-based concern-specific panels with accessible keyboard navigation. |
| App shell | `src/App.tsx:7` | App uses `AppMode` union type with `APP_MODES` array for tab navigation. |
| Tests | `src/features/process-views/deriveProcessViews.test.ts:5` | Vitest tests assert behavior through user-visible titles and derived arrays. |
| Component tests | `src/features/process-views/MultiRoleProcessViews.test.tsx:6` | Testing Library checks headings, tabs, keyboard navigation. |
| Styling | `src/styles.css:1` | Warm process-workspace tokens, layered panels, clear focus states. |

## Files to Change

| File | Action | Why |
|---|---|---|
| `src/features/process-map/workspaceOperations.ts` | CREATE | Pure functions for editing a `ProcessMap`: add/remove/modify activities, decisions, handoffs, roles, inputs, outputs, expectations, work products. All return new immutable `ProcessMap` instances. |
| `src/features/process-map/workspaceOperations.test.ts` | CREATE | Unit tests for every edit operation, source tracking, and invalid reference handling. |
| `src/features/process-map/useWorkspace.ts` | CREATE | React hook wrapping workspace operations with undo/redo history, current map state, source tracking, and draft readiness. |
| `src/features/process-map/useWorkspace.test.ts` | CREATE | Hook tests for edit, undo, redo, source tracking, and readiness. |
| `src/features/process-map/ProcessMapWorkspace.tsx` | CREATE | Workspace UI with structured editing panels for all map elements. |
| `src/features/process-map/ProcessMapWorkspace.test.tsx` | CREATE | Component tests for editing activities, adding decisions, removing handoffs, undo/redo, source labels. |
| `src/features/scenario-generation/ScenarioGeneration.tsx` | UPDATE | After generating a draft, hand it off to the workspace instead of only showing a read-only review. |
| `src/App.tsx` | UPDATE | Wire workspace into the app shell — either as a fourth tab or as a state within scenario generation. |
| `src/App.test.tsx` | UPDATE | Cover workspace accessibility in the app shell. |
| `src/styles.css` | UPDATE | Workspace-specific styles maintaining the existing visual system. |
| `e2e/collaborative-workspace.spec.ts` | CREATE | E2E journey: generate draft → enter workspace → edit activities → verify source labels. |
| `.claude/plans/temporary-collaborative-workspace.plan.md` | UPDATE | Mark complete after validation. |

## Tasks

### Task 1: Define workspace operations contract
- **Action**: Add pure functions in `workspaceOperations.ts` for editing a `ProcessMap`. Operations: `addActivity`, `removeActivity`, `updateActivity`, `addDecision`, `removeDecision`, `updateDecision`, `addHandoff`, `removeHandoff`, `updateHandoff`, `addRole`, `removeRole`, `addInput`, `removeInput`, `addOutput`, `removeOutput`, `addExpectation`, `removeExpectation`, `updateMapTitle`, `updateMapScenario`. Each returns a new `ProcessMap` with source tracking via `sourcesById`.
- **Mirror**: `src/features/role-navigation/deriveRoleView.ts:28` consumes a stable `ProcessMap`; operations must produce valid maps.
- **TDD**: Write tests first for add/remove/modify, source tracking, invalid reference handling, and immutability.

### Task 2: Implement workspace hook with undo/redo
- **Action**: Create `useWorkspace` hook that wraps operations with undo/redo history (snapshot-based), exposes `map`, `sourcesById`, `findings`, `undo`, `redo`, `canUndo`, `canRedo`, `isDirty`, `readinessStatus`. Readiness checks: at least one activity, at least one role, no orphan references.
- **TDD**: Write tests for edit → undo → redo cycle, readiness status transitions, source tracking through edits.

### Task 3: Build workspace editing UI
- **Action**: Create `ProcessMapWorkspace` with structured panels: Map overview (title, scenario, status), Activities panel (list + inline edit + add/remove), Decisions panel, Handoffs panel, Actors panel (roles, stakeholders, upstream, downstream), Inputs/Outputs panel, Expectations panel, Findings panel. Each panel shows source pills and allows editing.
- **Mirror**: `src/features/process-views/MultiRoleProcessViews.tsx:50` uses tab-based concern-specific panels.
- **TDD**: Write component tests for editing an activity title, adding a decision, removing a handoff, verifying source labels, undo/redo buttons.

### Task 4: Integrate workspace with scenario generation flow
- **Action**: After generating a draft in `ScenarioGeneration.tsx`, show a "Refine in workspace" button that transitions the draft into the workspace. The workspace can also be entered with an empty map for manual creation.
- **TDD**: Write tests for the transition from generated draft to workspace, and for creating a new empty map.

### Task 5: Wire into app shell
- **Action**: Add workspace as accessible from the scenario generation tab (post-generation) or as a fourth tab. Preserve keyboard navigation.
- **TDD**: Update `App.test.tsx` for workspace accessibility.

### Task 6: Add E2E coverage
- **Action**: Add Playwright test: generate a mocked draft → enter workspace → edit an activity title → verify the change appears → verify source label updates.
- **TDD**: Write E2E first with mocked API, verify journey.

### Task 7: Validation and review
- **Action**: Run `npm run lint`, `npm test`, `npm run build`, `npm run test:e2e`. Run code, security, accessibility, and TypeScript reviews. Fix blocking issues. Update PRD and plan status.
- **Validate**: All checks pass before marking complete.

## Validation

```bash
npm run lint
npm test
npm run build
npm run test:e2e
```

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Editing complexity overwhelms the prototype scope | High | Keep panels structured but minimal; no drag-and-drop or visual graph editing in this milestone. |
| Source tracking becomes stale after edits | Medium | Update sourcesById on every operation; user edits always mark as 'user-provided'. |
| Undo/redo history grows too large | Medium | Cap history at 50 snapshots. |
| Workspace state conflicts with existing tab structure | Medium | Keep workspace within scenario generation flow, not a separate top-level concern. |
| No persistence means edits are lost on refresh | Expected | Accept for prototype; note in UI copy. |

## Acceptance

- [x] Workspace operations produce valid immutable `ProcessMap` instances.
- [x] Source attribution is maintained and updated through all edits.
- [x] Users can add, remove, and modify activities, decisions, handoffs, roles, inputs, outputs, and expectations.
- [x] Undo/redo works for all editing operations.
- [x] Readiness indicators show whether the map is structurally complete.
- [x] Generated draft transitions smoothly into the workspace.
- [x] New empty maps can be created from scratch.
- [x] Workspace UI uses accessible tab/panel semantics.
- [x] Existing Role navigation, Process views, and Scenario generation continue to work.
- [x] Unit, component, and E2E tests cover editing operations.
- [x] `npm run lint`, `npm test`, `npm run build`, and `npm run test:e2e` pass.

## Not Included

- Persistence or saved maps
- Real-time multi-user collaboration
- Conflict resolution
- Authentication or user identity
- Approval workflow
- Consensus activation
- Impact analysis
- Visual graph/diagram editing
- Drag-and-drop reordering
