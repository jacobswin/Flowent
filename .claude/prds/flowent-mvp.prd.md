# Flowent MVP

## Problem
Product teams experiencing rapid growth develop inconsistent understandings of how work should move from discovery through delivery. The cost is delivery deviation, unclear handoffs, ambiguous ownership, and process knowledge trapped in scattered docs, boards, or informal habits.

Flowent should give teams a map-first way to design, execute, measure, and improve their product delivery process without becoming a generic task tracker. During work discussions, teams should be able to provide roles, stakeholders, upstream and downstream users, inputs, outputs, activities, decisions, and a scenario so Flowent can generate a draft process map for collaborative review, consensus, activation, or replacement of an existing map.

Flowent should borrow heavily from mature process-management products such as Stages, especially their metamodel and multi-view process navigation concepts, while making the experience more flexible for everyday R&D team discussions. Flowent Metamodel v0 prioritizes role navigation and multi-role views first, uses scenario-based generation as the entry point, and keeps versioning, approval, and impact analysis as lightweight activation governance.

## Evidence
- Assumption — needs validation via target-user interviews, review of existing process artifacts, benchmarking mature process-map products, and a prototype using one real product delivery process.

## Users
- **Primary**: R&D team members working across product management, design, engineering, QA, and delivery roles during discovery-to-release work.
- **Secondary**: Product managers, project managers, process owners, quality stakeholders, and functional leads who need different views of the same process map.
- **Not for**: Teams looking primarily for issue tracking, sprint planning, generic task management, workflow automation, process mining, or heavy compliance governance.

## Hypothesis
We believe **a generated, living process-map lifecycle that lets R&D teams turn roles, stakeholders, upstream/downstream users, inputs, outputs, activities, decisions, and work scenarios into collaborative draft maps, then reach all-party consensus and activate or replace maps with versioning, approval, and impact analysis** will **reduce misalignment around stages, handoffs, responsibilities, decisions, and expectations** for **cross-functional product teams**.
We'll know we're right when **team members can use Flowent to generate or refine a process map during discussion, get every relevant party to confirm it, and explain where work is, who owns the next step, what inputs and outputs are expected, what decision is needed, and what good completion looks like faster and more consistently than with their current process documentation**.

## Success Metrics
| Metric | Target | How measured |
|---|---|---|
| Process comprehension | TBD — needs validation via prototype study | Compare participant answers using Flowent vs current process docs/whiteboards |
| Consensus readiness | TBD — needs validation via collaborative prototype | Observe whether all relevant parties can confirm a generated or manually refined draft map for activation |
| Ownership and handoff clarity | TBD — needs validation via user research | Ask participants to identify responsible roles, upstream/downstream users, inputs, outputs, decisions, and next handoff points on a real process |
| Reference-model fit | TBD — needs validation via Stages and process-map product benchmarking | Compare Flowent's metamodel against selected mature process-management and process-map products |

## Scope
**MVP** — Create a role-first process-navigation prototype where R&D team members can understand what their role must do, provide, receive, decide, confirm, or approve within a shared process map. The prototype should support scenario-based draft generation from roles, stakeholders, upstream/downstream users, inputs, outputs, activities, decisions, and a work scenario; collaborative refinement in a temporary workspace; role-specific and stakeholder-specific views; and activation or replacement after all relevant parties confirm consensus, with lightweight versioning, approval, and impact analysis.

**Out of scope**
- Generic task tracking, kanban, sprint planning, or issue tracking — deferred to avoid collapsing Flowent into an existing work-management category.
- Workflow automation, integrations, triggers, or synchronization — deferred until the core process-map model is validated.
- Deep bottleneck analytics or process mining — deferred until the product has reliable process structure and usage data.
- Heavy compliance governance, audit evidence generation, or enterprise reference-model certification — deferred to keep the MVP flexible for R&D team discussions while preserving a reference-informed model.

## Delivery Milestones
<!-- Business outcomes, not engineering tasks. /plan turns each into a plan. -->
<!-- Status: pending | in-progress | complete -->

| # | Milestone | Outcome | Status | Plan |
|---|---|---|---|---|
| 1 | Flowent Metamodel v0 | Flowent has a confirmed role-first, multi-view vocabulary covering workspace, process map, scenario, role, stakeholder, upstream/downstream actor, activity, decision, input, output, work product, handoff, expectation, view, draft map, active map, version, confirmation, approval, and impact analysis | complete | [Metamodel v0 design](../../docs/superpowers/specs/2026-05-28-flowent-metamodel-v0-design.md) |
| 2 | Role-first navigation | R&D team members can understand what their role must do, what inputs they need, what outputs they produce, who they depend on, who depends on them, and which decisions affect their work | complete | [Role-first navigation plan](../plans/role-first-navigation.plan.md) |
| 3 | Multi-role process views | Product/project managers, process owners, quality reviewers, and stakeholders can view the same process map through their own responsibilities and concerns | complete | [Multi-role process views plan](../plans/multi-role-process-views.plan.md) |
| 4 | Scenario-to-map generation | An R&D team can input roles, stakeholders, upstream/downstream users, inputs, outputs, activities, decisions, and a work scenario to receive a useful LLM-assisted draft process map for discussion | complete | [Scenario-to-map generation plan](../plans/scenario-to-map-generation.plan.md) |
| 5 | Temporary collaborative workspace | A team can refine an unsatisfactory generated map or create a new map while discussing the work | complete | [Temporary collaborative workspace plan](../plans/temporary-collaborative-workspace.plan.md) |
| 6 | All-party consensus activation | Every relevant party can confirm a process map, after which the team can activate it or replace the previous version with approval and impact context | complete | [All-party consensus activation plan](../plans/all-party-consensus-activation.plan.md) |
| 7 | Validation prototype | One realistic process can be tested against current documentation for comprehension, consensus, and alignment | complete | [Validation prototype plan](../plans/validation-prototype.plan.md) |

## Open Questions
- [x] Which Stages concepts should Flowent borrow directly, and which should be simplified for flexibility? Answered in [Metamodel v0 design](../../docs/superpowers/specs/2026-05-28-flowent-metamodel-v0-design.md): borrow process elements, relationships, views, versions, workspaces, and readiness concepts while simplifying for role navigation, discussion, consensus, and lightweight activation.
- [x] Which objects and relationships are essential for a useful Flowent process map, including scenarios, generated drafts, temporary workspaces, consensus, activation, versions, approvals, impact analysis, and replacement? Answered in [Metamodel v0 design](../../docs/superpowers/specs/2026-05-28-flowent-metamodel-v0-design.md).
- [x] Which role-specific views are required first for R&D team members, product managers, project managers, process owners, and quality stakeholders? Answered in [Metamodel v0 design](../../docs/superpowers/specs/2026-05-28-flowent-metamodel-v0-design.md).
- [ ] How much execution support belongs in the MVP before Flowent starts behaving like a task tracker?
- [ ] What level of approval and impact analysis is enough for safe activation without becoming heavyweight governance?

## Risks
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Flowent becomes too similar to task-management tools | Medium | High | Keep the MVP focused on process-map comprehension and alignment, not task ownership or issue execution |
| Generated maps are untrusted or too generic | Medium | High | Require collaborative refinement and confirmation from all relevant parties before activation |
| Activation becomes too heavyweight for R&D team discussions | Medium | High | Include versioning, approval, and impact analysis, but keep compliance governance and audit evidence out of MVP |
| The metamodel is too abstract for teams to adopt | Medium | High | Validate with one realistic product delivery process and real team language |
| Reference products bias the design toward diagramming or enterprise compliance instead of flexible process development | Medium | Medium | Borrow Stages-like metamodel concepts while preserving Flowent's discussion, consensus, and alignment focus |
| The problem is not painful enough to justify a new tool | Unknown | High | Treat evidence as an assumption and validate through interviews, artifact review, and prototype testing |

---
*Status: COMPLETE — All 7 MVP milestones are complete: Metamodel v0, Role-first navigation, Multi-role process views, Scenario-to-map generation (LLM-assisted), Temporary collaborative workspace, All-party consensus activation, and Validation prototype.*
