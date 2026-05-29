# Plan: Validation Prototype

**Source PRD**: `.claude/prds/flowent-mvp.prd.md`  
**Selected Milestone**: Validation prototype  
**Complexity**: Medium  
**Status**: Complete — validated with lint, 92 unit tests, production build, 6 Playwright E2E tests on 2026-05-29.

## Summary

Create a validation prototype where one realistic product delivery process can be tested against current documentation for comprehension, consensus, and alignment. The prototype demonstrates the full Flowent lifecycle: generate a draft from a realistic R&D scenario, refine it in the workspace, confirm across roles, approve, and activate with impact analysis and version snapshot.

The key deliverable is a realistic, end-to-end process that proves Flowent's value proposition: R&D teams can turn scenario context into a shared, confirmed, activated process map faster and more consistently than with scattered docs, whiteboards, or informal habits.

This milestone should not add new features beyond realistic sample data and an improved demo flow. It should ensure the existing features work together with realistic process data and that the full lifecycle is demonstrable.

## Tasks

### Task 1: Create realistic sample process map
- **Action**: Replace or augment the existing `sampleProcessMap.ts` with a realistic, detailed process map representing a real product delivery scenario (e.g., "Customer feedback to feature release" or "Incident response and follow-up"). Include 5-7 roles, 2-3 stakeholders, upstream/downstream actors, 3-5 activities, 2-3 decisions, 2-3 handoffs, inputs, outputs, work products, expectations.
- **Mirror**: `src/features/process-map/sampleProcessMap.ts:1` — existing sample for role navigation.

### Task 2: Add demo seed data
- **Action**: Create a demo seed that pre-populates the workspace with the realistic map, source attribution, and readiness state so users can immediately explore the full flow without generating from scratch.

### Task 3: Ensure full lifecycle works end-to-end
- **Action**: Verify that the realistic process works through the entire flow: view in role navigation → view in multi-role process views → generate from scenario → refine in workspace → confirm roles → approve → activate. Fix any issues found.

### Task 4: Add lifecycle E2E test
- **Action**: Add a Playwright test that demonstrates the full lifecycle with the realistic process data.

### Task 5: Validation and review
- **Action**: Run `npm run lint`, `npm test`, `npm run build`, `npm run test:e2e`. Update PRD and plan status.

## Validation

```bash
npm run lint
npm test
npm run build
npm run test:e2e
```

## Acceptance

- [x] A realistic product delivery process map is available as sample data.
- [x] The full lifecycle (generate → refine → confirm → approve → activate) works with realistic data.
- [x] All existing features (role navigation, multi-role views, scenario generation, workspace, consensus) work correctly with the realistic process.
- [x] An E2E test covers the full lifecycle.
- [x] `npm run lint`, `npm test`, `npm run build`, and `npm run test:e2e` pass.

## Not Included

- New features beyond realistic sample data
- User research or interview integration
- Analytics or metrics collection
- Persistence or deployment
