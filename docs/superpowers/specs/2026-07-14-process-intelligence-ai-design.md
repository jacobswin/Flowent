# Flowent AI Process Intelligence Design

## Goal

Bring the installed `process-mapper` method into Flowent's end-user AI
workflow. Flowent should identify measurable process stages, distinguish
value-add, wait, and rework, and surface cycle-time and bottleneck findings
without inventing operational data.

This is an application feature. The installed Agent Skill remains a reference
for the analysis method; Flowent implements the deterministic logic in
TypeScript rather than invoking the skill's Python scripts at runtime.

## User Experience

The existing Generate with AI dialog gains a compact **Process intelligence**
section: a Software / Services / Manufacturing / Healthcare profile selector
(Software default), an optional WIP field, and a notice that timing conclusions
use supplied measurements only.

The preview reports measured and missing stages, P50/P90 only when all stage
values are valid, value-add/wait/rework composition, a PCE verdict, throughput
when WIP exists, and ranked findings. If data is incomplete, it names the data
gaps and suppresses aggregate time claims instead of guessing.

After applying a map, the current left-side Process Status area shows that
summary. Selecting a finding selects and briefly highlights its Activity.
Activity editing exposes stage kind, P50, and P90; changes recompute the
summary immediately. The canvas stays an Activity mainline: analysis never
creates speculative bottleneck nodes, branches, gateways, or loops.

## Data Design

Measurements are map-Activity metadata, not shared-Activity metadata: a
reusable Activity can have different timing in different Processes.

```ts
type ProcessStageKind = 'value-add' | 'wait' | 'rework'

type ProcessStageData = {
  kind: ProcessStageKind
  durationMinutesP50?: number
  durationMinutesP90?: number
  classificationSource: 'explicit' | 'inferred'
}

type ProcessAnalysisSettings = {
  profile: 'saas' | 'services' | 'manufacturing' | 'healthcare'
  wip?: number
}
```

`GraphNode` gains optional `processStage`; `GraphDocument.meta` gains optional
`processAnalysis`. AI drafts carry equivalent optional fields and the
normalizer maps them to GraphDocument. Old maps omit these fields and retain
current behaviour.

The prompt preserves the existing activity mainline, RASIC, and input/output
work products. It classifies wait or rework only with source evidence, may mark
ordinary work as inferred value-add, copies P50/P90/WIP only when explicit, and
omits unknown measurements. The fallback parser can classify obvious
wait/rework terms but never invents durations or WIP.

## Deterministic Analysis

A framework-free shared TypeScript module is used by server preview and client
Process Status. It ports the installed skill's rules; computed totals are
derived, never persisted.

When every stage has valid P50/P90 (`P90 >= P50`), Flowent calculates total
P50/P90, value-add P50, PCE, and WIP / total-P50 throughput. It ranks: R1 slow
stages relative to mean value-add duration, R2 excessive wait share, and R3
excessive rework share. Findings include linked Activity IDs and evidence.

| Profile | R1 | R2 wait | R3 rework | Healthy PCE | Typical PCE |
| --- | ---: | ---: | ---: | ---: | ---: |
| Software | 2.0 | 40% | 15% | 25% | 10% |
| Services | 2.5 | 50% | 15% | 20% | 8% |
| Manufacturing | 1.8 | 30% | 10% | 35% | 15% |
| Healthcare | 2.5 | 55% | 12% | 20% | 8% |

Incomplete or invalid timing produces data gaps, not bottleneck claims or
time-based verdicts. Stage classification still appears without timing data.

## Persistence and Compatibility

GraphDocument serialization and the server library schema accept the optional
node and metadata fields. Existing maps, shared elements, AI providers, and
provider keys are unchanged. This feature adds neither a runtime Python
dependency nor an external service.

## Test Strategy

- Unit test normalization, thresholds, PCE, R1/R2/R3, Little's Law, invalid
  values, and incomplete data handling.
- Test AI prompt/normalizer behaviour for explicit timing, inferred kinds,
  unknown data, and activity-only output.
- Test persistence and backwards-compatible deserialization.
- Component-test AI controls/preview, Process Status, finding selection, and
  Activity timing fields.
- E2E-test a measured manufacturing flow and unmeasured pasted text, then
  refresh to verify persistence.
- Regress existing AI, canvas, Flow/Swimlane, export, and library workflows.

## Non-goals

- No runtime execution of the installed skill or its Python scripts.
- No fabricated times, WIP, bottlenecks, owners, or operational changes.
- No full BPMN, process mining, branch reconstruction, or changes to the
  activity-mainline policy.
- No shared timing model for reusable Activities; timing stays map-specific.
