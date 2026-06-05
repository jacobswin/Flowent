# Flowent Canvas Builder Concept Design

**Date**: 2026-06-04  
**Project**: Flowent  
**Status**: Approved for Canvas Builder Foundation implementation  
**Source reference**: Creately flowchart-building flow, translated into Flowent's process-map development concept

## 1. Purpose

This concept incorporates the useful parts of Creately's flowchart-building workflow into Flowent's product direction without turning Flowent into a generic flowchart tool.

Creately's workflow is valuable because it makes diagram creation feel immediate:

1. start a clean flowchart
2. build the flow with quick-create and drag-and-drop shapes
3. keep it readable with auto layout and connector routing
4. review with teammates through permissions, comments, and version history
5. export or share with stakeholders

Flowent should borrow that canvas fluency, but apply it to process development for product and R&D teams. The goal is not just to draw boxes and arrows. The goal is to help teams quickly create readable process maps that clarify ownership, handoffs, decisions, expectations, bottlenecks, and alignment.

## 2. Concept Statement

Flowent should feel as fluid as a modern flowchart builder, but every canvas interaction should create a better process map, not just a diagram.

Flowent is a map-first process development canvas for product teams. It combines fast flowchart-style map creation with process-specific semantics—roles, handoffs, decisions, expectations, versioning, and activation—so teams can quickly build readable maps and turn them into shared process alignment.

In short:

> Fast diagramming mechanics, process-specific meaning, and alignment-first collaboration.

## 3. Product Positioning

Flowent should absorb Creately's ease-of-use pattern at the canvas level while preserving Flowent's differentiator:

- Creately helps people make diagrams.
- Flowent helps product teams develop, agree on, and improve how work moves.

This means Flowent's builder should prioritize canvas speed and clarity, but the elements on the canvas should be process-specific objects rather than generic flowchart symbols.

The product direction becomes:

> Let teams create process maps as quickly as a flowchart, then enrich those maps with the roles, expectations, decisions, handoffs, and review states that make them operationally useful.

## 4. Experience Pillars

### 4.1 Fast Process-Map Creation

Inspired by Creately steps 1 and 2.

Flowent should let users start creating immediately from a blank map, template, or AI-generated draft. The first useful map should not require understanding a complex configuration model.

Core product ideas:

- blank map entry point for fast exploration
- template entry point for common product/R&D process patterns
- AI draft entry point for scenario-to-map generation
- quick-create from a selected node to create the next node and connector in one action
- drag-and-drop process element library
- keyboard-first creation shortcuts
- fast connector creation from ports or connector mode

The element library should use Flowent semantics instead of generic diagramming semantics:

- Stage
- Activity
- Decision
- Handoff
- Start / End
- Role / Owner
- Expectation
- Bottleneck marker

Guiding principle:

> Adding to the map should feel lightweight; adding meaning to the process should feel native.

### 4.2 Readability as the Map Grows

Inspired by Creately step 3.

Creately emphasizes auto layout and connector routing because flowcharts become hard to read as they expand. Flowent should treat readability as a core product capability, not visual polish.

Core product ideas:

- auto layout for reorganizing the map after major edits
- connector routing and cleanup for readable handoffs
- alignment and spacing tools
- zoom, pan, fit-to-view, and responsive wheel/keyboard zoom
- selection, marquee selection, and multi-drag for restructuring
- visual distinction between activities, decisions, handoffs, and stages
- optional future focus modes for large maps

Future readability modes may include:

- highlight one role's path through the process
- highlight handoff chain
- show only decision points
- show only bottlenecks or unclear ownership
- collapse or expand stages

Guiding principle:

> A Flowent map is only useful if the team can still read it after the process becomes real.

### 4.3 Process-Specific Editing, Not Generic Diagramming

This is the key distinction from Creately.

Flowent should not expose only shapes, labels, line styles, and generic comments. It should expose process concepts that product teams need in order to align.

Each node or edge type should have a focused editor:

- Activity editor: title, summary, responsible roles, expectations
- Decision editor: question, criteria, owner, possible outcomes
- Handoff editor: from role, to role, artifact, expectation, readiness signal
- Stage editor: goal, entry condition, exit condition, owner or accountable group
- Bottleneck marker: symptom, impact, suspected cause, review status

The editing experience should make semantic fields easier to capture than generic visual styling.

Guiding principle:

> Flowent should make process semantics easier to capture than generic shape styling.

### 4.4 Team Review Built Around Alignment

Inspired by Creately step 4, but translated into Flowent's alignment use case.

Creately's review model is about sharing, comments, permissions, and version history. Flowent should support those mechanics, but the review language should focus on process alignment.

Review should help teams answer:

- Who owns this step?
- Is this handoff clear?
- What artifact or expectation moves across this handoff?
- Who makes this decision?
- What happens when the decision goes each way?
- Where is work likely to wait, loop, or fall through the cracks?
- Does everyone agree this map reflects how the process should work?

Core product ideas:

- comments on nodes, edges, stage areas, or map versions
- review labels such as unclear, disputed, needs owner, approved, or changed since approval
- version history as a record of process evolution, not just file history
- role-based review views for owners, contributors, and stakeholders
- consensus checkpoints before activation

Guiding principle:

> Review is not diagram feedback; it is process alignment work.

### 4.5 Share, Export, and Activate

Inspired by Creately step 5.

Creately ends with export or share. Flowent should support share links and exports, but the Flowent-specific endpoint is activation: turning a draft map into the current agreed process.

Core product ideas:

- share link for fast stakeholder access
- read-only stakeholder view
- PDF, PNG, or SVG export for docs and reviews
- activation flow for agreed process maps
- version snapshot when a map is activated
- impact summary when an activated map changes

Activation should make the map useful beyond documentation. Once activated, the map becomes the reference point for execution, measurement, and improvement.

Guiding principle:

> Sharing communicates the map; activation turns it into the agreed process.

## 5. Translated Creately Workflow for Flowent

The Creately workflow can be rewritten as a Flowent user journey:

### Step 1: Start a Process Map

Create a blank process map, start from a product/R&D template, or generate a draft from a scenario so the team has a clean starting structure from day one.

### Step 2: Build the Flow

Use quick-create to add the next stage, activity, decision, or handoff with a connector in one action. Use the process element library to add additional semantic elements with drag-and-drop.

### Step 3: Keep the Map Readable

Use auto layout, connector routing, zoom, alignment, and grouping tools to keep the map understandable after larger edits. The map should make ownership, sequencing, dependencies, and handoffs obvious.

### Step 4: Review with the Team

Invite teammates to comment on unclear responsibilities, missing expectations, disputed decisions, and risky handoffs. Use review states and version history to track how the process changes as the team aligns.

### Step 5: Share, Export, or Activate

Export the map for documentation, share a stakeholder link, or activate it as the team's current agreed process. Activated maps become the basis for execution, measurement, and continuous improvement.

## 6. Development Direction

This concept should guide Flowent development in five phases.

### Phase 1: Canvas Creation Quality

Priority: make process-map creation feel fast and direct.

Candidate work:

- quick-create from selected nodes
- process element library
- drag-to-add node
- connector creation polish
- keyboard-first creation shortcuts
- starter templates
- clear empty state for creating the first map

### Phase 2: Canvas Readability

Priority: keep larger maps legible.

Candidate work:

- auto layout improvements
- connector routing cleanup
- alignment tools
- zoom and pan polish
- stage grouping or swimlanes
- role and handoff highlighting
- fit-to-view and focus selection commands

### Phase 3: Process Semantics

Priority: make every map object carry useful process meaning.

Candidate work:

- stronger typed node editors
- role tags
- handoff expectations
- decision outcomes
- entry and exit criteria
- bottleneck markers
- process-specific validation warnings

### Phase 4: Review and Activation

Priority: turn maps into agreed process artifacts.

Candidate work:

- node and edge comments
- review labels
- version history
- consensus approval
- activation flow
- change impact summary

### Phase 5: Sharing and Export

Priority: communicate the agreed process beyond the editing team.

Candidate work:

- share links
- PDF, PNG, and SVG export
- stakeholder read-only mode
- embedded process snapshots
- export styling optimized for documents and reviews

## 7. Relationship to Current Flowent Work

This concept extends the existing visual canvas direction already captured in the prior canvas redesign work. The current codebase already contains or is moving toward several supporting capabilities:

- PixiJS-backed canvas rendering
- toolbar-driven node creation
- connector mode and connection handles
- auto layout
- undo and redo
- zoom and pan
- marquee selection
- properties panel editing
- library and persistence work in progress

The concept should therefore be used as a product lens for prioritizing canvas polish:

1. If a feature makes map creation faster, it supports the concept.
2. If a feature keeps maps readable as they grow, it supports the concept.
3. If a feature adds process meaning to nodes and edges, it supports the concept.
4. If a feature helps teams review and activate a shared process, it supports the concept.
5. If a feature only improves generic diagram styling without improving process understanding, it should be deprioritized.

## 8. Non-Goals

This concept does not mean Flowent should become a full generic diagramming suite.

Out of scope for this concept:

- general-purpose shape libraries unrelated to process work
- advanced vector drawing tools
- decorative diagram styling as a primary value proposition
- freeform whiteboarding unrelated to process maps
- presentation tooling that does not support process understanding
- prioritizing exports over activation and ongoing process improvement

## 9. Success Criteria

The concept is successful if future Flowent planning and implementation consistently reinforces these outcomes:

- users can start and extend a process map with minimal friction
- common process elements are faster to create than generic shapes
- larger maps remain readable after iterative editing
- roles, handoffs, decisions, and expectations are visible in the model
- team review focuses on alignment gaps rather than cosmetic diagram feedback
- sharing and export communicate the map, while activation captures agreement

## 10. Summary

Creately's useful lesson for Flowent is not simply "build a flowchart editor." The lesson is that process mapping needs low-friction creation, automatic cleanup, collaboration, and stakeholder sharing.

Flowent should adopt those mechanics while making them process-specific:

> Make process-map creation as fast as flowcharting, make process meaning deeper than diagramming, and make team alignment happen through the map itself.
