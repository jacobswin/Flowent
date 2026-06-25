# Flowent Share-by-Link and Comment Surface Design

**Date**: 2026-06-15
**Project**: Flowent
**Status**: Draft for review
**Source reference**: Section 4.5 ("Share, Export, and Activate") of `2026-06-04-flowent-canvas-builder-concept-design.md`

## 1. Purpose and Scope

The canvas builder concept commits Flowent to a share-by-link surface for fast stakeholder access. Stakeholders should be able to open a map in a read-only view, understand ownership, sequencing, handoffs, decisions, and expectations, and feed back on unclear or risky parts without needing an account.

This design covers the first executable slice of that capability:

- A new `?share=:mapId` URL parameter that opens a read-only view of a process map (matching the existing `?map=:mapId` URL convention used by `LibraryGate`)
- A persistent right-side **comment thread panel** anchored to map elements
- Anonymous stakeholder identity (display name + role tag) with no account
- Owner-side comment management inside the existing editor

This design explicitly does **not** cover reply threading, @mentions, email verification, per-link revocation, per-version comment snapshots, or PDF/PNG/SVG export. Those are listed under §10 Out of Scope and are independent subsystems.

The product goal, in the language of the concept design:

> Sharing communicates the map; activation turns it into the agreed process.

This spec delivers the "share" half. Activation is unchanged by this work.

## 2. Confirmed Product Decisions

| Decision | Resolution | Why |
|---|---|---|
| Read-only surface scope | Pan / zoom / focus modes / click-to-inspect element metadata / comment | Matches Creately "stakeholder view" while keeping Flowent read-only-first |
| Stakeholder identity | Anonymous + display name + role tag, stored in `localStorage` | Lowest friction that still preserves "who said this" context for the team |
| Comment lifecycle | Same behavior on draft and activated maps | One share link serves both audiences; activated maps continue to collect feedback on the agreed process |
| Comment visibility | Visible in the share surface **and** inside the editor's properties panel | Closes the loop with the team owner; no context switch needed |
| Share link scope | Map-scoped, follows the latest version | One link per map; matches "follow latest" mental model in Figma/Google Docs "anyone with the link" |
| Comment surface shape | Right-side persistent inline thread panel + per-element count badges | Grouped-by-element threads keep discussions focused; the canvas stays as the primary surface |
| Comment anchor model | `node` / `edge` / `map` (map-wide) | Lets stakeholders comment on cross-cutting concerns, not just individual elements |
| Author actions on comments | Create only; cannot resolve, reopen, edit, or delete | Stakeholders cannot police each other's threads; the owner curates |
| Owner actions on comments | Resolve, reopen, delete (in editor only) | Lets the team curate and absorb feedback without losing it |

## 3. Product Scope (v1)

### In Scope

- A new top-level entry point switched by URL parameter: when `?share=:mapId` is set, the app renders the **share surface** (a read-only view of that map); otherwise it renders the existing editor (when `?map=:mapId` is set) or the library
- One share-link copy affordance in the existing canvas toolbar (next to Export / Activate)
- Per-element comment count badges rendered on the canvas (read-only and editor views)
- A right-side Comments thread panel on the share surface
- The same panel inside the existing editor's Properties panel (as a "Comments" tab/section)
- Anonymous identity: a "Sign in to comment" sheet that asks for name + role tag once per browser, then stores it in `localStorage`
- A "Change" link on the composer to update name/role tag
- Map-wide comments (anchor `kind: 'map'`) for cross-cutting feedback
- Server-side persistence of comments keyed by `mapId`
- The map document continues to follow "latest" — comments are stored per map, not per version snapshot
- E2E test coverage of: share-link entry point, anonymous identity, comment posting, owner resolve/reopen, deletion
- Unit tests for: comment factory, anchor resolution, identity helpers, comment grouping, badge derivation

### Out of Scope

- Reply threading / nested comments
- @mentions, in-app notifications, email
- Account creation, email verification, password reset
- Per-version comment snapshots (the link is "follow latest")
- Per-link revocation, per-link passwords, expiration dates
- Editing a comment after posting
- Stakeholder-as-author resolve / reopen / delete actions
- Real-time collaboration (websocket presence, cursors, live edits)
- PDF, PNG, and SVG export of the share surface
- Embedding share links in iframes on third-party sites
- Map versioning visible to stakeholders

## 4. Information Architecture

### URL Parameters

| URL | Surface | Audience |
|---|---|---|
| `/` or `/?map=:mapId` (existing) | Library rail + editor | Map owner / team |
| **`?share=:mapId`** (new) | Read-only stakeholder view | Anonymous stakeholders |

The current `LibraryGate` already keys off `?map=...` URL params (with a `localStorage` fallback) and re-mounts the canvas host when the map id changes. The new `?share=...` parameter follows the same pattern: when present, the gate renders the share surface instead of the editor, and re-mounts the share host when the map id changes.

`?map=...` and `?share=...` are mutually exclusive — if both are set, `?share=...` wins (the stakeholder surface takes precedence for a link a stakeholder actually clicked).

### Editor vs. Share Surface

| Surface | Toolbar | Canvas | Right panel |
|---|---|---|---|
| Editor (existing) | Owner toolbar (palette, layout, undo/redo, **Share**, Export, Activate, delete) | Full edit (drag, connect, edit) | Properties (current) + **Comments** tab/section |
| Share (new) | Minimal toolbar (focus modes, fit-to-view, identity affordance) | Read-only (pan, zoom, focus, click-to-inspect) | **Comments** (always visible, the primary stakeholder surface) |

The Comments panel itself is a single component reused on both surfaces. The differences are:

- Editor: owner sees Resolve / Reopen / Delete actions on every comment
- Share: stakeholders see no curation actions; they see only their own author tag on each comment

### Comment Anchors

| Anchor kind | Meaning | Example |
|---|---|---|
| `node` | Comment targets one specific node | "Triage stage is missing an owner" |
| `edge` | Comment targets one specific handoff edge | "PM review → Spec: unclear what 'done' means" |
| `map` | Comment targets the whole map | "Where is the post-launch feedback loop?" |

## 5. Interaction Model

### 5.1 Generating a Share Link (Editor)

1. Owner clicks the **Share** button in the existing canvas toolbar.
2. A small popover opens with the share link (a `?share=:mapId` URL on the current origin) and a Copy button.
3. The link is always the same for a given map. It is "follow latest" — the link does not encode a version.
4. The popover also shows the current count of unresolved comments, as a low-key signal that the map is being reviewed.

The Share button does not require any activation or permission check in v1 — anyone with editor access to a map can copy the link. There is no "share token" model; the link is the URL.

### 5.2 Stakeholder First Visit (Share Surface)

1. Stakeholder opens the `?share=:mapId` URL.
2. The map renders in read-only mode. The Comments panel is open on the right by default, with the filter set to "Unresolved."
3. The first time the stakeholder clicks anywhere in the Comments panel composer, a **"Sign in to comment"** sheet appears. The sheet asks for:
   - Display name (required, 1–40 chars)
   - Role tag (free text with a short suggestion list: PM, Design, Eng, QA, EM, Other)
4. The identity is stored in `localStorage` under a per-browser anonymous ID. The stakeholder can update the name/role later via a "Change" link in the composer.
5. After identity is set, the sheet closes and the composer is focused.

The sheet is dismissed with Esc. The stakeholder can browse the map and inspect elements without ever providing identity. Identity is only required to post a comment.

### 5.3 Posting a Comment (Share Surface)

1. Stakeholder clicks a node, edge, or the empty canvas (to anchor to the map).
2. The selected element shows a subtle highlight ring. The Comments panel scrolls to that element's thread.
3. Stakeholder types into the composer and clicks **Post** (or hits Cmd/Ctrl+Enter).
4. The new comment appears at the bottom of the element's thread, with their name + role tag and a relative timestamp.
5. The per-element comment count badge on the canvas updates.

Comments are appended optimistically. A failed post shows a small "Couldn't post — retry" inline state on the comment row.

### 5.4 Posting a Map-wide Comment (Share Surface)

1. Stakeholder clicks the **Comment on the whole map** link in the panel header (or clicks the empty canvas background).
2. The composer is associated with the map anchor.
3. Posting follows the same flow as element-anchored comments.

### 5.5 Owner Side (Editor)

1. Owner opens the existing map at `/?map=:mapId`.
2. The Properties panel now has a **Comments** tab/section alongside the existing element editor.
3. The Comments tab shows the same grouped thread view as the share surface, with three additional actions per comment:
   - **Resolve** (sets `status: 'resolved'`, records `resolvedAt` and `resolvedBy`)
   - **Reopen** (sets `status: 'open'`, clears `resolvedAt` and `resolvedBy`)
   - **Delete** (removes the comment — confirmation required)
4. The canvas shows the same per-element comment count badges. Resolved comments are dimmed but still visible when the filter is set to "All."
5. The owner can also post a comment as themselves. Their name + role tag defaults to a stored owner identity in `localStorage`, but they can change it on the spot.

### 5.6 Filter and Group

The Comments panel has a filter toggle:

- **Unresolved** (default) — only `status: 'open'` comments
- **All** — every comment, with resolved ones dimmed
- **Resolved** — only `status: 'resolved'` comments

Group order is:

1. Element-anchored comments, grouped by element title (sorted by current comment count, descending)
2. Map-wide comments at the bottom, in chronological order

The panel scrolls to the selected element's thread when the stakeholder clicks an element on the canvas.

## 6. Data Model

### 6.1 Comment Type

```ts
type Comment = {
  id: string
  mapId: string
  anchor:
    | { kind: 'node'; nodeId: string }
    | { kind: 'edge'; edgeId: string }
    | { kind: 'map' }
  author: {
    name: string     // 1–40 chars
    role: string     // 1–40 chars, free text
  }
  body: string       // 1–2000 chars
  status: 'open' | 'resolved'
  createdAt: string  // ISO 8601
  resolvedAt?: string
  resolvedBy?: string  // owner display name at time of resolve
}
```

### 6.2 Storage Shape

The existing library API (file-backed JSON served by `server/index.ts`, persisted to `data/library.json`) is extended with a `comments` collection keyed by `mapId`:

```jsonc
{
  "comments": {
    "<mapId>": [
      { "id": "c1", "mapId": "...", "anchor": { "kind": "node", "nodeId": "n1" }, "author": { "name": "Alex", "role": "PM" }, "body": "Unclear owner", "status": "open", "createdAt": "2026-06-15T..." }
    ]
  }
}
```

Each map's comments are stored as a flat array under the map id. No nested replies in v1.

### 6.3 Identity (Local)

```ts
type StakeholderIdentity = {
  anonymousId: string  // UUID v4, generated on first visit
  name: string
  role: string
  updatedAt: string
}
```

Stored in `localStorage` under a single key. The `anonymousId` is not used to authenticate anything in v1 — it exists so a future version can group comments by author without requiring accounts.

## 7. Technical Architecture

### 7.1 Module Layout (New Files)

```
src/features/share/
├── ShareView.tsx                        // top-level stakeholder surface, mounted when ?share=:mapId
├── ShareView.test.tsx
├── ShareHost.tsx                        // thin host that loads the map document and re-mounts on mapId change (mirrors CanvasHost in LibraryGate)
├── ShareHost.test.tsx
├── comments/
│   ├── commentTypes.ts                  // Comment, CommentAnchor, StakeholderIdentity types
│   ├── commentTypes.test.ts             // type guards and factories
│   ├── identity.ts                      // localStorage identity helpers
│   ├── identity.test.ts
│   ├── IdentitySheet.tsx                // "Sign in to comment" sheet
│   ├── IdentitySheet.test.tsx
│   ├── CommentsPanel.tsx                // right-side thread panel (shared editor + share)
│   ├── CommentsPanel.test.tsx
│   ├── CommentRow.tsx                   // individual comment row with owner actions
│   ├── CommentRow.test.tsx
│   ├── CommentComposer.tsx              // composer used by the panel
│   ├── CommentComposer.test.tsx
│   ├── groupCommentsByAnchor.ts         // pure grouping helper
│   ├── groupCommentsByAnchor.test.ts
│   ├── deriveCommentBadges.ts           // pure helper: nodeId/edgeId → open-comment count
│   ├── deriveCommentBadges.test.ts
│   ├── useComments.ts                   // hook: load/subscribe to a map's comments
│   ├── useComments.test.ts
│   ├── useCommentActions.ts             // hook: post, resolve, reopen, delete
│   └── useCommentActions.test.ts
└── render/
    ├── drawCommentBadges.ts             // Pixi overlay: comment count badges on canvas
    └── drawCommentBadges.test.ts
```

### 7.2 Module Layout (Modified Files)

- `src/features/canvas/LibraryGate.tsx` — when `?share=:mapId` is set in the URL, render the new `ShareHost` instead of the existing `CanvasHost`. Otherwise behave as today. The share surface reuses the same `useLibrary` for loading the map document.
- `src/features/canvas/Toolbar.tsx` — add the Share button (copies `?share=:mapId` to the clipboard, uses the current map's id)
- `src/features/canvas/ProcessCanvas.tsx` — add a `readOnly?: boolean` prop. When true, hide the editor toolbar, suppress drag/connect mutations in `registerCanvasNativeHandlers`, and route element clicks to the share surface's "inspect" path (so the Comments panel can scroll to that element's thread)
- `src/features/canvas/PropertiesPanel.tsx` — add the Comments tab/section, using the shared `CommentsPanel` component
- `src/features/canvas/render/drawEdges.ts` and `drawNodes.ts` — accept a `commentBadges` map and render small 💬 count chips next to the element title
- `src/features/canvas/canvasTypes.ts` — re-export `Comment`, `CommentAnchor`, `StakeholderIdentity` from the new `comments/commentTypes.ts` module (kept there to avoid bloating this file)
- `src/features/canvas/library.ts` and `useLibrary.ts` — extend the file-backed store with a `comments: Record<mapId, Comment[]>` field
- `data/library.json` — add a top-level `comments: {}` field
- `server/index.ts` and `server/library/libraryRoute.ts` — add the four comment endpoints (`GET`, `POST`, `PATCH`, `DELETE`) under `/api/comments/:mapId[/:commentId]`)
- `e2e/share-by-link.spec.ts` — Playwright coverage for the full flow

### 7.3 Read-only Canvas Mode

The existing `ProcessCanvas` is extended with a `readOnly?: boolean` prop. When `readOnly` is true:

- The toolbar hides palette / layout / undo-redo / connect / delete / activate
- The native pointerdown/move/up listener in `registerCanvasNativeHandlers` rejects any drag that would mutate node positions
- The Pixi port hit areas are not added (or are non-interactive)
- The selection state is still tracked for click-to-inspect, but the editor panel is replaced by the always-visible Comments panel
- Focus modes and zoom/pan still work

This keeps a single rendering pipeline. The "read-only" mode is a flag, not a parallel surface.

### 7.4 Persistence Layer

The existing file-backed library API (currently serving `/api/library/*`) is extended with a `comments` collection stored at the top level of `data/library.json`. Operations:

- `GET /api/comments/:mapId` → list of comments for that map
- `POST /api/comments/:mapId` → append a new comment
- `PATCH /api/comments/:mapId/:commentId` → resolve, reopen (editor only)
- `DELETE /api/comments/:mapId/:commentId` → delete (editor only)

The library store is a single JSON file read/written by the server. Every comment write re-reads, mutates, and re-writes the whole file — fine for a prototype, but the implementation plan should consider a debounce/batch for high-volume commenting on a single map.

Owner-only actions are gated by an in-app check: the API reads a `flowent-editor` cookie (set when the user visits the editor with `?map=...`) and rejects curation calls from requests without it. The share surface never sets the cookie. In v1 this is a path-based gate, not a real ACL — anyone who can reach the editor can curate. There is no per-map ACL.

> **Note for the implementation plan**: the cookie-gating is intentionally minimal in v1 — no login, no token, no server-side identity. The implementation plan can replace it with anything stronger as a follow-up, as long as the public surface (`POST /api/comments/:mapId`) remains reachable without auth.

### 7.5 Concurrency Model

Comments are appended via the existing library write path. There is no real-time sync. When the editor panel is open, it polls (or refetches on focus) the comments for the current map. When the share surface is open, it polls at a slower cadence (every 30s) so a returning stakeholder sees fresh comments.

Optimistic updates are used for posting. A failed post shows an inline retry state on the comment row — the comment is removed from the UI until the retry succeeds.

## 8. Visual Language

The share surface reuses the existing canvas visual language (Apple minimalist, established in the visual canvas redesign spec). Specific add-ons:

- **Comment count badge** — small chip with 💬 icon and number, positioned at the top-right of the node/edge label. Color: existing "selected" blue when unresolved count > 0, dimmed gray when only resolved comments exist.
- **Comments panel** — 360px wide, right side, persistent. Same surface treatment as the existing Properties panel.
- **Identity sheet** — centered modal, max-width 420px. Single text input for name, single text input for role tag with chip suggestions below.
- **Filter toggle** — three-segment control at the top of the Comments panel: "Unresolved · All · Resolved."

The Comments panel uses the same typography and color tokens as the existing Properties panel, so the two surfaces feel like the same product when the owner toggles between them.

## 9. Keyboard Shortcuts (v1)

On the share surface:

| Key | Action |
|---|---|
| `+` / `=` | Zoom in |
| `-` | Zoom out |
| `0` | Fit to view |
| `f` | Cycle focus mode (All → Decisions → Handoffs → Bottlenecks → Role) |
| `c` | Focus the Comments panel composer |
| `Esc` | Close the identity sheet / deselect the current element |

On the editor (in addition to existing shortcuts):

| Key | Action |
|---|---|
| `Cmd/Ctrl+Shift+C` | Focus the Comments panel composer |

The keyboard shortcut for the share-link copy in the editor is left out in v1 — the Share button is a single click.

## 10. Testing and Acceptance

### 10.1 Unit Testing

Pure modules with full coverage:

- `groupCommentsByAnchor` — groups by element title, sorts by open-comment count, separates map-wide
- `deriveCommentBadges` — derives `{ nodeId → open count, edgeId → open count }`
- `identity` helpers — localStorage read/write, validation, anonymous ID generation
- `commentTypes` factories and type guards
- `useCommentActions` (with a mocked `useLibrary`) — post, resolve, reopen, delete
- `useComments` (with a mocked fetch) — load, refresh, error path

### 10.2 Component Testing

- `IdentitySheet` — opens on first composer focus, validates name/role lengths, dismisses on Esc, stores identity
- `CommentRow` — renders author/role/timestamp; owner-only Resolve/Reopen/Delete actions appear only in editor mode
- `CommentComposer` — Cmd/Ctrl+Enter posts, character counter shows over 2000 chars
- `CommentsPanel` — filter toggle, group order, empty state when no comments

### 10.3 E2E Testing

`e2e/share-by-link.spec.ts` covers:

1. Owner opens the editor, clicks Share, copies the link
2. Stakeholder opens the link, sees the map in read-only mode
3. Stakeholder pans/zooms/switches focus modes
4. Stakeholder clicks a node, the Comments panel scrolls to its thread
5. Stakeholder clicks the composer, IdentitySheet opens, fills name + role, closes
6. Stakeholder posts a comment, sees it in the thread, sees the badge update
7. Owner returns to the editor, sees the new comment in the Comments tab
8. Owner resolves the comment; stakeholder refreshes and sees the resolved state and the dimmed badge
9. Owner reopens; stakeholder sees the comment back in the unresolved filter
10. Owner deletes the comment; stakeholder refreshes and sees the thread is empty
11. Stakeholder posts a map-wide comment from the panel header
12. Refresh on a slow connection: comment shows "Couldn't post — retry" inline

### 10.4 Done Criteria

- All unit tests pass; coverage on new modules ≥ 80%
- All component tests pass
- The e2e spec passes on a fresh `data/library.json`
- No regression in the existing canvas e2e specs
- The `ProcessCanvas` read-only mode does not break the existing editor
- The Share button is reachable from the existing toolbar
- The Comments tab in the Properties panel renders without errors on maps with no comments
- The build, lint, and type-check pass cleanly

## 11. Migration and Compatibility

- `data/library.json` stored before this change has no `comments` field. The library loader treats a missing field as `{}`. No migration step is required.
- The `?share=:mapId` URL parameter is additive — visiting `/` or `/?map=:mapId` continues to render the editor exactly as today.
- The `Comments` tab/section is added to the Properties panel; the existing element editor tab is unchanged.
- The `readOnly` prop on `ProcessCanvas` defaults to `false`; existing call sites are unaffected.
- The four new `/api/comments/*` endpoints are additive — no existing endpoint changes behavior.

## 12. Open Questions for the Implementation Plan

These are deliberately deferred to the implementation plan, not the spec:

- Exact polling cadence for the share surface (initial estimate: 30s)
- Whether to surface comment count in the share-link popover (yes, per §5.1)
- Whether to add a "Last comment" timestamp to the canvas element tooltip (initial: no, keep the v1 surface small)
- Whether the Comments tab in the editor should be a tab or a separate icon in the rail (initial: tab inside the existing Properties panel)
- Whether to render resolved comments dimmed vs. hidden (initial: dimmed, behind the "Resolved" filter)
