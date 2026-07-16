# Flowent AI Process Intelligence Implementation Plan

> Execute from the approved design in
> `docs/superpowers/specs/2026-07-14-process-intelligence-ai-design.md`.

## 1. Analysis core

Create a framework-free `processIntelligence` module under the canvas
diagnostics feature. Define profile settings, stage data, valid-duration
guards, PCE, throughput, data gaps, and R1/R2/R3 findings. Write tests first
for complete, incomplete, and invalid process data.

## 2. Graph and persistence

Add optional per-node stage metadata and optional document analysis settings.
Extend command patches, GraphDocument serialization, and library Zod schemas.
Add backwards-compatibility and round-trip tests.

## 3. AI draft normalization

Extend the AI draft schema with optional analysis settings and per-activity
stage data. Update the generation prompt and normalizer to preserve only
evidence-supported values. Return the derived analysis with the preview.
Test explicit, inferred, and missing measurement cases.

## 4. Activity editing

Add an Activity editor section for stage class, P50, and P90. Keep updates in
the existing `updateNodeData` transaction path. Test valid updates and the
clear-to-unknown state.

## 5. Process Status and AI preview

Render a reusable Process Intelligence summary in the left Process Status
area and the AI preview. Make findings select/highlight their Activity. Add
the profile and optional WIP fields to Generate with AI.

## 6. Verification

Run focused Vitest suites after each layer, then `npm test`, `npm run build`,
and `npm run lint`. Run E2E only after the functional suites are green.
