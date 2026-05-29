# Plan: All-Party Consensus Activation

**Source PRD**: `.claude/prds/flowent-mvp.prd.md`  
**Selected Milestone**: All-party consensus activation  
**Complexity**: Large  
**Status**: Complete — validated with lint, 92 unit tests, production build, 5 Playwright E2E tests, TypeScript review, accessibility review, security review, and code-quality review on 2026-05-29.

## Summary

Add a lightweight consensus and activation flow where every relevant party can confirm a process map, after which the team can activate it or replace the previous version with approval and impact context. The consensus system tracks which roles/stakeholders have confirmed, manages draft state transitions (draft → in-discussion → ready-for-confirmation → confirmed → approved → activated), generates a basic impact analysis when replacing an active map, and creates version snapshots on activation.

Because Flowent is still a frontend-only prototype (no persistence, no auth), the consensus flow operates entirely in-memory. Users confirm on behalf of roles/stakeholders. Activation creates a version snapshot. Impact analysis compares the new map against the previous active map (if any) and summarizes what changed.

This milestone should not add persistence, authentication, real-time sync, or automated dependency analysis. It should establish the confirmation contract, draft state machine, approval flow, impact summary, version snapshot, and tests.

## Patterns to Mirror

| Category | Source | Pattern |
|---|---|---|
| Domain model | `src/features/process-map/types.ts:1` | `ProcessMapStatus = 'draft' | 'active' | 'replaced'`; extend with confirmation/approval types. |
| Source attribution | `src/features/scenario-generation/types.ts:8` | `GeneratedSource` tracks provenance; confirmations track who confirmed. |
| Workspace | `src/features/process-map/workspaceOperations.ts` | Pure immutable operations; consensus operations follow the same pattern. |
| Workspace hook | `src/features/process-map/useWorkspace.ts` | Hook wraps operations with history; extend with confirmation/approval state. |
| App shell | `src/App.tsx:7` | `AppMode` union type with keyboard-accessible tabs. |
| Tests | `src/features/process-map/workspaceOperations.test.ts` | Vitest tests assert behavior through immutable state transitions. |
| Styling | `src/styles.css:1` | Warm process-workspace tokens, layered panels. |

## Files to Change

| File | Action | Why |
|---|---|---|
| `src/features/process-map/types.ts` | UPDATE | Add `Confirmation`, `Approval`, `ImpactAnalysis`, `ProcessMapVersion`, `DraftState` types. |
| `src/features/process-map/consensusOperations.ts` | CREATE | Pure functions: `confirmMap`, `unconfirmMap`, `approveMap`, `rejectMap`, `activateMap`, `computeImpactAnalysis`, `createVersionSnapshot`. |
| `src/features/process-map/consensusOperations.test.ts` | CREATE | Unit tests for confirmation, approval, activation, impact analysis, version snapshot. |
| `src/features/process-map/useWorkspace.ts` | UPDATE | Add consensus state (confirmations, approval, draft state, versions). |
| `src/features/process-map/ProcessMapWorkspace.tsx` | UPDATE | Add consensus panel showing confirmation status per role/stakeholder, approval controls, readiness-for-confirmation check, activate button. |
| `src/styles.css` | UPDATE | Consensus panel, confirmation badges, impact analysis styles. |
| `e2e/consensus-activation.spec.ts` | CREATE | E2E: generate draft → refine → mark ready → confirm roles → approve → activate. |
| `.claude/plans/all-party-consensus-activation.plan.md` | UPDATE | Mark complete after validation. |

## Tasks

### Task 1: Define consensus types
- **Action**: Add to `types.ts`: `DraftState`, `Confirmation`, `Approval`, `ImpactAnalysis`, `ProcessMapVersion`. Keep `ProcessMapStatus` as-is for backwards compatibility.
- **TDD**: Write tests for type construction and state transitions.

### Task 2: Implement consensus operations
- **Action**: Add `consensusOperations.ts` with pure functions: `confirmForRole`, `removeConfirmation`, `markReadyForConfirmation`, `approve`, `reject`, `activate`, `computeImpact`, `snapshotVersion`. All return new immutable state.
- **Mirror**: `workspaceOperations.ts` pattern — pure functions, immutable results, source tracking.
- **TDD**: Write tests first for each operation and state transition.

### Task 3: Extend workspace hook with consensus
- **Action**: Add consensus state to `useWorkspace`: `confirmations`, `approval`, `draftState`, `versions`, `activeVersion`. Expose `confirmForRole`, `markReady`, `approve`, `activate` methods.
- **TDD**: Write hook tests for confirmation cycle and activation.

### Task 4: Build consensus UI panel
- **Action**: Add a "Consensus" panel to `ProcessMapWorkspace` showing: draft state badge, confirmation status per role/stakeholder (confirmed/pending), "Mark ready for confirmation" button, approval controls, "Activate" button, impact summary on activation.
- **TDD**: Write component tests for confirmation UI, state transitions, impact display.

### Task 5: Add E2E coverage
- **Action**: Playwright test: generate draft → refine → mark ready → confirm for each role → approve → activate → verify active state.
- **TDD**: Write E2E with mocked API.

### Task 6: Validation and review
- **Action**: Run `npm run lint`, `npm test`, `npm run build`, `npm run test:e2e`. Update PRD and plan status.

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
| Consensus flow adds too much UI complexity | Medium | Keep it as one panel in the workspace, not a separate screen. |
| No real user identity | Expected | Users confirm on behalf of roles; note in UI copy. |
| Impact analysis is too simple | Medium | Start with basic diff; can enhance later. |
| Version snapshots grow memory | Low | Cap at 10 versions in prototype. |

## Acceptance

- [x] Each role/stakeholder can confirm or unconfirm the map.
- [x] Draft state transitions correctly through the lifecycle.
- [x] Approval is separate from confirmation.
- [x] Impact analysis summarizes changes when replacing an active map.
- [x] Version snapshots are created on activation.
- [x] Existing Role navigation, Process views, Scenario generation, and Workspace continue to work.
- [x] Unit, component, and E2E tests cover the consensus flow.
- [x] `npm run lint`, `npm test`, `npm run build`, and `npm run test:e2e` pass.

## Not Included

- Persistence or saved versions
- Real-time multi-user collaboration
- Authentication or real user identity
- Automated dependency/impact analysis
- Notification system
- Audit trail beyond version snapshots
