# Flowent README Maintenance Design

Date: 2026-07-16
Status: Approved for implementation

## Purpose

Keep the public project overview aligned with the product that is actually in
`main`, and prevent functional changes from being pushed without a corresponding
README review.

The README will remain primarily English for GitHub readers, with a concise
Chinese introduction at the top. It must not contain legacy product references
that are no longer part of Flowent's positioning.

## README Structure

The README will be rewritten around the current product rather than preserving
the early prototype outline. Its sections will be:

1. Chinese summary and English product positioning.
2. Current capabilities, including the visual canvas, shared element library,
   AI generation, Flow and Swimlane views, Stage containers, Process
   Intelligence, and multi-format export.
3. Core modeling concepts: Map, Process, Activity, Role, Work Product, Stage,
   Guidance, and Milestone.
4. AI provider setup, supported source files, data flow, and privacy boundaries.
5. Local development, production build, tests, and deployment notes.
6. Current architecture and persistence model.
7. Current plan, containing a short ordered list of active product priorities.
8. TODO, containing concrete unchecked work items only.
9. Quality status and known limitations.
10. A before-pushing checklist covering README review, tests, secrets, and local
    runtime data.

Completed work belongs in Current capabilities, not in TODO. Plan and TODO must
describe the repository state at the time of the push and must avoid unsupported
delivery dates or promises.

## Push Guard

A repository-managed pre-push hook will call a Node.js validation script. The
script will inspect the commits being pushed and determine whether functional
project files changed. Functional paths include application code, server code,
tests, package metadata, build configuration, and public assets.

When functional files changed, at least one commit in the same pushed range must
also change `README.md`. Otherwise the push is rejected with a concise message
that explains how to review and update the README.

The guard will not require a README change for documentation-only pushes,
runtime data, generated output, or repository metadata that does not alter the
product. A zero remote SHA, used for a new branch, will be handled by comparing
the pushed commit with its available history instead of failing unexpectedly.

The hook will be stored in `.githooks/pre-push` and delegate all Git inspection
to `scripts/check-readme-before-push.mjs`. A package script will configure
`core.hooksPath=.githooks` for the current clone. The Flowent Debian clone will
be configured during implementation; new clones can enable the same guard with
the documented npm command.

## Components

- `README.md`: authoritative product overview, plan, TODO, quality status, and
  push checklist.
- `scripts/check-readme-before-push.mjs`: cross-platform validation logic with
  deterministic exit codes and actionable output.
- `.githooks/pre-push`: minimal shell entry point that forwards Git's stdin and
  arguments to the Node script.
- `package.json`: exposes a setup command for the managed hooks and a direct
  README validation command for troubleshooting.
- Unit tests for the validation script: cover functional changes, README
  changes, documentation-only changes, new refs, deleted refs, and multiple ref
  updates.

## Data Flow

Git invokes the pre-push hook with local and remote refs. The hook passes this
input to the Node script. For each non-deletion update, the script computes the
changed paths in the outgoing commit range. It succeeds when there are no
functional changes or when `README.md` is present in that range. It exits
non-zero before any network update when functional changes lack a README review.

The script reads Git metadata only. It does not modify commits, working files,
runtime library data, credentials, or the remote repository.

## Failure Handling

- Missing Node or Git produces a direct setup error.
- An unreadable ref range produces a safe failure with the affected ref named.
- A deleted remote ref is ignored because it does not upload a new product
  state.
- A user may bypass a Git hook with Git's standard mechanisms, but the README
  will document that bypassing the guard is reserved for emergency repository
  recovery and requires a follow-up README review.

## Verification

Implementation is complete when:

- The rewritten README accurately describes the current `main` capabilities,
  scripts, architecture, data handling, plan, TODO, and limitations.
- The validation tests pass for all specified push scenarios.
- The setup command enables `.githooks` in a clean clone and is idempotent.
- A simulated functional push without a README change is rejected.
- A simulated functional push with a README change succeeds.
- Documentation-only pushes succeed without unnecessary README edits.
- Existing lint, build, and relevant test commands continue to pass.

## Scope

This change maintains project documentation and a local pre-push guard. It does
not introduce release automation, changelog generation, semantic versioning, or
GitHub branch protection. Those can be added later if Flowent adopts a formal
release process.
