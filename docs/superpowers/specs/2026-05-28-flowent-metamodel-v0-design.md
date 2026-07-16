# Flowent Metamodel v0 Design

## Purpose

Flowent Metamodel v0 defines the product vocabulary for a role-first, multi-view process map system for R&D teams. It adapts structured process-management concepts for flexible work discussions, generated draft maps, collaborative consensus, and lightweight activation governance.

The v0 priority is **role navigation and multi-role views**. Scenario-based generation is the entry point, and versioning, approval, and impact analysis provide lightweight governance when a draft map becomes official.

## Design Direction

Flowent should be a process navigation system, not a generic diagramming tool or task tracker.

The primary model direction is:

- **Role navigation first**: users start from what their role must do, provide, receive, decide, confirm, or approve.
- **Multi-view process map**: the same process map supports different views for R&D members, product/project managers, process owners, quality/review stakeholders, and external stakeholders.
- **Scenario-to-map generation**: users describe a work scenario, roles, stakeholders, inputs, outputs, activities, decisions, and upstream/downstream users; Flowent generates a draft process map.
- **Consensus before activation**: generated maps enter a temporary workspace and only become active after all relevant parties confirm, required approval is given, and impact is understood.
- **Lightweight governance**: versioning, approval, and impact analysis exist to prevent confusion, not to impose heavy compliance workflows in v0.

## Core Objects

| Object | Meaning |
|---|---|
| Workspace | A team or process space containing draft maps, active maps, versions, and collaborative discussion. |
| Process Map | A living process model that can be generated, edited, viewed, confirmed, activated, versioned, or replaced. |
| Scenario | The concrete work situation that triggers process-map generation. |
| Role | A responsibility identity in the process, such as developer, tester, product manager, project manager, quality reviewer, or approver. |
| Stakeholder | A person, team, or function affected by the process but not necessarily performing activities. |
| Upstream Actor | A source of required input, context, work product, or decision. |
| Downstream Actor | A recipient or dependent user of process outputs. |
| Activity | A unit of work performed in the process. |
| Decision | A judgment point, approval point, routing point, or agreement point that affects process flow. |
| Input | Information, material, decision, request, work product, or dependency needed before an activity can proceed. |
| Output | Information, material, decision, work product, or handoff produced by an activity. |
| Work Product | A durable artifact that can be created, modified, reviewed, confirmed, released, or used as milestone evidence. |
| Handoff | A transfer of responsibility, input, output, or expectation between roles, teams, or upstream/downstream actors. |
| Expectation | A completion standard, quality bar, responsibility expectation, or acceptance condition. |
| View | A derived navigation surface for a specific role or user perspective. |
| Draft Map | A generated or manually created process map that is not yet official. |
| Active Map | The currently official process map for a scenario, team, or process context. |
| Version | A baseline of a process map, including draft, active, replaced, and historical versions. |
| Confirmation | A relevant party's explicit agreement that the draft process map matches their understanding and responsibility. |
| Approval | Formal permission to activate a confirmed map or replace an active version. |
| Impact Analysis | A summary of what changes when a map is activated or replaces a previous version. |

## Key Relationships

### Workspace to Process Map

A workspace contains multiple process maps:

- generated draft maps
- manually created draft maps
- active maps
- replaced maps
- historical versions

The workspace is the collaboration container. It is not owned by one user; it represents a team or process context.

### Scenario to Draft Process Map

A scenario is the generation entry point. Users provide known process context, and Flowent creates a draft process map. The draft map can be discussed and refined but is not official.

### Process Map to Activities, Decisions, and Handoffs

A process map consists of activities, decisions, and handoffs connected by sequence, dependency, and input-output relationships.

- Activities define work to be done.
- Decisions define judgment or routing points.
- Handoffs define transitions between roles, teams, or upstream/downstream actors.

### Activity to Role and Stakeholder

Each activity should support lightweight RASIC-inspired responsibility relationships:

- responsible: does the work
- accountable or approver: owns correctness or approval
- supporting: helps complete the work
- consulted: provides input or judgment
- informed: needs visibility

Flowent may expose these labels in more natural product language, but the underlying model should support this responsibility distinction.

### Activity to Input, Output, and Work Product

Each activity can require inputs, produce outputs, and create, modify, review, release, or consume work products. Outputs should connect to downstream actors, later activities, or handoffs.

### Role to Role View

A role view is derived from relationships in the process map. It should answer:

- Which activities involve me?
- What am I responsible for?
- What inputs do I need?
- What outputs do I provide?
- Who provides my inputs?
- Who receives my outputs?
- Which decisions affect me?
- Which confirmations or approvals need me?
- What expectations define good completion?

### Draft Map to Active Map

A draft map becomes active only after:

1. relevant parties confirm it;
2. required approval is completed;
3. impact analysis is captured;
4. a version is created;
5. the map is activated or replaces the previous active version.

## Role Views

### R&D Team Member View

The core user view. It should prioritize:

- activities involving the user's role
- required inputs
- expected outputs
- upstream dependencies
- downstream recipients
- decisions affecting the user's work
- handoff expectations
- confirmation responsibilities
- current map state: draft, awaiting confirmation, approved, active, or replaced

### Product or Project Manager View

This view should prioritize:

- process start and end points
- participating roles and stakeholders
- unclear or risky handoffs
- blocked confirmations
- active version status
- readiness to use the process in real work

### Process Owner View

This view should prioritize process completeness:

- activities without responsible roles
- inputs without upstream actors
- outputs without downstream actors
- decisions without decision criteria
- missing expectations
- pending approvals
- impact of replacement

### Quality or Review View

This view should prioritize clarity and reviewability:

- key activities with completion standards
- work products requiring review or confirmation
- decision points with rationale
- version and confirmation records
- high-risk handoffs
- unconfirmed stakeholders

### Stakeholder View

This view should prioritize why the stakeholder is involved:

- where they are consulted, informed, or asked to confirm
- which outputs affect them
- which decisions require their input
- what responsibility or expectation they accept after activation

## Scenario Generation Model

### Scenario Input

Scenario input should include:

- work scenario description
- current problem or goal
- trigger condition
- roles involved
- stakeholders involved
- upstream actors
- downstream actors
- known inputs
- expected outputs
- known activities
- known decisions

If users do not know the full process, Flowent can infer candidate activities, decisions, handoffs, expectations, and missing information.

### Generated Draft Output

The generated draft map should include:

- candidate activity sequence
- candidate decisions
- input-output flow
- role responsibilities
- upstream/downstream handoffs
- work products
- expectations
- required confirmations
- missing information
- uncertain assumptions
- risk points

### Uncertainty Handling

Generated maps must show which parts are user-provided and which parts are inferred. Flowent should expose uncertainty instead of presenting generated content as final truth.

The draft should identify:

- inferred activities
- user-provided activities
- activities without responsible roles
- activities missing inputs or outputs
- unconfirmed handoffs
- assumptions requiring stakeholder confirmation

## Consensus and Activation Model

### Draft States

Draft maps can move through these states:

1. **Generated**: created by the system from scenario input.
2. **In Discussion**: being reviewed and edited in a temporary workspace.
3. **Ready for Confirmation**: considered structurally ready for all-party confirmation.
4. **Confirmed**: all relevant parties have confirmed the draft.
5. **Approved**: required approvers have approved activation.
6. **Activated**: the map is now active or has replaced a previous version.
7. **Rejected**: the draft is explicitly rejected.
8. **Superseded**: another draft has replaced it before activation.

### All-Party Confirmation

Consensus means all relevant parties have explicitly confirmed the draft map.

Each confirmation should record:

- confirming person or team
- represented role or stakeholder
- confirmed draft version
- timestamp
- comment or reservation, if any

### Approval

Approval is separate from confirmation. Confirmation means the relevant parties agree that the map reflects the process. Approval means the map is permitted to become official.

v0 approval should remain lightweight:

- whether approval is required
- who approves
- approval state
- approval comment
- approval timestamp

### Impact Analysis

Activation or replacement should include an impact summary:

- affected roles
- added, removed, or changed activities
- changed decisions
- changed inputs and outputs
- changed handoffs
- changed work products
- changed expectations
- replaced version, if any
- parties that confirmed the change
- approver and approval summary

The v0 model only needs to support capturing and displaying this information. It does not need advanced automated dependency analysis.

### Versioning and Replacement

Each activation creates a version baseline. A version should capture:

- draft version
- active version
- replaced version, if any
- change summary
- confirmation record
- approval record
- impact summary

When a new map replaces an old active map:

- the old map becomes superseded
- the new map becomes active
- replacement reason is recorded
- impact analysis is retained
- confirmation and approval records are retained

## Boundaries for v0

### In Scope

- Role-first navigation model
- Multi-view process map model
- Scenario-based draft generation model
- Temporary collaborative workspace model
- All-party confirmation model
- Lightweight activation, versioning, approval, and impact analysis model

### Out of Scope

- Generic task tracking
- Sprint planning or kanban workflow management
- Workflow automation and integrations
- Heavy enterprise compliance evidence generation
- Full process mining or bottleneck analytics
- Complex approval routing engines
- Automated dependency impact calculation beyond simple summaries

## Validation Criteria

Metamodel v0 is successful if a realistic R&D work scenario can be represented well enough that each relevant role can answer:

- What do I do?
- What do I need before I start?
- What do I produce?
- Who do I depend on?
- Who depends on me?
- What decisions affect the work?
- What must be confirmed before this process becomes official?
- What changed from the prior active version?

---

Status: Draft design. Implementation planning should start only after this design is reviewed and accepted.
