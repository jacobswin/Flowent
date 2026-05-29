# Plan: Scenario-to-map Generation

**Source PRD**: `.claude/prds/flowent-mvp.prd.md`  
**Selected Milestone**: Scenario-to-map generation  
**Complexity**: Large  
**Status**: Complete — validated with lint, unit tests, production build, Playwright E2E, TypeScript review, accessibility review, security review, and code-quality review on 2026-05-29.

## Summary

Add an LLM-assisted scenario-to-map generation flow where an R&D team can describe a work scenario, roles, stakeholders, upstream/downstream actors, inputs, outputs, activities, and decisions, then receive a Claude-generated first draft process map for discussion. The generated map must remain explicitly draft-only: Flowent should show which content came from the user, which content was inferred by the model, what is missing, what assumptions were made, and which handoffs or decisions are risky.

Because Flowent is currently a frontend-only Vite prototype, this milestone must introduce a safe server/API boundary before any model call. The browser must never receive an Anthropic API key or call Claude directly; the server reads credentials from environment variables, validates input and model output, calls Claude through the official TypeScript SDK, and returns a normalized `ProcessMap` draft plus findings for the review UI.

This milestone should not add persistence, collaborative editing, activation, approval, impact analysis, authentication, workflow automation, or task execution. It should establish the model-assisted generation contract, safe API boundary, validation/normalization pipeline, draft review surface, and tests using mocked model responses so automated validation never depends on a live Claude API key.

## Architecture Decision

Use a **single Claude API structured-output call** behind a thin Node/TypeScript API route, not Managed Agents. Scenario-to-map generation is a bounded extraction/transformation task with one response shape; Flowent controls validation, normalization, and UI review, so a full agent loop or Anthropic-hosted tool workspace would be unnecessary for this milestone.

Default provider/model choices for this milestone:

- Provider: Anthropic Claude only.
- SDK: official `@anthropic-ai/sdk` TypeScript SDK.
- Model: exact ID `claude-opus-4-8`.
- Thinking: `thinking: { type: 'adaptive' }`.
- Effort: `output_config: { effort: 'high', format: ... }` for the generation route.
- Structured output: prefer `client.messages.parse()` with a Zod-backed output schema and `zodOutputFormat(...)`.
- Sampling: do not send `temperature`, `top_p`, or `top_k`.
- Streaming: not required for the first prototype if output remains moderate and `max_tokens` stays near 16k; revisit streaming with `.finalMessage()` if scenario inputs or generated maps become large.

## Patterns to Mirror

| Category | Source | Pattern |
|---|---|---|
| Naming | `CLAUDE.md:6` | Use Flowent product language: process maps, alignment, handoffs, responsibilities, expectations, bottlenecks, lifecycle, and continuous improvement. |
| Requirements | `.claude/prds/flowent-mvp.prd.md:48` | Milestone 4 outcome is an R&D team entering roles, stakeholders, upstream/downstream users, inputs, outputs, activities, decisions, and a scenario to receive a useful draft process map. |
| Scenario model | `docs/superpowers/specs/2026-05-28-flowent-metamodel-v0-design.md:174` | Scenario input includes work scenario, problem/goal, trigger, roles, stakeholders, upstream/downstream actors, known inputs/outputs/activities/decisions. |
| Draft output | `docs/superpowers/specs/2026-05-28-flowent-metamodel-v0-design.md:192` | Generated draft output includes candidate activity sequence, decisions, input-output flow, role responsibilities, handoffs, work products, expectations, confirmations, missing information, assumptions, and risk points. |
| Uncertainty | `docs/superpowers/specs/2026-05-28-flowent-metamodel-v0-design.md:208` | Generated maps must expose which parts are user-provided vs inferred and identify missing/uncertain parts instead of presenting drafts as final truth. |
| Domain model | `src/features/process-map/types.ts:82` | `ProcessMap` is the shared source of truth for roles, stakeholders, inputs, outputs, work products, expectations, decisions, handoffs, and activities. |
| Actor model | `src/features/process-map/types.ts:10` | Actors are typed as role, stakeholder, upstream, or downstream; generated inputs should preserve this actor distinction. |
| Decision relationships | `src/features/process-map/types.ts:47` | Decisions use actor-level affected actor IDs, supporting roles and stakeholders. |
| Derived data | `src/features/role-navigation/deriveRoleView.ts:28` | Existing map views are pure derivations from a shared `ProcessMap`; generation should normalize Claude output into the same shared model instead of creating a parallel view model. |
| Existing multi-view UI | `src/features/process-views/MultiRoleProcessViews.tsx:50` | Feature components keep local state, derive data locally, use accessible tab/list semantics, and split UI into focused subcomponents. |
| App shell | `src/App.tsx:45` | App-level prototype sections are exposed as keyboard-accessible tabs with persistent tabpanels. |
| Tests | `src/features/process-views/deriveProcessViews.test.ts:5` | Vitest tests assert behavior through user-visible titles/names and derived arrays. |
| Component tests | `src/features/process-views/MultiRoleProcessViews.test.tsx:6` | Testing Library checks headings, tabs, tabpanels, keyboard navigation, and user-visible content. |
| E2E | `e2e/multi-role-process-views.spec.ts:3` | Playwright verifies critical user journeys through roles, tabs, headings, and visible text rather than CSS selectors. |
| Styling | `src/styles.css:1` | Current visual direction uses warm process-workspace tokens, layered panels, editorial hierarchy, clear focus states, and semantic color. |
| Claude API | `claude-api skill` | Use the official TypeScript SDK, `claude-opus-4-8`, adaptive thinking, structured outputs through `output_config.format`, typed SDK errors, and prompt caching with stable prompt prefixes. |

## Files to Change

| File | Action | Why |
|---|---|---|
| `package.json` | UPDATE | Add runtime dependencies for the official Anthropic SDK and schema validation, plus any local dev tooling needed to run the API boundary alongside Vite. |
| `tsconfig.server.json` | CREATE | Type-check the Node API boundary separately from the browser app so server-only imports and environment variables stay out of the Vite client bundle. |
| `vite.config.ts` | UPDATE | Proxy browser `/api/*` calls to the local Node API server during development. |
| `.env.example` | CREATE | Document `ANTHROPIC_API_KEY` and any local API configuration without committing secrets. |
| `.gitignore` | UPDATE / VERIFY | Ensure `.env`, `.env.local`, and other secret-bearing environment files are ignored. |
| `server/index.ts` | CREATE | Start a small local API server for the prototype and register the scenario-draft route. |
| `server/scenario-generation/anthropicClient.ts` | CREATE | Initialize the official Anthropic SDK from environment variables and fail safely when `ANTHROPIC_API_KEY` is missing. |
| `server/scenario-generation/scenarioDraftPrompt.ts` | CREATE | Build stable Claude instructions, user-scenario messages, and prompt-cache placement without dynamic values in the cached prefix. |
| `server/scenario-generation/scenarioDraftSchemas.ts` | CREATE | Define Zod schemas for request input and Claude structured output. |
| `server/scenario-generation/generateScenarioDraftWithClaude.ts` | CREATE | Call Claude with structured outputs, adaptive thinking, prompt caching, and typed SDK error handling. |
| `server/scenario-generation/normalizeScenarioDraft.ts` | CREATE | Convert validated Claude output into a plain `ProcessMap` plus source/uncertainty sidecar metadata. |
| `server/scenario-generation/scenarioDraftRoute.ts` | CREATE | Validate request bodies, enforce size/rate guardrails, call the generator, and return a consistent API response envelope. |
| `server/scenario-generation/*.test.ts` | CREATE | Unit-test prompt assembly, schema validation, normalization, missing API key behavior, and mocked Claude success/failure paths. |
| `src/features/scenario-generation/types.ts` | CREATE | Define browser-facing `ScenarioInput`, `ScenarioDraft`, `GeneratedMapFinding`, source markers, request/response types, and UI state types. |
| `src/features/scenario-generation/scenarioInputValidation.ts` | CREATE | Validate client-side draft request inputs before sending them to the API. |
| `src/features/scenario-generation/scenarioDraftApi.ts` | CREATE | Browser client for `POST /api/scenario-drafts`; handles loading, validation errors, model errors, and safe user-facing messages. |
| `src/features/scenario-generation/ScenarioGeneration.tsx` | CREATE | Render the scenario input and generated draft review surface. |
| `src/features/scenario-generation/ScenarioGeneration.test.tsx` | CREATE | Verify users can enter scenario details, generate through a mocked API client, see loading/error states, and inspect draft map sections. |
| `src/App.tsx` | UPDATE | Add Scenario generation as a third app-level tab while preserving existing role navigation and process views. |
| `src/App.test.tsx` | UPDATE | Cover keyboard navigation across three top-level tabs and scenario tabpanel availability. |
| `src/styles.css` | UPDATE | Add scenario-generation layout styles while preserving the current Flowent visual system and accessibility fixes. |
| `e2e/scenario-generation.spec.ts` | CREATE | Verify the browser journey with a mocked `/api/scenario-drafts` response so E2E does not require a real Claude key. |
| `.claude/prds/flowent-mvp.prd.md` | UPDATE | Reflect that Milestone 4 is LLM-assisted and currently in progress. |
| `.claude/plans/scenario-to-map-generation.plan.md` | UPDATE | Check off acceptance after implementation and validation. |

## Tasks

### Task 1: Define scenario input, API, and draft output contracts
- **Action**: Add explicit types and schemas for `ScenarioInput`, actor/activity/decision inputs, API request/response envelopes, Claude structured output, `ScenarioDraft`, `GeneratedMapFinding`, and `GeneratedSource = 'user-provided' | 'model-inferred' | 'system-derived'`. Keep browser-facing types close to `src/features/scenario-generation/` and server validation schemas close to `server/scenario-generation/`.
- **Mirror**: `src/features/process-views/deriveProcessViews.ts:13` keeps feature-specific public contracts explicit and readable.
- **Validate**: Start with failing Vitest tests that import the public contracts and assert validation behavior for missing scenario text, roles, activities, outputs, and malformed actor references.

### Task 2: Introduce a safe Node API boundary
- **Action**: Add a local Node/TypeScript API server and development proxy so the browser posts scenario inputs to `/api/scenario-drafts` instead of calling Claude directly. The server must read `ANTHROPIC_API_KEY` from the environment, never return it to the browser, and return a consistent envelope such as `{ success, data, error }`.
- **Mirror**: TypeScript API response guidance from the project rules: return a predictable success/data/error envelope and validate at system boundaries.
- **Validate**: Server route tests cover valid requests, invalid JSON, oversized payloads, missing API key, and user-facing error responses without exposing secrets or raw stack traces.

### Task 3: Build Claude prompt assembly with cache-safe stable prefixes
- **Action**: Implement prompt assembly that separates stable Flowent/metamodel instructions from volatile user scenario data. Put the stable system instruction and output expectations before the cache breakpoint, and put scenario-specific content only in the user message. Do not interpolate timestamps, UUIDs, request IDs, or random ordering into the cached prefix.
- **Claude details**:
  - use `model: 'claude-opus-4-8'`;
  - use `thinking: { type: 'adaptive' }`;
  - use `output_config: { effort: 'high', format: zodOutputFormat(...) }`;
  - use `cache_control: { type: 'ephemeral' }` on the stable system block when the stable prefix is large enough to be cacheable;
  - verify cache behavior through `response.usage.cache_creation_input_tokens` and `response.usage.cache_read_input_tokens` in development diagnostics, not production console logs.
- **Mirror**: Claude API prompt-caching guidance: stable content first, volatile content last, no silent invalidators in the prefix.
- **Validate**: Unit tests snapshot or structurally compare prompt parts to prove scenario text changes do not modify the stable system prompt block.

### Task 4: Call Claude through the official SDK with structured outputs
- **Action**: Implement `generateScenarioDraftWithClaude(input)` on the server using the official Anthropic TypeScript SDK. Use `client.messages.parse()` with Zod structured output where supported by the SDK. Handle typed SDK exceptions such as authentication, rate limit, overloaded, and generic API errors with clear user-facing messages.
- **Mirror**: Claude API TypeScript guidance: use SDK types and typed exception classes; do not redefine SDK message types, do not string-match error messages, and do not use raw `fetch`/OpenAI-compatible shims.
- **Validate**: Mock the Anthropic client in tests. Cover successful structured output, refusal/empty parsed output, malformed model output, rate limiting, overload, and authentication failure. Automated tests must not make network calls.

### Task 5: Validate and normalize model output into `ProcessMap`
- **Action**: Treat Claude output as untrusted external data. Validate it with Zod, then normalize it into a plain `ProcessMap` plus sidecar source/uncertainty metadata. Enforce unique IDs, valid actor references, role/stakeholder/upstream/downstream distinctions, decision `affectedActorIds`, handoff references, and non-final draft status.
- **Mirror**: `src/features/role-navigation/deriveRoleView.ts:35` consumes a stable `ProcessMap`; the generated draft should become compatible with the same downstream model instead of creating a parallel representation.
- **Validate**: Unit tests assert generated map titles, actors, activity sequence, decisions, handoffs, expectations, missing information, assumptions, risk points, and source markers. Invalid references should produce validation findings or safe API errors, not runtime crashes.

### Task 6: Preserve source, uncertainty, and discussion-readiness markers
- **Action**: Add source/uncertainty metadata to the generation feature output without overloading core `ProcessMap` unless a shared type is clearly needed. Prefer a sidecar keyed by generated IDs, such as `sourcesById`, `confidenceById`, or `findings`, so existing role/process views continue to consume plain `ProcessMap`.
- **Mirror**: Existing `ProcessMap` remains stable for role/process views in `src/features/process-map/types.ts:82`.
- **Validate**: Tests prove user-provided items are marked `user-provided`, Claude-inferred items are marked `model-inferred`, server-normalized items are marked `system-derived`, and assumptions/missing information remain visible in the UI.

### Task 7: Build ScenarioGeneration UI with model-call states
- **Action**: Create a prototype UI with structured fields for scenario, problem/goal, trigger, roles, stakeholders, upstream/downstream actors, inputs, outputs, activities, and decisions. Keep the form lightweight with guided examples and newline-separated inputs for this milestone. Add clear states for idle, validating, generating, generated, and error.
- **Security copy**: Because scenario data is sent to Claude for generation, include concise disclosure copy in the UI and avoid collecting secrets or sensitive credentials in scenario fields.
- **Mirror**: `src/features/process-views/MultiRoleProcessViews.tsx:50` keeps local state and renders derived panels through accessible, user-visible headings/lists.
- **Validate**: Component tests fill fields, trigger a mocked API generation, and assert loading copy, generated draft sections, and safe error messages.

### Task 8: Render generated draft map review panels
- **Action**: Display the generated draft in a map-first review surface: draft summary, candidate activity sequence, actor coverage, input/output flow, inferred handoffs, decisions, completion expectations, missing information, assumptions, and risk points. Clearly distinguish user-provided vs model-inferred content and never present generated content as an active/approved map.
- **Mirror**: `src/features/process-views/MultiRoleProcessViews.tsx:113` uses distinct concern-specific panels rather than generic card grids.
- **Validate**: Component tests verify inferred labels, draft-only copy, missing-information messages, assumptions, risk points, and generated handoffs are visible and scoped to the active tabpanel.

### Task 9: Integrate scenario generation into the app shell
- **Action**: Add Scenario generation as a third top-level tab in `App.tsx`. Preserve keyboard access with Arrow/Home/End behavior and persistent `aria-controls` tabpanels. Existing Role navigation and Process views must remain intact.
- **Mirror**: `src/App.tsx:45` implements accessible tabs for top-level prototype sections.
- **Validate**: `src/App.test.tsx` covers keyboard navigation across all three top-level tabs and verifies hidden panels do not break role/name lookups.

### Task 10: Add E2E journey coverage with mocked model response
- **Action**: Add Playwright coverage that opens Scenario generation, enters a concise R&D scenario, intercepts or mocks `POST /api/scenario-drafts`, returns a realistic draft fixture, and verifies candidate activities, inferred handoffs, missing information, assumptions, and risk points.
- **Mirror**: `e2e/multi-role-process-views.spec.ts:3` uses role/headings/text selectors and avoids CSS selectors.
- **Validate**: `npm run test:e2e` passes without `ANTHROPIC_API_KEY`.

### Task 11: Security, accessibility, code review, and milestone status update
- **Action**: Run full validation, request TypeScript/React, security, accessibility, and general code reviews, fix critical/high findings, then update the PRD and this plan from in-progress to complete.
- **Security review triggers**: This milestone handles user input, server endpoints, external API calls, environment secrets, and model-generated content, so `security-reviewer` must review the implementation before completion.
- **Mirror**: `.claude/plans/multi-role-process-views.plan.md:98` records validation commands and completion status after milestone completion.
- **Validate**: `npm run lint`, `npm test`, `npm run build`, and `npm run test:e2e` all pass before marking complete.

## Prompt and Output Contract Requirements

The Claude prompt should instruct the model to produce a draft, not a final truth. Required model-output sections:

- candidate activity sequence;
- candidate decisions and criteria;
- input-output flow;
- role responsibilities;
- upstream/downstream handoffs;
- work products;
- completion expectations;
- required confirmations for later milestones;
- missing information;
- uncertain assumptions;
- risk points;
- source markers distinguishing user-provided content from model-inferred content.

The server must reject or repair output only through deterministic normalization rules. If required model output is missing or internally inconsistent, Flowent should return a clear “draft could not be safely generated” message or a partial draft with visible validation findings, not silently hide the problem.

## Validation

```bash
npm run lint
npm test
npm run build
npm run test:e2e
```

Suggested focused commands during implementation:

```bash
npm test -- server/scenario-generation
npm test -- src/features/scenario-generation
npm test -- src/App.test.tsx
npx playwright test e2e/scenario-generation.spec.ts
```

Automated validation must not require a real Claude API key. Live Claude smoke testing, if added, should be an explicit manual command gated by `ANTHROPIC_API_KEY` and excluded from default lint/test/build/e2e runs.

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Browser leaks the Claude API key | High | Keep all Claude calls server-side, read `ANTHROPIC_API_KEY` only from environment variables, verify client bundle contains no secret access, and never expose keys in API responses. |
| Generated output feels magically authoritative | High | Label draft status, show user-provided vs model-inferred sources, and surface uncertainty/missing information prominently. |
| Model output is malformed or internally inconsistent | High | Use structured outputs, Zod validation, deterministic normalization, reference checks, and safe error states. |
| Prompt injection through scenario text changes generation rules | Medium | Keep operator instructions in the system prompt, place user scenario only in user content, validate output against schema, and ignore user attempts to override system/developer instructions. |
| Scenario data may contain sensitive company context | Medium | Add UI disclosure that scenario text is sent to Claude, avoid logging raw scenario content, and do not ask users to paste secrets or credentials. |
| Model/API errors block prototype validation | Medium | Mock model responses in automated tests, provide clear UI errors, and keep a deterministic fixture path for local/E2E tests only. |
| API route is abused or runs up model cost | Medium | Add request size limits, basic rate limiting appropriate for the prototype, same-origin assumptions, and clear production hardening notes. |
| Prompt caching silently fails | Medium | Keep cached prefix stable, avoid timestamps/UUIDs/random key order before the breakpoint, and inspect cache usage during development. |
| API boundary increases project complexity | Medium | Keep server route small and feature-scoped; avoid adding persistence, auth, queues, or workflow execution in this milestone. |
| Generated draft breaks existing role/process views | Medium | Normalize to the existing `ProcessMap` and validate with existing role/process derivation tests. |
| UI drifts into a generic form/dashboard | Medium | Keep review surface map-first and alignment-focused with scenario, actors, activity sequence, handoffs, and uncertainty. |
| App top-level tabs regress accessibility | Low | Extend existing tab tests for three tabs, `aria-controls`, hidden tabpanels, keyboard navigation, and focus states. |

## Acceptance

- [x] Scenario input, Claude output, API response, and generated draft types/schemas are explicit and readable.
- [x] The browser never calls Claude directly and never has access to `ANTHROPIC_API_KEY`.
- [x] The server calls Claude through the official `@anthropic-ai/sdk` TypeScript SDK using `claude-opus-4-8`, adaptive thinking, and structured outputs.
- [x] Prompt assembly separates stable cached instructions from volatile scenario input and avoids cache invalidators before the breakpoint.
- [x] Generated draft includes candidate activity sequence, decisions, input-output flow, responsibilities, handoffs, work products, expectations, missing information, assumptions, and risk points.
- [x] Claude output is validated and normalized into the shared `ProcessMap` model plus sidecar source/uncertainty metadata.
- [x] User-provided, model-inferred, and system-derived content are distinguishable.
- [x] Invalid/incomplete user input produces user-facing validation findings rather than runtime crashes.
- [x] Missing API key, API failure, refusal, malformed output, and rate/overload errors produce safe user-facing messages without leaking secrets or raw stack traces.
- [x] ScenarioGeneration UI lets users enter scenario details and request an LLM-assisted draft map.
- [x] Generated draft preview is map-first, draft-labeled, and does not look like a generic task tracker.
- [x] Existing Role navigation and Multi-role process views continue to work.
- [x] App-level tabs remain keyboard-accessible with three sections.
- [x] Unit/component tests cover validation, prompt assembly, mocked Claude generation, normalization, and UI behavior.
- [x] Playwright E2E covers the scenario-to-map generation journey with a mocked model response.
- [x] Automated tests do not require a live Claude API key.
- [x] `npm run lint`, `npm test`, `npm run build`, and `npm run test:e2e` pass.
- [x] TypeScript/React, accessibility, security, and general code reviews find no blocking critical/high issues before marking complete.

## Not Included in This Milestone

- Direct browser-to-Claude calls
- Non-Anthropic model providers or OpenAI-compatible shims
- Managed Agents or multi-agent generation workflows
- Persistence or saved drafts
- Collaborative editing workspace
- All-party confirmation workflow
- Approval workflow
- Impact analysis workflow
- Process replacement workflow
- User authentication
- Workflow automation, task execution, or issue tracking
- Live API calls in default automated tests
