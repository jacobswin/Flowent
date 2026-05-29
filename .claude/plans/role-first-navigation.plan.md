# Plan: Role-first Navigation

**Source PRD**: `.claude/prds/flowent-mvp.prd.md`  
**Selected Milestone**: Role-first navigation  
**Complexity**: Large
**Status**: Complete — validated with lint, unit tests, production build, and Playwright E2E on 2026-05-28.

## Summary

Build the first executable slice of Flowent around role-first process navigation: an R&D team member should be able to choose or inspect a role and understand what that role must do, what inputs it needs, what outputs it produces, who it depends on, who depends on it, and which decisions affect its work. Because the repository has no application stack yet, the plan begins by choosing and scaffolding a minimal web app before implementing the role-navigation domain model and prototype UI.

This milestone should not implement full scenario generation, collaborative editing, approvals, impact analysis, workflow automation, or task tracking. It should establish the core model and role-view behavior that later milestones can build on.

## Patterns to Mirror

| Category | Source | Pattern |
|---|---|---|
| Naming | `CLAUDE.md:6` | Use Flowent product language: process maps, alignment, handoffs, responsibilities, expectations, lifecycle, improvement. |
| Requirements | `.claude/prds/flowent-mvp.prd.md:29` | MVP is role-first process navigation with scenario generation and lightweight activation governance deferred into later slices. |
| Domain model | `docs/superpowers/specs/2026-05-28-flowent-metamodel-v0-design.md:20` | Use Metamodel v0 objects as source of truth: role, activity, decision, input, output, work product, handoff, expectation, view. |
| Errors | No source code exists | No error-handling pattern exists yet; choose a simple app-stack-native pattern during scaffolding. |
| Logging | No source code exists | No logging pattern exists yet; avoid adding logging until a runtime need appears. |
| Data access | No source code exists | No data-access pattern exists yet; start with local typed sample data for the prototype. |
| Tests | No source code exists | No test framework exists yet; select one with the app stack and add tests for role-view derivation. |

## Files to Change

| File | Action | Why |
|---|---|---|
| `package.json` or chosen stack equivalent | CREATE | Define project scripts and dependencies after stack selection. |
| App source directory for chosen stack | CREATE | Host the role-first navigation prototype. |
| Domain model module | CREATE | Define Process Map, Role, Activity, Decision, Input, Output, Work Product, Handoff, Expectation, and Role View types. |
| Role-view derivation module | CREATE | Derive a role-specific view from one process map instead of duplicating process data. |
| Sample process data module | CREATE | Provide one realistic R&D process map for validation before persistence exists. |
| Role navigation UI surface | CREATE | Let users inspect a role's responsibilities, dependencies, outputs, decisions, and handoffs. |
| Tests for role-view derivation | CREATE | Prove that role views answer the milestone questions reliably. |
| `CLAUDE.md` | UPDATE | Add actual install, dev, build, lint, and test commands once the stack exists. |

Exact paths should be chosen after the app stack is selected. If using a React/TypeScript stack, prefer feature-oriented structure such as `src/features/process-map/` and `src/features/role-navigation/`.

## Tasks

### Task 1: Choose the minimal application stack
- **Action**: Pick the stack for the prototype before writing app code. Recommended default: TypeScript + React + Vite for a fast single-page process-map prototype, unless the product needs server rendering immediately.
- **Mirror**: Follow `CLAUDE.md:21`, which states no stack exists yet and should be documented once added.
- **Validate**: The chosen stack has working install, dev, build, lint, and test commands documented in `CLAUDE.md`.

### Task 2: Scaffold the app and baseline quality tools
- **Action**: Create the minimal app structure, formatter/linter/type-check/test setup, and a first passing smoke test.
- **Mirror**: No existing code patterns; keep file organization feature-oriented per global web rules.
- **Validate**: Run the chosen stack's build, lint/type-check, and test commands successfully.

### Task 3: Define the role-navigation domain model
- **Action**: Implement typed domain objects from Metamodel v0 that are required for role-first navigation: process map, role, stakeholder, upstream/downstream actor, activity, decision, input, output, work product, handoff, expectation, and view.
- **Mirror**: `docs/superpowers/specs/2026-05-28-flowent-metamodel-v0-design.md:20`.
- **Validate**: Type-check passes and domain model tests cover required relationships.

### Task 4: Create one realistic sample R&D process map
- **Action**: Create sample data for a product-development process slice, with multiple roles, inputs, outputs, activities, decisions, work products, and handoffs.
- **Mirror**: Use Flowent copy language from `CLAUDE.md:36` and role-view questions from Metamodel v0 validation criteria.
- **Validate**: Tests can derive at least two distinct role views from the same process map.

### Task 5: Build role-view derivation
- **Action**: Implement a pure derivation that takes a process map and role ID, then returns what the role does, needs, produces, depends on, affects, and must confirm or approve.
- **Mirror**: `docs/superpowers/specs/2026-05-28-flowent-metamodel-v0-design.md:88`.
- **Validate**: Unit tests assert answers for: activities involving the role, required inputs, produced outputs, upstream dependencies, downstream recipients, decisions affecting the role, handoff expectations, and completion expectations.

### Task 6: Build the role-first navigation UI
- **Action**: Create a UI where a user selects a role and sees that role's navigation summary, grouped by responsibilities, inputs, outputs, dependencies, decisions, handoffs, and expectations.
- **Mirror**: `docs/superpowers/specs/2026-05-28-flowent-metamodel-v0-design.md:114`.
- **Validate**: Manual browser verification confirms a user can answer the milestone questions from the UI without reading raw process data.

### Task 7: Add lightweight process-map context around the role view
- **Action**: Show enough surrounding process context so role navigation does not feel detached: process title, active/draft status, relevant activities, key handoffs, and decisions.
- **Mirror**: `docs/superpowers/specs/2026-05-28-flowent-metamodel-v0-design.md:64`.
- **Validate**: Manual browser verification confirms the role view explains both the user's responsibilities and where they sit in the larger process.

### Task 8: Validate against milestone acceptance questions
- **Action**: Run automated tests and manual UI verification against the role-first navigation acceptance questions.
- **Mirror**: `docs/superpowers/specs/2026-05-28-flowent-metamodel-v0-design.md:317`.
- **Validate**: The prototype lets at least one R&D role answer: what do I do, what do I need, what do I produce, who do I depend on, who depends on me, and what decisions affect the work.

## Validation

Validation commands for this milestone:

```bash
npm run lint
npm test
npm run build
npm run test:e2e
```

All commands passed on 2026-05-28. Playwright E2E verifies the browser role-navigation flow by loading the app, confirming the default Frontend Engineer view, switching to QA Engineer, and confirming QA-specific process content.

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Stack choice distracts from product validation | Medium | Choose the smallest stack that can render and test a role-navigation prototype. |
| Role view becomes a copied data structure instead of a derived view | High | Implement role views as derivations from a single process map model. |
| The UI becomes a generic task list | Medium | Keep language around process roles, inputs, outputs, handoffs, decisions, and expectations; avoid status/task assignment patterns. |
| Sample data is too artificial | Medium | Use a realistic R&D process slice with upstream/downstream actors and decisions. |
| Governance concepts leak into this milestone | Medium | Only display draft/active context if useful; leave confirmation, approval, impact analysis, and replacement flows for later milestones. |
| No test/build conventions exist | High | Establish minimal conventions during scaffolding and document commands in `CLAUDE.md`. |

## Acceptance

- [x] A minimal app stack exists and commands are documented.
- [x] Core role-navigation domain objects are typed or otherwise explicitly modeled.
- [x] Role view is derived from a shared process map model, not duplicated manually.
- [x] At least one realistic sample process map exists.
- [x] At least two role views can be derived from the same process map.
- [x] The UI lets an R&D team member answer what they do, need, produce, depend on, and influence.
- [x] Tests cover role-view derivation behavior.
- [x] Build/type/lint/test validation passes for the chosen stack.
- [x] Browser verification confirms the role-first navigation flow works.

## Not Included in This Milestone

- Scenario-to-map generation UI or model inference
- Temporary collaborative editing workspace
- All-party confirmation workflow
- Approval workflow
- Impact analysis workflow
- Process replacement workflow
- Multi-role manager/process-owner/quality views beyond the role-first R&D member view
- Persistent storage
- User authentication
