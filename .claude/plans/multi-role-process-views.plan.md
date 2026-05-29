# Plan: Multi-role Process Views

**Source PRD**: `.claude/prds/flowent-mvp.prd.md`  
**Selected Milestone**: Multi-role process views  
**Complexity**: Medium
**Status**: Complete — validated with lint, unit tests, production build, Playwright E2E, TypeScript review, accessibility review, and code-quality review on 2026-05-29.

## Summary

Extend Flowent from a single role-member lens into multiple process-map views for different process participants: product/project managers, process owners, quality reviewers, and stakeholders. The implementation should keep one shared process map as the source of truth and derive each view from the same activities, responsibilities, handoffs, decisions, expectations, actors, and work products instead of duplicating view data.

This milestone should not add scenario generation, collaborative editing, activation workflows, persistence, authentication, workflow automation, or task tracking. It should establish a reusable multi-view derivation layer and a prototype UI that helps non-individual-contributor roles inspect readiness, completeness, reviewability, and stakeholder involvement.

## Patterns to Mirror

| Category | Source | Pattern |
|---|---|---|
| Naming | `CLAUDE.md:6` | Use Flowent product language around process maps, alignment, handoffs, responsibilities, expectations, bottlenecks, lifecycle, and continuous improvement. |
| Requirements | `.claude/prds/flowent-mvp.prd.md:47` | Milestone 3 is specifically for product/project managers, process owners, quality reviewers, and stakeholders viewing the same process map through their own concerns. |
| View priorities | `docs/superpowers/specs/2026-05-28-flowent-metamodel-v0-design.md:129` | Product/project manager view prioritizes start/end points, roles, stakeholders, risky handoffs, blocked confirmations, version status, and readiness. |
| View priorities | `docs/superpowers/specs/2026-05-28-flowent-metamodel-v0-design.md:140` | Process owner view prioritizes completeness gaps: missing responsible roles, upstream actors, downstream actors, decision criteria, expectations, approvals, and replacement impact. |
| View priorities | `docs/superpowers/specs/2026-05-28-flowent-metamodel-v0-design.md:152` | Quality/review view prioritizes completion standards, reviewed work products, decision rationale, version/confirmation records, risky handoffs, and unconfirmed stakeholders. |
| View priorities | `docs/superpowers/specs/2026-05-28-flowent-metamodel-v0-design.md:163` | Stakeholder view prioritizes where stakeholders are consulted, informed, asked to confirm, affected by outputs, or involved in decisions. |
| Domain model | `src/features/process-map/types.ts:10` | Actors already cover role, stakeholder, upstream, and downstream kinds; preserve this shared actor model. |
| Derived data | `src/features/role-navigation/deriveRoleView.ts:28` | Existing role navigation is a pure derivation from `ProcessMap` and `roleId`; multi-role views should follow the same pattern. |
| Errors | `src/features/role-navigation/deriveRoleView.ts:31` | Throw a clear `Error` when a requested actor/view target cannot be found in the process map. |
| Logging | Existing source | No logging pattern exists; avoid adding logging for local deterministic derivations. |
| Data access | `src/features/role-navigation/RoleNavigation.tsx:3` | Prototype reads local typed sample data; keep persistence out of this milestone. |
| Tests | `src/features/role-navigation/deriveRoleView.test.ts:5` | Use Vitest unit tests that assert derived arrays by title/name for behavior-focused coverage. |
| Component tests | `src/features/role-navigation/RoleNavigation.test.tsx:7` | Use Testing Library queries against user-visible headings, labels, and accessible button state. |
| E2E | `e2e/role-navigation.spec.ts:3` | Use Playwright to verify one critical browser journey without relying on CSS selectors. |
| Accessibility | `src/features/role-navigation/RoleNavigation.tsx:42` | Selector groups use explicit group labeling; interactive options keep native button semantics and selected state via ARIA where appropriate. |
| Styling | `src/styles.css:1` | Current UI uses warm map/workspace design tokens, layered panels, editorial scale contrast, and designed hover/focus states. |

## Files to Change

| File | Action | Why |
|---|---|---|
| `src/features/process-map/types.ts` | UPDATE | Add minimal view-oriented types if required, such as process-view audience/kind or derived gap/risk summary types. Avoid adding governance-heavy activation fields unless needed for this milestone. |
| `src/features/process-map/sampleProcessMap.ts` | UPDATE | Enrich sample data only where needed to exercise manager, owner, quality, and stakeholder concerns from the same map. Prefer existing roles/stakeholder relationships before adding new fields. |
| `src/features/process-views/deriveProcessViews.ts` | CREATE | Derive manager, process owner, quality/review, and stakeholder views from one `ProcessMap`. Keep the derivation pure and testable. |
| `src/features/process-views/deriveProcessViews.test.ts` | CREATE | Cover view-specific derivation behavior and prove all views come from the same map. |
| `src/features/process-views/MultiRoleProcessViews.tsx` | CREATE | Render the multi-view prototype surface with a view selector and concern-specific panels. |
| `src/features/process-views/MultiRoleProcessViews.test.tsx` | CREATE | Verify initial rendering, view switching, accessible selected state, and key user-visible summaries. |
| `src/App.tsx` | UPDATE | Move from only role navigation to a prototype shell that can expose role-first navigation plus multi-role process views, without introducing routing unless necessary. |
| `src/styles.css` | UPDATE | Add styles for the multi-view surface while preserving the existing Flowent visual direction and responsive behavior. |
| `e2e/role-navigation.spec.ts` | UPDATE / KEEP | Keep existing role-navigation coverage intact; rename only if the journey broadens beyond role navigation. |
| `e2e/multi-role-process-views.spec.ts` | CREATE | Add Playwright coverage for switching from manager/owner/quality/stakeholder views and confirming view-specific process concerns. |
| `.claude/prds/flowent-mvp.prd.md` | UPDATE | Mark Milestone 3 in-progress while implementing, then complete only after validation passes. |
| `.claude/plans/multi-role-process-views.plan.md` | UPDATE | Check off acceptance after implementation and validation. |

## Tasks

### Task 1: Define multi-view derivation types
- **Action**: Introduce a small set of explicit types for process views. Suggested starting point: `ProcessViewKind = 'manager' | 'process-owner' | 'quality-review' | 'stakeholder'`, plus derived view shapes for each audience. Keep the types close to `process-views` unless they must be shared across features.
- **Mirror**: `src/features/role-navigation/deriveRoleView.ts:13` defines a named `RoleView` return type before the derivation function.
- **Validate**: `npm test -- src/features/process-views/deriveProcessViews.test.ts` should type-check the new public API through tests.

### Task 2: Implement pure multi-view derivation
- **Action**: Create pure functions that derive each view from `ProcessMap`, for example `deriveManagerView`, `deriveProcessOwnerView`, `deriveQualityReviewView`, and `deriveStakeholderView`. Use existing map relationships to calculate:
  - manager readiness: process title/status/scenario, participants, start/end activities, handoffs, decisions, and readiness concerns;
  - process owner completeness: activities without responsible/accountable roles, inputs with no source actors, outputs with no recipients, decisions missing criteria, activities missing expectations;
  - quality review: work products, expectations, decision criteria, handoffs that carry review standards, and activities with completion checks;
  - stakeholder involvement: consulted/informed/affected activities, outputs, and decisions for a selected stakeholder.
- **Mirror**: `src/features/role-navigation/deriveRoleView.ts:35` filters shared process data and collects related IDs rather than hardcoding view content.
- **Validate**: Unit tests assert each view derives expected names/titles from `sampleProcessMap`.

### Task 3: Add focused sample-map coverage for all view audiences
- **Action**: Extend `sampleProcessMap` only as needed so every planned view has meaningful content. If the existing Design Lead stakeholder is enough, use it; otherwise add one stakeholder relationship or expectation with clear Flowent product language.
- **Mirror**: `src/features/process-map/sampleProcessMap.ts:183` models responsibilities directly on activities with role/stakeholder IDs and responsibility kinds.
- **Validate**: Derivation tests should fail if sample data no longer supports manager, owner, quality, or stakeholder views.

### Task 4: Build the multi-role process views UI
- **Action**: Create `MultiRoleProcessViews` as a presentational/container component for the new view surface. Provide a view selector for Manager, Process owner, Quality review, and Stakeholder views. Render concern-specific panels rather than a generic card grid: readiness, completeness gaps, review standards, and stakeholder involvement should each have distinct hierarchy and copy.
- **Mirror**: `src/features/role-navigation/RoleNavigation.tsx:12` uses a container component that derives data and renders smaller focused subcomponents.
- **Validate**: Component tests can find the default view heading, switch views with accessible buttons, and confirm view-specific summaries.

### Task 5: Integrate the new view surface into the prototype shell
- **Action**: Update `App.tsx` to expose both completed role-first navigation and the new multi-role process views. Prefer a small app-level mode selector over adding a router. Keep state local and URL-free for now unless a simple URL state pattern is clearly needed.
- **Mirror**: `src/App.tsx:4` currently keeps simple local selected-role state and passes explicit callbacks.
- **Validate**: Existing role-navigation component tests and E2E still pass after integration.

### Task 6: Style the new surface without template drift
- **Action**: Add styles that preserve the current warm process-workspace direction while giving each view a specific visual rhythm. Avoid uniform default cards; use hierarchy, semantic color, grouped panels, and responsive layout. Keep focus states visible and motion compositor-friendly.
- **Mirror**: `src/styles.css:57` uses layered workspace shells, sticky panels, editorial type scale, and semantic tokens.
- **Validate**: `npm run build` confirms CSS compiles; Playwright confirms the view is usable at the default browser size.

### Task 7: Add E2E coverage for the multi-view journey
- **Action**: Add a Playwright test that loads the app, opens multi-role process views, switches between at least process owner and quality review, and verifies view-specific content. Keep selectors user-facing through roles, headings, and visible text.
- **Mirror**: `e2e/role-navigation.spec.ts:3` verifies the role-navigation journey through visible headings/text and button role queries.
- **Validate**: `npm run test:e2e` passes.

### Task 8: Final validation and milestone status update
- **Action**: Run full validation, request code review, address critical/high findings, then update this plan acceptance and PRD Milestone 3 from in-progress to complete.
- **Mirror**: `.claude/plans/role-first-navigation.plan.md:83` records concrete validation commands and completion status after the milestone is finished.
- **Validate**: `npm run lint`, `npm test`, `npm run build`, and `npm run test:e2e` all pass before marking complete.

## Validation

```bash
npm run lint
npm test
npm run build
npm run test:e2e
```

All commands passed on 2026-05-29. Final review found no actionable TypeScript/React, accessibility, correctness, scope, maintainability, or test blockers.

Suggested focused commands during implementation:

```bash
npm test -- src/features/process-views/deriveProcessViews.test.ts
npm test -- src/features/process-views/MultiRoleProcessViews.test.tsx
npx playwright test e2e/multi-role-process-views.spec.ts
```

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Multi-view data becomes duplicated static copy | High | Keep all views as pure derivations from `ProcessMap`, mirroring `deriveRoleView`. |
| Manager/owner/quality/stakeholder views feel generic or too similar | Medium | Give each view distinct acceptance questions and concern-specific panels: readiness, completeness, reviewability, stakeholder involvement. |
| Process owner checks imply governance features not implemented yet | Medium | Show structural gaps and readiness signals only; do not add approval routing, impact workflows, or activation state machines. |
| Sample map lacks enough relationships for meaningful non-role views | Medium | Add the smallest realistic sample relationships needed and cover them in derivation tests. |
| UI drifts into a dashboard-by-numbers layout | Medium | Preserve Flowent's map/workspace visual direction, use hierarchy and semantic grouping, and avoid generic card grids. |
| App shell integration breaks existing role-navigation flow | Low | Keep local state explicit, preserve existing component API, and run existing unit/E2E tests. |
| Stakeholder view scope is ambiguous | Medium | Start with the existing Design Lead stakeholder and derive consulted/informed/affected responsibilities; defer confirmation workflows to later milestones. |

## Acceptance

- [x] Multi-role view types are explicit and readable.
- [x] Manager, process owner, quality/review, and stakeholder views are derived from a shared `ProcessMap`.
- [x] The derivation layer identifies readiness, completeness, reviewability, and stakeholder involvement concerns without duplicating process data.
- [x] Sample process data supports meaningful content for all four multi-role views.
- [x] UI lets users switch among multi-role views with accessible controls and visible selected state.
- [x] UI copy stays map-first and alignment-focused, not task-tracker-oriented.
- [x] Existing role-first navigation behavior remains intact.
- [x] Unit/component tests cover the new derivation and UI behavior.
- [x] Playwright E2E covers the multi-role view switching journey.
- [x] `npm run lint`, `npm test`, `npm run build`, and `npm run test:e2e` pass.
- [x] Code review finds no blocking critical/high issues before marking the milestone complete.

## Not Included in This Milestone

- Scenario-to-map generation or model inference
- Temporary collaborative editing workspace
- All-party confirmation workflow
- Approval workflow
- Impact analysis workflow
- Process replacement workflow
- Persistent storage
- User authentication
- Workflow automation, task execution, or issue tracking
