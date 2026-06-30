# Flowent Share-by-Link and Comment Surface Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the share-by-link + comment surface slice specified in `docs/superpowers/specs/2026-06-15-flowent-share-by-link-design.md` — a read-only stakeholder view at `?share=:mapId`, an inline comment thread panel, anonymous identity, and owner-side curation in the existing editor.

**Architecture:** Add small pure modules for comment types, anchor grouping, badge derivation, and identity validation so they are unit-testable before wiring them into React hooks and components. The existing `LibraryGate` switches between `CanvasHost` and the new `ShareHost` based on the URL parameter. The existing `ProcessCanvas` gains a `readOnly` prop. Comments persist in the same `data/library.json` file as maps, exposed through four new endpoints under `/api/comments/*`.

**Tech Stack:** TypeScript, React 19, Vite, Vitest, Testing Library, Playwright, PixiJS, existing file-backed library API, Zod (server-side validation).

---

## Scope Check

The approved spec covers one cohesive slice — share-by-link and comments — that touches the existing editor and adds a new surface. It does **not** cover reply threading, @mentions, email verification, per-link revocation, per-version comment snapshots, or PDF/PNG/SVG export. Those remain independent follow-up subsystems.

The spec produces working, testable software on its own:

- Stakeholder can open `?share=:mapId`, browse the map in read-only mode, and post comments
- Owner can resolve, reopen, and delete comments from the existing editor
- The map continues to follow "latest" — comments are tied to the map, not a version

## Current Codebase Anchors

- Entry point: `src/features/canvas/LibraryGate.tsx` (URL param switching, currently keys off `?map=`)
- Canvas shell: `src/features/canvas/ProcessCanvas.tsx` (existing props: `mapId`, `initialDocument`, `onAutosave`)
- Canvas state: `src/features/canvas/useCanvasState.ts`
- Native host listeners: `src/features/canvas/registerCanvasNativeHandlers.ts`
- Test hooks: `src/features/canvas/registerCanvasTestHooks.ts`
- Toolbar: `src/features/canvas/Toolbar.tsx`
- Properties editor: `src/features/canvas/PropertiesPanel.tsx`
- Pixi node drawing: `src/features/canvas/render/drawNodes.ts`
- Pixi edge drawing: `src/features/canvas/render/drawEdges.ts`
- Library API client: `src/features/canvas/useLibrary.ts`
- Server entry: `server/index.ts`
- Library store: `server/library/libraryStore.ts`
- Library route handler: `server/library/libraryRoute.ts`
- Existing tests: `src/features/canvas/*.test.tsx`, `src/features/canvas/**/*.test.ts`, `server/**/*.test.ts`, `e2e/*.spec.ts`

## File Structure

### Create

- `src/features/share/comments/commentTypes.ts`  
  `Comment`, `CommentAnchor`, `StakeholderIdentity` types and `createComment` factory. Pure, no IO.

- `src/features/share/comments/commentTypes.test.ts`  
  Unit tests for the factory and type guards.

- `src/features/share/comments/groupCommentsByAnchor.ts`  
  Pure grouping helper that turns a flat `Comment[]` into `{ elementGroups: { id, title, comments }[], mapWide: Comment[] }` sorted by open-comment count descending.

- `src/features/share/comments/groupCommentsByAnchor.test.ts`  
  Unit tests for the grouping helper.

- `src/features/share/comments/deriveCommentBadges.ts`  
  Pure helper: `(comments: Comment[]) => { nodeBadges: Map<string, number>, edgeBadges: Map<string, number> }` counting only `status: 'open'`.

- `src/features/share/comments/deriveCommentBadges.test.ts`  
  Unit tests for badge derivation.

- `src/features/share/comments/identity.ts`  
  LocalStorage helpers for `StakeholderIdentity` (read, write, validate, generate anonymous id).

- `src/features/share/comments/identity.test.ts`  
  Unit tests for identity helpers, with localStorage stubbed.

- `src/features/share/comments/useComments.ts`  
  Hook that loads a map's comments via `fetch('/api/comments/:mapId')` and re-fetches on focus.

- `src/features/share/comments/useComments.test.ts`  
  Unit tests with mocked `fetch`.

- `src/features/share/comments/useCommentActions.ts`  
  Hook with `post`, `resolve`, `reopen`, `delete` actions. Wraps `fetch` and returns optimistic-update helpers.

- `src/features/share/comments/useCommentActions.test.ts`  
  Unit tests with mocked `fetch`.

- `src/features/share/comments/CommentsPanel.tsx`  
  Right-side thread panel, reused in editor and share surfaces.

- `src/features/share/comments/CommentsPanel.test.tsx`  
  Component tests for filter toggle, group order, empty state.

- `src/features/share/comments/CommentRow.tsx`  
  Individual comment row with optional owner actions.

- `src/features/share/comments/CommentRow.test.tsx`  
  Component tests for owner-only action visibility and relative timestamp formatting.

- `src/features/share/comments/CommentComposer.tsx`  
  Composer used by `CommentsPanel`.

- `src/features/share/comments/CommentComposer.test.tsx`  
  Component tests for Cmd/Ctrl+Enter submit and character counter.

- `src/features/share/comments/IdentitySheet.tsx`  
  Centered modal asking for display name and role tag.

- `src/features/share/comments/IdentitySheet.test.tsx`  
  Component tests for validation, Esc dismiss, and identity persistence.

- `src/features/share/render/drawCommentBadges.ts`  
  Pixi overlay that draws 💬 count chips next to element titles.

- `src/features/share/render/drawCommentBadges.test.ts`  
  Unit tests for the badge position and label logic.

- `src/features/share/ShareHost.tsx`  
  Thin host mirroring `CanvasHost` — loads the map document via `useLibrary` and remounts on `mapId` change.

- `src/features/share/ShareHost.test.tsx`  
  Component test that verifies remount behavior and document loading.

- `src/features/share/ShareView.tsx`  
  Top-level stakeholder surface — composes `ShareHost` with `ProcessCanvas readOnly`, the minimal share toolbar, and `CommentsPanel`.

- `src/features/share/ShareView.test.tsx`  
  Component test that verifies the surface renders in read-only mode with the comments panel.

- `server/library/commentStore.ts`  
  Pure helpers to manage the `comments: Record<mapId, Comment[]>` field in `library.json`. Zod schema for `Comment`.

- `server/library/commentStore.test.ts`  
  Unit tests for add/resolve/reopen/delete operations.

- `server/library/commentRoute.ts`  
  HTTP route handler for `/api/comments/:mapId` and `/api/comments/:mapId/:commentId`, gated by a `flowent-editor` cookie for curation actions.

- `server/library/commentRoute.test.ts`  
  Unit tests for GET, POST, PATCH (resolve/reopen), DELETE, and cookie gating.

- `e2e/share-by-link.spec.ts`  
  Playwright coverage of the full stakeholder + owner flow.

### Modify

- `src/features/canvas/LibraryGate.tsx` — read `?share=...` URL param, render `ShareHost` instead of `CanvasHost` when set.
- `src/features/canvas/Toolbar.tsx` — add a Share button next to the existing toolbar actions.
- `src/features/canvas/ProcessCanvas.tsx` — accept a `readOnly?: boolean` prop. When true, hide editor toolbar, suppress drag/connect mutations, and route element clicks to a new `onElementClick` prop so `ShareView` can scroll `CommentsPanel` to the clicked element.
- `src/features/canvas/PropertiesPanel.tsx` — add a Comments tab/section that renders `CommentsPanel` in editor mode.
- `src/features/canvas/render/drawEdges.ts` — accept a `commentBadges` map and call `drawCommentBadges` for the visible curve.
- `src/features/canvas/render/drawNodes.ts` — accept a `commentBadges` map and call `drawCommentBadges` for each node container.
- `src/features/canvas/canvasTypes.ts` — re-export `Comment`, `CommentAnchor`, `StakeholderIdentity` from the new `commentTypes.ts`.
- `server/index.ts` — register the new comment route handler.
- `server/library/libraryStore.ts` — extend `librarySchema` with the `comments: Record<mapId, Comment[]>` field, and update `loadLibrary`/`saveLibrary` to preserve it.
- `data/library.json` — add `"comments": {}` field for clean migration.
- `playwright.config.ts` — only if needed for the new spec (most likely no change).

---

## Task 1: Comment Types and Factory

**Files:**
- Create: `src/features/share/comments/commentTypes.ts`
- Create: `src/features/share/comments/commentTypes.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/features/share/comments/commentTypes.test.ts`:

```typescript
import { describe, expect, it } from 'vitest'
import {
  createComment,
  isCommentAnchor,
  isComment,
  type Comment,
  type CommentAnchor,
} from './commentTypes'

describe('commentTypes', () => {
  it('creates a valid open comment with a generated id and timestamp', () => {
    const comment = createComment({
      mapId: 'map-1',
      anchor: { kind: 'node', nodeId: 'n1' },
      author: { name: 'Alex', role: 'PM' },
      body: 'Unclear owner',
    })

    expect(comment.id).toMatch(/^c-[a-z0-9-]+$/)
    expect(comment.status).toBe('open')
    expect(comment.mapId).toBe('map-1')
    expect(comment.body).toBe('Unclear owner')
    expect(typeof comment.createdAt).toBe('string')
    expect(new Date(comment.createdAt).toString()).not.toBe('Invalid Date')
    expect(comment.resolvedAt).toBeUndefined()
    expect(comment.resolvedBy).toBeUndefined()
  })

  it('trims whitespace from name, role, and body', () => {
    const comment = createComment({
      mapId: 'map-1',
      anchor: { kind: 'map' },
      author: { name: '  Sam  ', role: '  Eng  ' },
      body: '  missing feedback loop  ',
    })

    expect(comment.author).toEqual({ name: 'Sam', role: 'Eng' })
    expect(comment.body).toBe('missing feedback loop')
  })

  it('rejects empty or oversized fields', () => {
    expect(() =>
      createComment({
        mapId: 'map-1',
        anchor: { kind: 'node', nodeId: 'n1' },
        author: { name: '', role: 'PM' },
        body: 'x',
      }),
    ).toThrow(/name/)

    expect(() =>
      createComment({
        mapId: 'map-1',
        anchor: { kind: 'node', nodeId: 'n1' },
        author: { name: 'A'.repeat(41), role: 'PM' },
        body: 'x',
      }),
    ).toThrow(/name/)

    expect(() =>
      createComment({
        mapId: 'map-1',
        anchor: { kind: 'node', nodeId: 'n1' },
        author: { name: 'Alex', role: '' },
        body: 'x',
      }),
    ).toThrow(/role/)

    expect(() =>
      createComment({
        mapId: 'map-1',
        anchor: { kind: 'node', nodeId: 'n1' },
        author: { name: 'Alex', role: 'PM' },
        body: '',
      }),
    ).toThrow(/body/)

    expect(() =>
      createComment({
        mapId: 'map-1',
        anchor: { kind: 'node', nodeId: 'n1' },
        author: { name: 'Alex', role: 'PM' },
        body: 'a'.repeat(2001),
      }),
    ).toThrow(/body/)
  })

  it('type-guards CommentAnchor shapes', () => {
    const node: CommentAnchor = { kind: 'node', nodeId: 'n1' }
    const edge: CommentAnchor = { kind: 'edge', edgeId: 'e1' }
    const map: CommentAnchor = { kind: 'map' }

    expect(isCommentAnchor(node)).toBe(true)
    expect(isCommentAnchor(edge)).toBe(true)
    expect(isCommentAnchor(map)).toBe(true)
    expect(isCommentAnchor({ kind: 'other' })).toBe(false)
    expect(isCommentAnchor(null)).toBe(false)
  })

  it('type-guards Comment records', () => {
    const valid: Comment = createComment({
      mapId: 'map-1',
      anchor: { kind: 'map' },
      author: { name: 'Alex', role: 'PM' },
      body: 'hi',
    })
    expect(isComment(valid)).toBe(true)
    expect(isComment({ ...valid, body: '' })).toBe(false)
    expect(isComment({ ...valid, anchor: { kind: 'nope' } })).toBe(false)
    expect(isComment(null)).toBe(false)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:
```bash
npx vitest run src/features/share/comments/commentTypes.test.ts
```

Expected: FAIL — the module does not exist.

- [ ] **Step 3: Implement the types and factory**

Create `src/features/share/comments/commentTypes.ts`:

```typescript
export type CommentAnchor =
  | { kind: 'node'; nodeId: string }
  | { kind: 'edge'; edgeId: string }
  | { kind: 'map' }

export type CommentStatus = 'open' | 'resolved'

export interface CommentAuthor {
  name: string
  role: string
}

export interface Comment {
  id: string
  mapId: string
  anchor: CommentAnchor
  author: CommentAuthor
  body: string
  status: CommentStatus
  createdAt: string
  resolvedAt?: string
  resolvedBy?: string
}

export const COMMENT_NAME_MAX = 40
export const COMMENT_ROLE_MAX = 40
export const COMMENT_BODY_MAX = 2000

export function isCommentAnchor(value: unknown): value is CommentAnchor {
  if (typeof value !== 'object' || value === null) return false
  const v = value as { kind?: unknown; nodeId?: unknown; edgeId?: unknown }
  if (v.kind === 'node') return typeof v.nodeId === 'string' && v.nodeId.length > 0
  if (v.kind === 'edge') return typeof v.edgeId === 'string' && v.edgeId.length > 0
  if (v.kind === 'map') return true
  return false
}

export function isComment(value: unknown): value is Comment {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Partial<Comment>
  if (typeof v.id !== 'string') return false
  if (typeof v.mapId !== 'string') return false
  if (!isCommentAnchor(v.anchor)) return false
  if (!v.author || typeof v.author.name !== 'string' || typeof v.author.role !== 'string') return false
  if (typeof v.body !== 'string') return false
  if (v.status !== 'open' && v.status !== 'resolved') return false
  if (typeof v.createdAt !== 'string') return false
  return true
}

function generateCommentId(): string {
  const ts = Date.now().toString(36)
  const rand = Math.random().toString(36).slice(2, 8)
  return `c-${ts}-${rand}`
}

interface CreateCommentInput {
  mapId: string
  anchor: CommentAnchor
  author: { name: string; role: string }
  body: string
}

export function createComment(input: CreateCommentInput): Comment {
  const name = input.author.name.trim()
  const role = input.author.role.trim()
  const body = input.body.trim()

  if (name.length === 0) throw new Error('Comment author name is required.')
  if (name.length > COMMENT_NAME_MAX) throw new Error(`Comment author name must be ${COMMENT_NAME_MAX} chars or fewer.`)
  if (role.length === 0) throw new Error('Comment author role is required.')
  if (role.length > COMMENT_ROLE_MAX) throw new Error(`Comment author role must be ${COMMENT_ROLE_MAX} chars or fewer.`)
  if (body.length === 0) throw new Error('Comment body is required.')
  if (body.length > COMMENT_BODY_MAX) throw new Error(`Comment body must be ${COMMENT_BODY_MAX} chars or fewer.`)

  return {
    id: generateCommentId(),
    mapId: input.mapId,
    anchor: input.anchor,
    author: { name, role },
    body,
    status: 'open',
    createdAt: new Date().toISOString(),
  }
}

export function resolveComment(comment: Comment, byName: string): Comment {
  return {
    ...comment,
    status: 'resolved',
    resolvedAt: new Date().toISOString(),
    resolvedBy: byName,
  }
}

export function reopenComment(comment: Comment): Comment {
  return {
    ...comment,
    status: 'open',
    resolvedAt: undefined,
    resolvedBy: undefined,
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run:
```bash
npx vitest run src/features/share/comments/commentTypes.test.ts
```

Expected: PASS, 5 tests passing.

- [ ] **Step 5: Commit**

Run:
```bash
git add src/features/share/comments/commentTypes.ts src/features/share/comments/commentTypes.test.ts
git commit -m "feat(share): add comment types and factory"
```

---

## Task 2: Group Comments by Anchor

**Files:**
- Create: `src/features/share/comments/groupCommentsByAnchor.ts`
- Create: `src/features/share/comments/groupCommentsByAnchor.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/features/share/comments/groupCommentsByAnchor.test.ts`:

```typescript
import { describe, expect, it } from 'vitest'
import { groupCommentsByAnchor } from './groupCommentsByAnchor'
import type { Comment } from './commentTypes'

function makeComment(partial: Partial<Comment> & Pick<Comment, 'anchor'>): Comment {
  return {
    id: partial.id ?? 'c1',
    mapId: 'map-1',
    anchor: partial.anchor,
    author: { name: 'Alex', role: 'PM' },
    body: 'body',
    status: partial.status ?? 'open',
    createdAt: '2026-06-15T00:00:00.000Z',
    ...partial,
  }
}

describe('groupCommentsByAnchor', () => {
  it('returns empty groups for no comments', () => {
    const out = groupCommentsByAnchor([], new Map(), new Map())
    expect(out.elementGroups).toEqual([])
    expect(out.mapWide).toEqual([])
  })

  it('groups node-anchored comments by nodeId and resolves title from the map', () => {
    const nodes = new Map([
      ['n1', { id: 'n1', title: 'Triage' }],
      ['n2', { id: 'n2', title: 'Spec review' }],
    ])
    const comments: Comment[] = [
      makeComment({ id: 'c1', anchor: { kind: 'node', nodeId: 'n1' } }),
      makeComment({ id: 'c2', anchor: { kind: 'node', nodeId: 'n1' }, status: 'resolved' }),
      makeComment({ id: 'c3', anchor: { kind: 'node', nodeId: 'n2' } }),
    ]

    const out = groupCommentsByAnchor(comments, nodes, new Map())

    expect(out.elementGroups).toHaveLength(2)
    // Sorted by open count desc: n1 (1 open) then n2 (1 open). Stable order via id when tied.
    expect(out.elementGroups[0]?.id).toBe('n1')
    expect(out.elementGroups[0]?.comments).toHaveLength(2)
    expect(out.elementGroups[1]?.id).toBe('n2')
    expect(out.mapWide).toEqual([])
  })

  it('sorts element groups by open count descending', () => {
    const nodes = new Map([
      ['a', { id: 'a', title: 'Alpha' }],
      ['b', { id: 'b', title: 'Bravo' }],
    ])
    const comments: Comment[] = [
      makeComment({ id: 'c1', anchor: { kind: 'node', nodeId: 'a' } }),
      makeComment({ id: 'c2', anchor: { kind: 'node', nodeId: 'b' } }),
      makeComment({ id: 'c3', anchor: { kind: 'node', nodeId: 'b' } }),
    ]

    const out = groupCommentsByAnchor(comments, nodes, new Map())

    expect(out.elementGroups[0]?.id).toBe('b')
    expect(out.elementGroups[0]?.comments).toHaveLength(2)
    expect(out.elementGroups[1]?.id).toBe('a')
  })

  it('groups edge-anchored comments by edgeId and resolves title from the map', () => {
    const edges = new Map([
      ['e1', { id: 'e1', label: 'PM review' }],
    ])
    const comments: Comment[] = [
      makeComment({ id: 'c1', anchor: { kind: 'edge', edgeId: 'e1' } }),
    ]

    const out = groupCommentsByAnchor(comments, new Map(), edges)

    expect(out.elementGroups).toEqual([
      { id: 'e1', title: 'PM review', comments: [comments[0]] },
    ])
  })

  it('separates map-wide comments into the mapWide bucket in chronological order', () => {
    const comments: Comment[] = [
      makeComment({ id: 'c2', anchor: { kind: 'map' }, createdAt: '2026-06-15T02:00:00.000Z' }),
      makeComment({ id: 'c1', anchor: { kind: 'map' }, createdAt: '2026-06-15T01:00:00.000Z' }),
    ]

    const out = groupCommentsByAnchor(comments, new Map(), new Map())

    expect(out.mapWide.map((c) => c.id)).toEqual(['c1', 'c2'])
  })

  it('falls back to "Untitled element" when the anchor id is not in the maps', () => {
    const comments: Comment[] = [
      makeComment({ id: 'c1', anchor: { kind: 'node', nodeId: 'missing' } }),
    ]

    const out = groupCommentsByAnchor(comments, new Map(), new Map())

    expect(out.elementGroups[0]?.title).toBe('Untitled element')
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:
```bash
npx vitest run src/features/share/comments/groupCommentsByAnchor.test.ts
```

Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement the helper**

Create `src/features/share/comments/groupCommentsByAnchor.ts`:

```typescript
import type { Comment } from './commentTypes'

export interface CommentGroup {
  id: string
  title: string
  comments: Comment[]
}

export interface GroupedComments {
  elementGroups: CommentGroup[]
  mapWide: Comment[]
}

interface NodeLike {
  id: string
  title?: string
}

interface EdgeLike {
  id: string
  label?: string
}

export function groupCommentsByAnchor(
  comments: Comment[],
  nodesById: Map<string, NodeLike>,
  edgesById: Map<string, EdgeLike>,
): GroupedComments {
  const elementById = new Map<string, CommentGroup>()

  for (const comment of comments) {
    if (comment.anchor.kind === 'map') continue
    const id = comment.anchor.kind === 'node' ? comment.anchor.nodeId : comment.anchor.edgeId
    const titleSource =
      comment.anchor.kind === 'node' ? nodesById.get(id) : edgesById.get(id)
    const title =
      (titleSource && (titleSource.title ?? titleSource.label)) || 'Untitled element'

    const existing = elementById.get(id)
    if (existing) {
      existing.comments.push(comment)
    } else {
      elementById.set(id, { id, title, comments: [comment] })
    }
  }

  const elementGroups = Array.from(elementById.values()).sort((a, b) => {
    const openA = a.comments.filter((c) => c.status === 'open').length
    const openB = b.comments.filter((c) => c.status === 'open').length
    if (openA !== openB) return openB - openA
    // Stable on ties: preserve insertion order (the order comments were first
    // encountered). Tests assert this; do not add a title-based tiebreaker.
    return 0
  })

  const mapWide = comments
    .filter((c) => c.anchor.kind === 'map')
    .slice()
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))

  return { elementGroups, mapWide }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run:
```bash
npx vitest run src/features/share/comments/groupCommentsByAnchor.test.ts
```

Expected: PASS, 6 tests passing.

- [ ] **Step 5: Commit**

Run:
```bash
git add src/features/share/comments/groupCommentsByAnchor.ts src/features/share/comments/groupCommentsByAnchor.test.ts
git commit -m "feat(share): group comments by anchor"
```

---

## Task 3: Derive Comment Badges

**Files:**
- Create: `src/features/share/comments/deriveCommentBadges.ts`
- Create: `src/features/share/comments/deriveCommentBadges.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/features/share/comments/deriveCommentBadges.test.ts`:

```typescript
import { describe, expect, it } from 'vitest'
import { deriveCommentBadges } from './deriveCommentBadges'
import type { Comment } from './commentTypes'

function makeComment(partial: Partial<Comment> & Pick<Comment, 'anchor' | 'status'>): Comment {
  return {
    id: partial.id ?? 'c1',
    mapId: 'map-1',
    anchor: partial.anchor,
    author: { name: 'Alex', role: 'PM' },
    body: 'body',
    status: partial.status,
    createdAt: '2026-06-15T00:00:00.000Z',
    ...partial,
  }
}

describe('deriveCommentBadges', () => {
  it('returns empty maps when there are no comments', () => {
    const out = deriveCommentBadges([])
    expect(Array.from(out.nodeBadges.entries())).toEqual([])
    expect(Array.from(out.edgeBadges.entries())).toEqual([])
  })

  it('counts only open comments per element', () => {
    const comments: Comment[] = [
      makeComment({ id: 'c1', anchor: { kind: 'node', nodeId: 'n1' }, status: 'open' }),
      makeComment({ id: 'c2', anchor: { kind: 'node', nodeId: 'n1' }, status: 'open' }),
      makeComment({ id: 'c3', anchor: { kind: 'node', nodeId: 'n1' }, status: 'resolved' }),
      makeComment({ id: 'c4', anchor: { kind: 'edge', edgeId: 'e1' }, status: 'open' }),
      makeComment({ id: 'c5', anchor: { kind: 'map' }, status: 'open' }),
    ]

    const out = deriveCommentBadges(comments)
    expect(out.nodeBadges.get('n1')).toBe(2)
    expect(out.edgeBadges.get('e1')).toBe(1)
    expect(out.nodeBadges.has('missing')).toBe(false)
  })

  it('does not include elements whose open count is zero', () => {
    const comments: Comment[] = [
      makeComment({ id: 'c1', anchor: { kind: 'node', nodeId: 'n1' }, status: 'resolved' }),
    ]

    const out = deriveCommentBadges(comments)
    expect(out.nodeBadges.has('n1')).toBe(false)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:
```bash
npx vitest run src/features/share/comments/deriveCommentBadges.test.ts
```

Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement the helper**

Create `src/features/share/comments/deriveCommentBadges.ts`:

```typescript
import type { Comment } from './commentTypes'

export interface CommentBadges {
  nodeBadges: Map<string, number>
  edgeBadges: Map<string, number>
}

export function deriveCommentBadges(comments: Comment[]): CommentBadges {
  const nodeBadges = new Map<string, number>()
  const edgeBadges = new Map<string, number>()

  for (const comment of comments) {
    if (comment.status !== 'open') continue
    if (comment.anchor.kind === 'node') {
      nodeBadges.set(comment.anchor.nodeId, (nodeBadges.get(comment.anchor.nodeId) ?? 0) + 1)
    } else if (comment.anchor.kind === 'edge') {
      edgeBadges.set(comment.anchor.edgeId, (edgeBadges.get(comment.anchor.edgeId) ?? 0) + 1)
    }
  }

  return { nodeBadges, edgeBadges }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run:
```bash
npx vitest run src/features/share/comments/deriveCommentBadges.test.ts
```

Expected: PASS, 3 tests passing.

- [ ] **Step 5: Commit**

Run:
```bash
git add src/features/share/comments/deriveCommentBadges.ts src/features/share/comments/deriveCommentBadges.test.ts
git commit -m "feat(share): derive comment count badges"
```

---

## Task 4: Identity Helpers

**Files:**
- Create: `src/features/share/comments/identity.ts`
- Create: `src/features/share/comments/identity.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/features/share/comments/identity.test.ts`:

```typescript
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  COMMENT_NAME_MAX,
  COMMENT_ROLE_MAX,
  readIdentity,
  validateIdentity,
  writeIdentity,
  generateAnonymousId,
  type StakeholderIdentity,
} from './identity'

const STORAGE_KEY = 'flowent.stakeholder-identity.v1'

function clearStorage(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* noop */
  }
}

beforeEach(() => {
  clearStorage()
})

afterEach(() => {
  clearStorage()
})

describe('identity', () => {
  it('writeIdentity then readIdentity roundtrips', () => {
    writeIdentity({ anonymousId: 'id-1', name: 'Alex', role: 'PM' })
    const got = readIdentity()
    expect(got).toEqual({
      anonymousId: 'id-1',
      name: 'Alex',
      role: 'PM',
      updatedAt: got?.updatedAt,
    })
  })

  it('readIdentity returns null when nothing is stored', () => {
    expect(readIdentity()).toBeNull()
  })

  it('readIdentity returns null when the stored value is malformed', () => {
    window.localStorage.setItem(STORAGE_KEY, 'not-json')
    expect(readIdentity()).toBeNull()

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ anonymousId: 'x' }))
    expect(readIdentity()).toBeNull()
  })

  it('writeIdentity overwrites a previous identity', () => {
    writeIdentity({ anonymousId: 'id-1', name: 'Alex', role: 'PM' })
    writeIdentity({ anonymousId: 'id-2', name: 'Sam', role: 'Design' })
    expect(readIdentity()?.name).toBe('Sam')
    expect(readIdentity()?.anonymousId).toBe('id-2')
  })

  it('validateIdentity accepts a valid identity and rejects bad ones', () => {
    const good: StakeholderIdentity = {
      anonymousId: 'id-1',
      name: 'Alex',
      role: 'PM',
      updatedAt: new Date().toISOString(),
    }
    expect(validateIdentity(good)).toBe(good)

    expect(() =>
      validateIdentity({ ...good, name: '' }),
    ).toThrow(/name/)

    expect(() =>
      validateIdentity({ ...good, name: 'A'.repeat(COMMENT_NAME_MAX + 1) }),
    ).toThrow(/name/)

    expect(() => validateIdentity({ ...good, role: '' })).toThrow(/role/)
    expect(() => validateIdentity({ ...good, role: 'R'.repeat(COMMENT_ROLE_MAX + 1) })).toThrow(/role/)
    expect(() => validateIdentity({ ...good, anonymousId: '' })).toThrow(/anonymousId/)
  })

  it('generateAnonymousId returns a non-empty string id', () => {
    const id = generateAnonymousId()
    expect(typeof id).toBe('string')
    expect(id.length).toBeGreaterThan(0)
    expect(id).not.toEqual(generateAnonymousId())
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:
```bash
npx vitest run src/features/share/comments/identity.test.ts
```

Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement the helpers**

Create `src/features/share/comments/identity.ts`:

```typescript
import { COMMENT_NAME_MAX, COMMENT_ROLE_MAX } from './commentTypes'

const STORAGE_KEY = 'flowent.stakeholder-identity.v1'

export interface StakeholderIdentity {
  anonymousId: string
  name: string
  role: string
  updatedAt: string
}

export interface IdentityInput {
  anonymousId: string
  name: string
  role: string
}

export function generateAnonymousId(): string {
  const ts = Date.now().toString(36)
  const rand = Math.random().toString(36).slice(2, 10)
  return `anon-${ts}-${rand}`
}

export function validateIdentity(value: unknown): StakeholderIdentity {
  if (typeof value !== 'object' || value === null) {
    throw new Error('Identity must be an object.')
  }
  const v = value as Partial<StakeholderIdentity>
  if (typeof v.anonymousId !== 'string' || v.anonymousId.length === 0) {
    throw new Error('Identity anonymousId is required.')
  }
  const name = typeof v.name === 'string' ? v.name.trim() : ''
  if (name.length === 0) throw new Error('Identity name is required.')
  if (name.length > COMMENT_NAME_MAX) {
    throw new Error(`Identity name must be ${COMMENT_NAME_MAX} chars or fewer.`)
  }
  const role = typeof v.role === 'string' ? v.role.trim() : ''
  if (role.length === 0) throw new Error('Identity role is required.')
  if (role.length > COMMENT_ROLE_MAX) {
    throw new Error(`Identity role must be ${COMMENT_ROLE_MAX} chars or fewer.`)
  }
  if (typeof v.updatedAt !== 'string') {
    throw new Error('Identity updatedAt is required.')
  }
  return {
    anonymousId: v.anonymousId,
    name,
    role,
    updatedAt: v.updatedAt,
  }
}

export function writeIdentity(input: IdentityInput): StakeholderIdentity {
  const identity: StakeholderIdentity = {
    anonymousId: input.anonymousId,
    name: input.name.trim(),
    role: input.role.trim(),
    updatedAt: new Date().toISOString(),
  }
  validateIdentity(identity)
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(identity))
  } catch {
    /* localStorage may be unavailable in private mode; ignore for v1 */
  }
  return identity
}

export function readIdentity(): StakeholderIdentity | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as unknown
    return validateIdentity(parsed)
  } catch {
    return null
  }
}

export function clearIdentity(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* noop */
  }
}

export const __test = { STORAGE_KEY }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run:
```bash
npx vitest run src/features/share/comments/identity.test.ts
```

Expected: PASS, 6 tests passing.

- [ ] **Step 5: Commit**

Run:
```bash
git add src/features/share/comments/identity.ts src/features/share/comments/identity.test.ts
git commit -m "feat(share): add stakeholder identity helpers"
```

---

## Task 5: Server Comment Store

**Files:**
- Create: `server/library/commentStore.ts`
- Create: `server/library/commentStore.test.ts`
- Modify: `server/library/libraryStore.ts` (extend `librarySchema` with the `comments` field)
- Modify: `data/library.json` (add `"comments": {}` field)

- [ ] **Step 1: Write the failing tests**

Create `server/library/commentStore.test.ts`:

```typescript
import { describe, expect, it } from 'vitest'
import {
  appendComment,
  applyCommentPatch,
  deleteComment,
  type CommentRecord,
} from './commentStore'

const sampleComment: CommentRecord = {
  id: 'c1',
  mapId: 'map-1',
  anchor: { kind: 'node', nodeId: 'n1' },
  author: { name: 'Alex', role: 'PM' },
  body: 'Unclear owner',
  status: 'open',
  createdAt: '2026-06-15T00:00:00.000Z',
}

describe('commentStore', () => {
  it('appendComment appends to the per-map bucket', () => {
    const lib = appendComment({}, 'map-1', sampleComment)
    expect(lib['map-1']).toEqual([sampleComment])
  })

  it('appendComment is additive across maps', () => {
    const second = { ...sampleComment, id: 'c2', mapId: 'map-2' }
    let lib: Record<string, CommentRecord[]> = {}
    lib = appendComment(lib, 'map-1', sampleComment)
    lib = appendComment(lib, 'map-2', second)
    expect(lib['map-1']).toEqual([sampleComment])
    expect(lib['map-2']).toEqual([second])
  })

  it('applyCommentPatch resolve sets status and resolved fields', () => {
    const lib: Record<string, CommentRecord[]> = { 'map-1': [sampleComment] }
    const out = applyCommentPatch(lib, 'map-1', 'c1', {
      status: 'resolved',
      resolvedAt: '2026-06-16T00:00:00.000Z',
      resolvedBy: 'Alex',
    })
    expect(out['map-1']?.[0]?.status).toBe('resolved')
    expect(out['map-1']?.[0]?.resolvedAt).toBe('2026-06-16T00:00:00.000Z')
    expect(out['map-1']?.[0]?.resolvedBy).toBe('Alex')
  })

  it('applyCommentPatch reopen clears resolved fields', () => {
    const resolved: CommentRecord = {
      ...sampleComment,
      status: 'resolved',
      resolvedAt: '2026-06-16T00:00:00.000Z',
      resolvedBy: 'Alex',
    }
    const lib: Record<string, CommentRecord[]> = { 'map-1': [resolved] }
    const out = applyCommentPatch(lib, 'map-1', 'c1', { status: 'open' })
    expect(out['map-1']?.[0]?.status).toBe('open')
    expect(out['map-1']?.[0]?.resolvedAt).toBeUndefined()
    expect(out['map-1']?.[0]?.resolvedBy).toBeUndefined()
  })

  it('applyCommentPatch throws when the comment id is missing', () => {
    const lib: Record<string, CommentRecord[]> = { 'map-1': [sampleComment] }
    expect(() => applyCommentPatch(lib, 'map-1', 'missing', { status: 'resolved' })).toThrow(/not found/)
  })

  it('deleteComment removes the comment and leaves an empty bucket', () => {
    const lib: Record<string, CommentRecord[]> = { 'map-1': [sampleComment] }
    const out = deleteComment(lib, 'map-1', 'c1')
    expect(out['map-1']).toEqual([])
  })

  it('deleteComment is a no-op for a missing comment id', () => {
    const lib: Record<string, CommentRecord[]> = { 'map-1': [sampleComment] }
    const out = deleteComment(lib, 'map-1', 'missing')
    expect(out['map-1']).toEqual([sampleComment])
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:
```bash
npx vitest run server/library/commentStore.test.ts
```

Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement the comment store**

Create `server/library/commentStore.ts`:

```typescript
import { z } from 'zod'

export const commentAuthorSchema = z.object({
  name: z.string().min(1).max(40),
  role: z.string().min(1).max(40),
})

export const commentAnchorSchema = z.union([
  z.object({ kind: z.literal('node'), nodeId: z.string().min(1) }),
  z.object({ kind: z.literal('edge'), edgeId: z.string().min(1) }),
  z.object({ kind: z.literal('map') }),
])

export const commentSchema = z.object({
  id: z.string().min(1),
  mapId: z.string().min(1),
  anchor: commentAnchorSchema,
  author: commentAuthorSchema,
  body: z.string().min(1).max(2000),
  status: z.enum(['open', 'resolved']),
  createdAt: z.string().min(1),
  resolvedAt: z.string().optional(),
  resolvedBy: z.string().optional(),
})

export type CommentRecord = z.infer<typeof commentSchema>

export type CommentPatch = Partial<Pick<CommentRecord, 'status' | 'resolvedAt' | 'resolvedBy'>>

export function appendComment(
  comments: Record<string, CommentRecord[]>,
  mapId: string,
  comment: CommentRecord,
): Record<string, CommentRecord[]> {
  const bucket = comments[mapId] ? [...comments[mapId]] : []
  bucket.push(comment)
  return { ...comments, [mapId]: bucket }
}

export function applyCommentPatch(
  comments: Record<string, CommentRecord[]>,
  mapId: string,
  commentId: string,
  patch: CommentPatch,
): Record<string, CommentRecord[]> {
  const bucket = comments[mapId]
  if (!bucket) throw new Error(`No comments for map ${mapId}`)
  const idx = bucket.findIndex((c) => c.id === commentId)
  if (idx === -1) throw new Error(`Comment ${commentId} not found for map ${mapId}`)

  const next = bucket.slice()
  const existing = next[idx]
  if (!existing) throw new Error(`Comment ${commentId} not found for map ${mapId}`)
  let updated: CommentRecord = { ...existing, ...patch }

  if (patch.status === 'open') {
    updated = { ...updated, resolvedAt: undefined, resolvedBy: undefined }
  }
  next[idx] = updated

  return { ...comments, [mapId]: next }
}

export function deleteComment(
  comments: Record<string, CommentRecord[]>,
  mapId: string,
  commentId: string,
): Record<string, CommentRecord[]> {
  const bucket = comments[mapId]
  if (!bucket) return comments
  const next = bucket.filter((c) => c.id !== commentId)
  return { ...comments, [mapId]: next }
}
```

- [ ] **Step 4: Extend the library store with the `comments` field**

In `server/library/libraryStore.ts`, modify the `librarySchema` and `createEmptyLibrary`:

Replace the existing `librarySchema` (lines 85–88) with:

```typescript
export const librarySchema = z.object({
  folders: z.array(folderSchema),
  maps: z.array(mapSchema),
  comments: z.record(z.string(), z.array(commentSchema)).default({}),
})
```

Add `commentSchema` to the existing import from `./commentStore` near the top of the file. The full import becomes:

```typescript
import { commentSchema } from './commentStore'
```

Replace `createEmptyLibrary` (line 96) with:

```typescript
export function createEmptyLibrary(): SavedLibrary {
  return { folders: [], maps: [], comments: {} }
}
```

- [ ] **Step 5: Add the empty `comments` field to `data/library.json`**

Edit `data/library.json` to add `"comments": {}` at the top level (after `"maps"`):

```json
{
  "folders": [...],
  "maps": [...],
  "comments": {}
}
```

(Read the file first to confirm the exact indentation before editing.)

- [ ] **Step 6: Run all server tests to verify the schema change doesn't break the existing suite**

Run:
```bash
npx vitest run server/library
```

Expected: all existing tests still pass; the new `commentStore.test.ts` is included.

- [ ] **Step 7: Commit**

Run:
```bash
git add server/library/commentStore.ts server/library/commentStore.test.ts server/library/libraryStore.ts data/library.json
git commit -m "feat(share): persist comments in library store"
```

---

## Task 6: Comments Route Handler

**Files:**
- Create: `server/library/commentRoute.ts`
- Create: `server/library/commentRoute.test.ts`
- Modify: `server/index.ts` (register the new comment route handler)

- [ ] **Step 1: Write the failing tests**

Create `server/library/commentRoute.test.ts`:

```typescript
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createCommentRouteHandler } from './commentRoute'

let dir: string
let file: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'flowent-comments-'))
  file = join(dir, 'library.json')
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

function dispatch(handle: (req: Request) => Promise<Response>, req: Request): Promise<Response> {
  return handle(req)
}

function withEditorCookie(req: Request): Request {
  return new Request(req.url, {
    method: req.method,
    headers: { ...Object.fromEntries(req.headers), cookie: 'flowent-editor=1' },
    body: req.body,
  })
}

describe('commentRoute', () => {
  it('GET /api/comments/:mapId returns an empty array for an unseen map', async () => {
    const handle = createCommentRouteHandler({ filePath: file })
    const res = await dispatch(handle, new Request('http://test/api/comments/map-1'))
    expect(res.status).toBe(200)
    const body = await res.json() as { success: boolean, data: unknown[] }
    expect(body.success).toBe(true)
    expect(body.data).toEqual([])
  })

  it('POST creates a comment, then GET returns it', async () => {
    const handle = createCommentRouteHandler({ filePath: file })
    const post = await dispatch(handle, new Request('http://test/api/comments/map-1', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        anchor: { kind: 'node', nodeId: 'n1' },
        author: { name: 'Alex', role: 'PM' },
        body: 'Unclear owner',
      }),
    }))
    expect(post.status).toBe(201)
    const created = await post.json() as { success: boolean, data: { id: string; body: string } }
    expect(created.data.body).toBe('Unclear owner')

    const get = await dispatch(handle, new Request('http://test/api/comments/map-1'))
    const body = await get.json() as { success: boolean, data: { id: string; body: string }[] }
    expect(body.data).toHaveLength(1)
    expect(body.data[0]?.id).toBe(created.data.id)
  })

  it('POST rejects an unauthenticated request when no editor cookie is set', async () => {
    const handle = createCommentRouteHandler({ filePath: file })
    // The POST itself is allowed (stakeholders can post without auth).
    const post = await dispatch(handle, new Request('http://test/api/comments/map-1', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        anchor: { kind: 'map' },
        author: { name: 'Alex', role: 'PM' },
        body: 'hi',
      }),
    }))
    expect(post.status).toBe(201)
  })

  it('PATCH requires the editor cookie', async () => {
    const handle = createCommentRouteHandler({ filePath: file })
    const post = await dispatch(handle, withEditorCookie(new Request('http://test/api/comments/map-1', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        anchor: { kind: 'node', nodeId: 'n1' },
        author: { name: 'Alex', role: 'PM' },
        body: 'x',
      }),
    })))
    const created = await post.json() as { data: { id: string } }

    const noAuth = await dispatch(handle, new Request(`http://test/api/comments/map-1/${created.data.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'resolved' }),
    }))
    expect(noAuth.status).toBe(403)

    const withAuth = await dispatch(handle, withEditorCookie(new Request(`http://test/api/comments/map-1/${created.data.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'resolved', resolvedBy: 'Alex' }),
    })))
    expect(withAuth.status).toBe(200)
    const resolved = await withAuth.json() as { data: { status: string; resolvedBy: string } }
    expect(resolved.data.status).toBe('resolved')
    expect(resolved.data.resolvedBy).toBe('Alex')
  })

  it('DELETE requires the editor cookie', async () => {
    const handle = createCommentRouteHandler({ filePath: file })
    const post = await dispatch(handle, withEditorCookie(new Request('http://test/api/comments/map-1', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        anchor: { kind: 'map' },
        author: { name: 'Alex', role: 'PM' },
        body: 'x',
      }),
    })))
    const created = await post.json() as { data: { id: string } }

    const noAuth = await dispatch(handle, new Request(`http://test/api/comments/map-1/${created.data.id}`, {
      method: 'DELETE',
    }))
    expect(noAuth.status).toBe(403)

    const withAuth = await dispatch(handle, withEditorCookie(new Request(`http://test/api/comments/map-1/${created.data.id}`, {
      method: 'DELETE',
    })))
    expect(withAuth.status).toBe(200)
  })

  it('POST rejects malformed bodies with a 400', async () => {
    const handle = createCommentRouteHandler({ filePath: file })
    const res = await dispatch(handle, new Request('http://test/api/comments/map-1', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ anchor: { kind: 'map' }, author: { name: '', role: 'PM' }, body: 'x' }),
    }))
    expect(res.status).toBe(400)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:
```bash
npx vitest run server/library/commentRoute.test.ts
```

Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement the route handler**

Create `server/library/commentRoute.ts`:

```typescript
import { z } from 'zod'
import {
  appendComment,
  applyCommentPatch,
  commentSchema,
  deleteComment,
} from './commentStore'
import { loadAndMutateLibrary, loadLibrary } from './libraryStore'

interface CommentRouteDeps {
  filePath: string
}

const createCommentInputSchema = z.object({
  anchor: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('node'), nodeId: z.string().min(1) }),
    z.object({ kind: z.literal('edge'), edgeId: z.string().min(1) }),
    z.object({ kind: z.literal('map') }),
  ]),
  author: z.object({
    name: z.string().min(1).max(40),
    role: z.string().min(1).max(40),
  }),
  body: z.string().min(1).max(2000),
})

const patchCommentInputSchema = z.object({
  status: z.enum(['open', 'resolved']).optional(),
  resolvedAt: z.string().optional(),
  resolvedBy: z.string().optional(),
})

function json(body: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify({ success: status < 400, data: body }), {
    status,
    headers: { 'content-type': 'application/json', ...extraHeaders },
  })
}

function errorResponse(status: number, message: string): Response {
  return new Response(JSON.stringify({ success: false, error: message }), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function generateCommentId(): string {
  const ts = Date.now().toString(36)
  const rand = Math.random().toString(36).slice(2, 8)
  return `c-${ts}-${rand}`
}

function hasEditorCookie(request: Request): boolean {
  const cookie = request.headers.get('cookie') ?? ''
  return /(?:^|;\s*)flowent-editor=/.test(cookie)
}

export function createCommentRouteHandler(deps: CommentRouteDeps) {
  return async function handle(request: Request): Promise<Response> {
    const url = new URL(request.url)
    const path = url.pathname.replace(/^\/api\/comments\/?/, '')
    const [mapId, commentId] = path.split('/').filter(Boolean)

    if (!mapId) return errorResponse(400, 'Missing mapId')

    if (request.method === 'GET') {
      const lib = await loadLibrary(deps.filePath)
      const bucket = lib.comments[mapId] ?? []
      return json(bucket)
    }

    if (request.method === 'POST') {
      if (!commentId) {
        let raw: string
        try {
          raw = await request.text()
        } catch {
          return errorResponse(413, 'Comment payload is too large.')
        }
        let payload: unknown
        try {
          payload = JSON.parse(raw)
        } catch (err) {
          return errorResponse(400, `Malformed JSON: ${(err as Error).message}`)
        }
        const parsed = createCommentInputSchema.safeParse(payload)
        if (!parsed.success) {
          return errorResponse(400, `Invalid payload: ${parsed.error.issues.map((i) => i.message).join('; ')}`)
        }

        const id = generateCommentId()
        const created = {
          id,
          mapId,
          anchor: parsed.data.anchor,
          author: { name: parsed.data.author.name.trim(), role: parsed.data.author.role.trim() },
          body: parsed.data.body.trim(),
          status: 'open' as const,
          createdAt: new Date().toISOString(),
        }

        const result = await loadAndMutateLibrary(deps.filePath, (lib) => ({
          ...lib,
          comments: appendComment(lib.comments, mapId, created),
        }))
        return json(result.comments[mapId]?.find((c) => c.id === id) ?? created, 201)
      }
      return errorResponse(405, 'POST does not accept a commentId')
    }

    if (request.method === 'PATCH') {
      if (!hasEditorCookie(request)) return errorResponse(403, 'Editor session required.')
      if (!commentId) return errorResponse(400, 'Missing commentId')
      let raw: string
      try {
        raw = await request.text()
      } catch {
        return errorResponse(413, 'Patch payload is too large.')
      }
      let payload: unknown
      try {
        payload = JSON.parse(raw)
      } catch (err) {
        return errorResponse(400, `Malformed JSON: ${(err as Error).message}`)
      }
      const parsed = patchCommentInputSchema.safeParse(payload)
      if (!parsed.success) {
        return errorResponse(400, `Invalid payload: ${parsed.error.issues.map((i) => i.message).join('; ')}`)
      }

      try {
        const result = await loadAndMutateLibrary(deps.filePath, (lib) => ({
          ...lib,
          comments: applyCommentPatch(lib.comments, mapId, commentId, parsed.data),
        }))
        const updated = result.comments[mapId]?.find((c) => c.id === commentId)
        if (!updated) return errorResponse(404, 'Comment not found')
        return json(updated)
      } catch (err) {
        return errorResponse(404, (err as Error).message)
      }
    }

    if (request.method === 'DELETE') {
      if (!hasEditorCookie(request)) return errorResponse(403, 'Editor session required.')
      if (!commentId) return errorResponse(400, 'Missing commentId')

      const result = await loadAndMutateLibrary(deps.filePath, (lib) => ({
        ...lib,
        comments: deleteComment(lib.comments, mapId, commentId),
      }))
      return json({ ok: true, deleted: commentId })
    }

    return errorResponse(405, `Method ${request.method} not allowed`)
  }
}

// Suppress unused-import warning when zod re-exports are pruned in builds.
void commentSchema
```

- [ ] **Step 4: Register the route in `server/index.ts`**

In `server/index.ts`, add an import near the existing library route import:

```typescript
import { createCommentRouteHandler } from './library/commentRoute'
```

Then, after the existing `handleLibraryRequest` constant, add:

```typescript
const handleCommentsRequest = createCommentRouteHandler({ filePath: LIBRARY_FILE })
```

Then, in the `http.createServer` callback, add a branch **before** the existing `'/api/library'` branch:

```typescript
if (url.pathname.startsWith('/api/comments')) {
  try {
    const requestBody = request.method === 'GET' || request.method === 'HEAD' || request.method === 'DELETE'
      ? undefined
      : await readRequestBody(request, MAX_LIBRARY_REQUEST_BYTES)
    const webRequest = new Request(url, {
      method: request.method,
      headers: request.headers as HeadersInit,
      body: requestBody,
    })
    const webResponse = await handleCommentsRequest(webRequest)

    response.writeHead(webResponse.status, Object.fromEntries(webResponse.headers.entries()))
    response.end(await webResponse.text())
  } catch {
    response.writeHead(413, { 'content-type': 'application/json' })
    response.end(JSON.stringify({ success: false, error: 'Comment payload is too large.' }))
  }
  return
}
```

- [ ] **Step 5: Run all server tests**

Run:
```bash
npx vitest run server/library
```

Expected: all existing tests pass; new `commentRoute.test.ts` passes.

- [ ] **Step 6: Commit**

Run:
```bash
git add server/library/commentRoute.ts server/library/commentRoute.test.ts server/index.ts
git commit -m "feat(share): expose /api/comments endpoints"
```

---

## Task 7: useComments Hook

**Files:**
- Create: `src/features/share/comments/useComments.ts`
- Create: `src/features/share/comments/useComments.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/features/share/comments/useComments.test.ts`:

```typescript
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { useComments } from './useComments'
import type { Comment } from './commentTypes'

const sampleComment: Comment = {
  id: 'c1',
  mapId: 'map-1',
  anchor: { kind: 'node', nodeId: 'n1' },
  author: { name: 'Alex', role: 'PM' },
  body: 'hi',
  status: 'open',
  createdAt: '2026-06-15T00:00:00.000Z',
}

let originalFetch: typeof fetch

beforeEach(() => {
  originalFetch = globalThis.fetch
})

afterEach(() => {
  globalThis.fetch = originalFetch
  vi.restoreAllMocks()
})

describe('useComments', () => {
  it('starts in loading state, then resolves to the fetched comments', async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ success: true, data: [sampleComment] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    ) as typeof fetch

    const { result } = renderHook(() => useComments('map-1'))

    expect(result.current.loading).toBe(true)
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.comments).toEqual([sampleComment])
    expect(result.current.error).toBeNull()
  })

  it('sets an error state when fetch fails', async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error('network down')
    }) as typeof fetch

    const { result } = renderHook(() => useComments('map-1'))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toMatch(/network down/)
    expect(result.current.comments).toEqual([])
  })

  it('refresh() refetches the comments', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ success: true, data: [sampleComment] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    )
    globalThis.fetch = fetchMock as typeof fetch

    const { result } = renderHook(() => useComments('map-1'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(fetchMock).toHaveBeenCalledTimes(1)

    await act(async () => {
      await result.current.refresh()
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('skips the fetch when mapId is null', async () => {
    const fetchMock = vi.fn()
    globalThis.fetch = fetchMock as typeof fetch

    const { result } = renderHook(() => useComments(null))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(fetchMock).not.toHaveBeenCalled()
    expect(result.current.comments).toEqual([])
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:
```bash
npx vitest run src/features/share/comments/useComments.test.ts
```

Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement the hook**

Create `src/features/share/comments/useComments.ts`:

```typescript
import { useCallback, useEffect, useState } from 'react'
import { isComment, type Comment } from './commentTypes'

export interface UseCommentsResult {
  comments: Comment[]
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
}

export function useComments(mapId: string | null): UseCommentsResult {
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState<boolean>(mapId !== null)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async (): Promise<void> => {
    if (!mapId) {
      setComments([])
      setLoading(false)
      setError(null)
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/comments/${encodeURIComponent(mapId)}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const body = (await res.json()) as { success: boolean, data?: unknown }
      const raw = Array.isArray(body.data) ? body.data : []
      const next: Comment[] = raw.filter(isComment)
      setComments(next)
      setError(null)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [mapId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { comments, loading, error, refresh }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run:
```bash
npx vitest run src/features/share/comments/useComments.test.ts
```

Expected: PASS, 4 tests passing.

- [ ] **Step 5: Commit**

Run:
```bash
git add src/features/share/comments/useComments.ts src/features/share/comments/useComments.test.ts
git commit -m "feat(share): add useComments hook"
```

---

## Task 8: useCommentActions Hook

**Files:**
- Create: `src/features/share/comments/useCommentActions.ts`
- Create: `src/features/share/comments/useCommentActions.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/features/share/comments/useCommentActions.test.ts`:

```typescript
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useCommentActions } from './useCommentActions'
import type { Comment, CommentAnchor } from './commentTypes'

const sampleComment: Comment = {
  id: 'c1',
  mapId: 'map-1',
  anchor: { kind: 'node', nodeId: 'n1' },
  author: { name: 'Alex', role: 'PM' },
  body: 'hi',
  status: 'open',
  createdAt: '2026-06-15T00:00:00.000Z',
}

let originalFetch: typeof fetch

beforeEach(() => {
  originalFetch = globalThis.fetch
})

afterEach(() => {
  globalThis.fetch = originalFetch
  vi.restoreAllMocks()
  document.cookie = 'flowent-editor=; Max-Age=0; Path=/'
})

function setEditorCookie(): void {
  document.cookie = 'flowent-editor=1; Path=/'
}

describe('useCommentActions', () => {
  it('post() sends a POST and returns the created comment', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ success: true, data: sampleComment }), {
        status: 201,
        headers: { 'content-type': 'application/json' },
      }),
    )
    globalThis.fetch = fetchMock as typeof fetch

    const { result } = renderHook(() => useCommentActions('map-1'))

    let created: Comment | null = null
    const anchor: CommentAnchor = { kind: 'node', nodeId: 'n1' }
    await act(async () => {
      created = await result.current.post({ anchor, author: { name: 'Alex', role: 'PM' }, body: 'hi' })
    })
    expect(created?.id).toBe('c1')
    expect(fetchMock).toHaveBeenCalledWith('/api/comments/map-1', expect.objectContaining({ method: 'POST' }))
  })

  it('post() does not require the editor cookie', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ success: true, data: sampleComment }), {
        status: 201,
        headers: { 'content-type': 'application/json' },
      }),
    )
    globalThis.fetch = fetchMock as typeof fetch

    const { result } = renderHook(() => useCommentActions('map-1'))
    await act(async () => {
      await result.current.post({ anchor: { kind: 'map' }, author: { name: 'A', role: 'P' }, body: 'x' })
    })
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit
    const headers = new Headers(init.headers)
    expect(headers.get('cookie')).toBeNull()
  })

  it('resolve() sends a PATCH with the editor cookie', async () => {
    setEditorCookie()
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ success: true, data: { ...sampleComment, status: 'resolved' } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    )
    globalThis.fetch = fetchMock as typeof fetch

    const { result } = renderHook(() => useCommentActions('map-1'))
    await act(async () => {
      await result.current.resolve('c1', 'Alex')
    })
    expect(fetchMock).toHaveBeenCalledWith('/api/comments/map-1/c1', expect.objectContaining({ method: 'PATCH' }))
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit
    expect(JSON.parse(init.body as string)).toMatchObject({ status: 'resolved', resolvedBy: 'Alex' })
  })

  it('resolve() surfaces a 403 error from the server', async () => {
    setEditorCookie()
    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ success: false, error: 'Editor session required.' }), {
        status: 403,
        headers: { 'content-type': 'application/json' },
      }),
    ) as typeof fetch

    const { result } = renderHook(() => useCommentActions('map-1'))
    await expect(result.current.resolve('c1', 'Alex')).rejects.toThrow(/403/)
  })

  it('reopen() sends a PATCH with status: open', async () => {
    setEditorCookie()
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ success: true, data: { ...sampleComment, status: 'open' } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    )
    globalThis.fetch = fetchMock as typeof fetch

    const { result } = renderHook(() => useCommentActions('map-1'))
    await act(async () => {
      await result.current.reopen('c1')
    })
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit
    expect(JSON.parse(init.body as string)).toEqual({ status: 'open' })
  })

  it('delete() sends a DELETE with the editor cookie', async () => {
    setEditorCookie()
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ success: true, data: { ok: true, deleted: 'c1' } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    )
    globalThis.fetch = fetchMock as typeof fetch

    const { result } = renderHook(() => useCommentActions('map-1'))
    await act(async () => {
      await result.current.delete('c1')
    })
    expect(fetchMock).toHaveBeenCalledWith('/api/comments/map-1/c1', expect.objectContaining({ method: 'DELETE' }))
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:
```bash
npx vitest run src/features/share/comments/useCommentActions.test.ts
```

Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement the hook**

Create `src/features/share/comments/useCommentActions.ts`:

```typescript
import { useCallback } from 'react'
import type { Comment, CommentAnchor } from './commentTypes'

export interface PostInput {
  anchor: CommentAnchor
  author: { name: string; role: string }
  body: string
}

export interface UseCommentActionsResult {
  post: (input: PostInput) => Promise<Comment>
  resolve: (commentId: string, byName: string) => Promise<Comment>
  reopen: (commentId: string) => Promise<Comment>
  delete: (commentId: string) => Promise<void>
}

function readEditorCookie(): string | null {
  if (typeof document === 'undefined') return null
  const cookie = document.cookie ?? ''
  const match = /(?:^|;\s*)flowent-editor=([^;]*)/.exec(cookie)
  return match && match[1] ? match[1] : null
}

async function readJson<T>(res: Response): Promise<T> {
  const text = await res.text()
  try {
    return JSON.parse(text) as T
  } catch (err) {
    throw new Error(`Malformed JSON response: ${(err as Error).message}`)
  }
}

async function expectOk(res: Response): Promise<Response> {
  if (res.ok) return res
  const body = await readJson<{ error?: string }>(res).catch(() => ({}))
  throw new Error(`${res.status} ${body.error ?? res.statusText}`)
}

export function useCommentActions(mapId: string): UseCommentActionsResult {
  const post = useCallback(
    async (input: PostInput): Promise<Comment> => {
      const res = await fetch(`/api/comments/${encodeURIComponent(mapId)}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          anchor: input.anchor,
          author: { name: input.author.name.trim(), role: input.author.role.trim() },
          body: input.body.trim(),
        }),
      })
      await expectOk(res)
      const body = await readJson<{ data: Comment }>(res)
      return body.data
    },
    [mapId],
  )

  const patch = useCallback(
    async (commentId: string, payload: Record<string, unknown>): Promise<Comment> => {
      const headers: Record<string, string> = { 'content-type': 'application/json' }
      const cookie = readEditorCookie()
      if (cookie) headers.cookie = `flowent-editor=${cookie}`

      const res = await fetch(`/api/comments/${encodeURIComponent(mapId)}/${encodeURIComponent(commentId)}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(payload),
      })
      await expectOk(res)
      const body = await readJson<{ data: Comment }>(res)
      return body.data
    },
    [mapId],
  )

  const del = useCallback(
    async (commentId: string): Promise<void> => {
      const headers: Record<string, string> = {}
      const cookie = readEditorCookie()
      if (cookie) headers.cookie = `flowent-editor=${cookie}`

      const res = await fetch(`/api/comments/${encodeURIComponent(mapId)}/${encodeURIComponent(commentId)}`, {
        method: 'DELETE',
        headers,
      })
      await expectOk(res)
    },
    [mapId],
  )

  return {
    post,
    resolve: (commentId, byName) =>
      patch(commentId, { status: 'resolved', resolvedAt: new Date().toISOString(), resolvedBy: byName }),
    reopen: (commentId) => patch(commentId, { status: 'open' }),
    delete: del,
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run:
```bash
npx vitest run src/features/share/comments/useCommentActions.test.ts
```

Expected: PASS, 6 tests passing.

- [ ] **Step 5: Commit**

Run:
```bash
git add src/features/share/comments/useCommentActions.ts src/features/share/comments/useCommentActions.test.ts
git commit -m "feat(share): add useCommentActions hook"
```

---

## Task 9: Comments Panel, Row, Composer, and Identity Sheet Components

**Files:**
- Create: `src/features/share/comments/CommentRow.tsx`
- Create: `src/features/share/comments/CommentRow.test.tsx`
- Create: `src/features/share/comments/CommentComposer.tsx`
- Create: `src/features/share/comments/CommentComposer.test.tsx`
- Create: `src/features/share/comments/IdentitySheet.tsx`
- Create: `src/features/share/comments/IdentitySheet.test.tsx`
- Create: `src/features/share/comments/CommentsPanel.tsx`
- Create: `src/features/share/comments/CommentsPanel.test.tsx`

- [ ] **Step 1: Write the failing tests for `CommentRow`**

Create `src/features/share/comments/CommentRow.test.tsx`:

```typescript
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CommentRow } from './CommentRow'
import type { Comment } from './commentTypes'

const baseComment: Comment = {
  id: 'c1',
  mapId: 'map-1',
  anchor: { kind: 'node', nodeId: 'n1' },
  author: { name: 'Alex', role: 'PM' },
  body: 'Unclear owner',
  status: 'open',
  createdAt: '2026-06-15T00:00:00.000Z',
}

describe('CommentRow', () => {
  it('renders author, role, body, and timestamp', () => {
    render(<CommentRow comment={baseComment} ownerMode={false} />)
    expect(screen.getByText('Alex')).toBeInTheDocument()
    expect(screen.getByText('PM')).toBeInTheDocument()
    expect(screen.getByText('Unclear owner')).toBeInTheDocument()
  })

  it('hides owner actions when not in owner mode', () => {
    render(<CommentRow comment={baseComment} ownerMode={false} />)
    expect(screen.queryByRole('button', { name: /resolve/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /reopen/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /delete/i })).toBeNull()
  })

  it('shows Resolve and Delete in owner mode for an open comment', () => {
    render(<CommentRow comment={baseComment} ownerMode={true} onResolve={() => {}} onDelete={() => {}} />)
    expect(screen.getByRole('button', { name: /resolve/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /reopen/i })).toBeNull()
  })

  it('shows Reopen in owner mode for a resolved comment', () => {
    render(<CommentRow comment={{ ...baseComment, status: 'resolved' }} ownerMode={true} onReopen={() => {}} onDelete={() => {}} />)
    expect(screen.getByRole('button', { name: /reopen/i })).toBeInTheDocument()
  })

  it('calls onResolve when the Resolve button is clicked', async () => {
    const user = userEvent.setup()
    const onResolve = vi.fn()
    render(<CommentRow comment={baseComment} ownerMode={true} onResolve={onResolve} onDelete={() => {}} />)
    await user.click(screen.getByRole('button', { name: /resolve/i }))
    expect(onResolve).toHaveBeenCalledWith('c1')
  })
})
```

- [ ] **Step 2: Implement `CommentRow`**

Create `src/features/share/comments/CommentRow.tsx`:

```typescript
import type { Comment } from './commentTypes'

export interface CommentRowProps {
  comment: Comment
  ownerMode: boolean
  onResolve?: (commentId: string) => void
  onReopen?: (commentId: string) => void
  onDelete?: (commentId: string) => void
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime()
  const now = Date.now()
  const diff = Math.max(0, now - then)
  const minutes = Math.round(diff / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString()
}

export function CommentRow({ comment, ownerMode, onResolve, onReopen, onDelete }: CommentRowProps) {
  return (
    <div className={`comment-row ${comment.status === 'resolved' ? 'is-resolved' : ''}`} data-testid={`comment-row-${comment.id}`}>
      <div className="comment-row-header">
        <span className="comment-author">{comment.author.name}</span>
        <span className="comment-role">· {comment.author.role}</span>
        <span className="comment-time">{formatRelative(comment.createdAt)}</span>
        {comment.status === 'resolved' ? <span className="comment-status-pill">Resolved</span> : null}
      </div>
      <div className="comment-body">{comment.body}</div>
      {ownerMode ? (
        <div className="comment-row-actions">
          {comment.status === 'open' && onResolve ? (
            <button type="button" onClick={() => onResolve(comment.id)}>Resolve</button>
          ) : null}
          {comment.status === 'resolved' && onReopen ? (
            <button type="button" onClick={() => onReopen(comment.id)}>Reopen</button>
          ) : null}
          {onDelete ? (
            <button type="button" className="comment-delete" onClick={() => onDelete(comment.id)}>Delete</button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
```

- [ ] **Step 3: Run CommentRow tests**

Run:
```bash
npx vitest run src/features/share/comments/CommentRow.test.tsx
```

Expected: PASS, 5 tests passing.

- [ ] **Step 4: Write the failing tests for `CommentComposer`**

Create `src/features/share/comments/CommentComposer.test.tsx`:

```typescript
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CommentComposer } from './CommentComposer'
import type { StakeholderIdentity } from './identity'

const identity: StakeholderIdentity = {
  anonymousId: 'anon-1',
  name: 'Alex',
  role: 'PM',
  updatedAt: '2026-06-15T00:00:00.000Z',
}

describe('CommentComposer', () => {
  it('shows the identity and a Change link', () => {
    render(<CommentComposer identity={identity} onChangeIdentity={() => {}} onSubmit={async () => {}} />)
    expect(screen.getByText(/Alex/)).toBeInTheDocument()
    expect(screen.getByText(/PM/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /change/i })).toBeInTheDocument()
  })

  it('calls onSubmit when Post is clicked', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn(async () => {})
    render(<CommentComposer identity={identity} onChangeIdentity={() => {}} onSubmit={onSubmit} />)
    await user.type(screen.getByRole('textbox'), 'hello')
    await user.click(screen.getByRole('button', { name: /post/i }))
    expect(onSubmit).toHaveBeenCalledWith('hello')
  })

  it('submits on Cmd/Ctrl+Enter', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn(async () => {})
    render(<CommentComposer identity={identity} onChangeIdentity={() => {}} onSubmit={onSubmit} />)
    const input = screen.getByRole('textbox')
    await user.type(input, 'hello')
    await user.keyboard('{Control>}{Enter}{/Control}')
    expect(onSubmit).toHaveBeenCalledWith('hello')
  })

  it('shows a character counter when within 100 of the max', async () => {
    const user = userEvent.setup()
    render(<CommentComposer identity={identity} onChangeIdentity={() => {}} onSubmit={async () => {}} />)
    const input = screen.getByRole('textbox')
    await user.type(input, 'a'.repeat(1950))
    expect(screen.getByText(/50 left/)).toBeInTheDocument()
  })

  it('disables the Post button when the input is empty', () => {
    render(<CommentComposer identity={identity} onChangeIdentity={() => {}} onSubmit={async () => {}} />)
    expect(screen.getByRole('button', { name: /post/i })).toBeDisabled()
  })

  it('calls onChangeIdentity when Change is clicked', async () => {
    const user = userEvent.setup()
    const onChangeIdentity = vi.fn()
    render(<CommentComposer identity={identity} onChangeIdentity={onChangeIdentity} onSubmit={async () => {}} />)
    await user.click(screen.getByRole('button', { name: /change/i }))
    expect(onChangeIdentity).toHaveBeenCalled()
  })
})
```

- [ ] **Step 5: Implement `CommentComposer`**

Create `src/features/share/comments/CommentComposer.tsx`:

```typescript
import { useState, type KeyboardEvent } from 'react'
import { COMMENT_BODY_MAX } from './commentTypes'
import type { StakeholderIdentity } from './identity'

export interface CommentComposerProps {
  identity: StakeholderIdentity
  onChangeIdentity: () => void
  onSubmit: (body: string) => Promise<void>
  disabled?: boolean
}

export function CommentComposer({ identity, onChangeIdentity, onSubmit, disabled }: CommentComposerProps) {
  const [value, setValue] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const remaining = COMMENT_BODY_MAX - value.length
  const showCounter = remaining <= 100
  const canSubmit = value.trim().length > 0 && !submitting && !disabled

  async function submit(): Promise<void> {
    if (!canSubmit) return
    setSubmitting(true)
    try {
      await onSubmit(value)
      setValue('')
    } finally {
      setSubmitting(false)
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>): void {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault()
      void submit()
    }
  }

  return (
    <div className="comment-composer">
      <div className="comment-composer-identity">
        <span className="comment-composer-name">{identity.name}</span>
        <span className="comment-composer-role">· {identity.role}</span>
        <button type="button" className="comment-composer-change" onClick={onChangeIdentity}>Change</button>
      </div>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value.slice(0, COMMENT_BODY_MAX))}
        onKeyDown={onKeyDown}
        placeholder="Leave a comment…"
        rows={3}
        disabled={disabled}
        aria-label="Comment body"
      />
      <div className="comment-composer-footer">
        {showCounter ? <span className="comment-composer-counter">{remaining} left</span> : <span />}
        <button type="button" onClick={submit} disabled={!canSubmit}>Post</button>
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Run CommentComposer tests**

Run:
```bash
npx vitest run src/features/share/comments/CommentComposer.test.tsx
```

Expected: PASS, 6 tests passing.

- [ ] **Step 7: Write the failing tests for `IdentitySheet`**

Create `src/features/share/comments/IdentitySheet.test.tsx`:

```typescript
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { IdentitySheet } from './IdentitySheet'

const STORAGE_KEY = 'flowent.stakeholder-identity.v1'

function clearStorage(): void {
  try { window.localStorage.removeItem(STORAGE_KEY) } catch { /* noop */ }
}

beforeEach(clearStorage)
afterEach(clearStorage)

describe('IdentitySheet', () => {
  it('renders name and role inputs', () => {
    render(<IdentitySheet onComplete={() => {}} onCancel={() => {}} />)
    expect(screen.getByLabelText(/display name/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/role tag/i)).toBeInTheDocument()
  })

  it('shows validation errors when fields are empty', async () => {
    const user = userEvent.setup()
    render(<IdentitySheet onComplete={() => {}} onCancel={() => {}} />)
    await user.click(screen.getByRole('button', { name: /save/i }))
    expect(screen.getByText(/name is required/i)).toBeInTheDocument()
  })

  it('calls onComplete with the trimmed identity and persists to localStorage', async () => {
    const user = userEvent.setup()
    const onComplete = vi.fn()
    render(<IdentitySheet onComplete={onComplete} />)

    await user.type(screen.getByLabelText(/display name/i), '  Alex  ')
    await user.type(screen.getByLabelText(/role tag/i), '  PM  ')
    await user.click(screen.getByRole('button', { name: /save/i }))

    expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Alex',
      role: 'PM',
    }))
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}')
    expect(stored.name).toBe('Alex')
    expect(stored.role).toBe('PM')
    expect(typeof stored.anonymousId).toBe('string')
  })

  it('calls onCancel when Esc is pressed', async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()
    render(<IdentitySheet onComplete={() => {}} onCancel={onCancel} />)
    await user.keyboard('{Escape}')
    expect(onCancel).toHaveBeenCalled()
  })

  it('does not show Cancel when onCancel is omitted', () => {
    render(<IdentitySheet onComplete={() => {}} />)
    expect(screen.queryByRole('button', { name: /cancel/i })).toBeNull()
  })
})
```

- [ ] **Step 8: Implement `IdentitySheet`**

Create `src/features/share/comments/IdentitySheet.tsx`:

```typescript
import { useEffect, useState } from 'react'
import { COMMENT_NAME_MAX, COMMENT_ROLE_MAX } from './commentTypes'
import { generateAnonymousId, writeIdentity, type StakeholderIdentity } from './identity'

export interface IdentitySheetProps {
  onComplete: (identity: StakeholderIdentity) => void
  onCancel?: () => void
  initialName?: string
  initialRole?: string
}

const ROLE_SUGGESTIONS = ['PM', 'Design', 'Eng', 'QA', 'EM', 'Other']

export function IdentitySheet({ onComplete, onCancel, initialName, initialRole }: IdentitySheetProps) {
  const [name, setName] = useState(initialName ?? '')
  const [role, setRole] = useState(initialRole ?? '')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') onCancel?.()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onCancel])

  function save(): void {
    const trimmedName = name.trim()
    const trimmedRole = role.trim()
    if (trimmedName.length === 0) return setError('Display name is required.')
    if (trimmedName.length > COMMENT_NAME_MAX) return setError(`Name must be ${COMMENT_NAME_MAX} chars or fewer.`)
    if (trimmedRole.length === 0) return setError('Role tag is required.')
    if (trimmedRole.length > COMMENT_ROLE_MAX) return setError(`Role must be ${COMMENT_ROLE_MAX} chars or fewer.`)

    const identity = writeIdentity({
      anonymousId: generateAnonymousId(),
      name: trimmedName,
      role: trimmedRole,
    })
    onComplete(identity)
  }

  return (
    <div className="identity-sheet-backdrop" role="dialog" aria-modal="true" aria-label="Sign in to comment">
      <div className="identity-sheet">
        <h2>Sign in to comment</h2>
        <p className="identity-sheet-help">No account required. We use this to attribute your comment to a name and role.</p>
        <label className="identity-sheet-field">
          <span>Display name</span>
          <input
            type="text"
            value={name}
            maxLength={COMMENT_NAME_MAX}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </label>
        <label className="identity-sheet-field">
          <span>Role tag</span>
          <input
            type="text"
            value={role}
            maxLength={COMMENT_ROLE_MAX}
            onChange={(e) => setRole(e.target.value)}
            placeholder="e.g. PM"
          />
        </label>
        <div className="identity-sheet-suggestions">
          {ROLE_SUGGESTIONS.map((r) => (
            <button type="button" key={r} className="identity-sheet-chip" onClick={() => setRole(r)}>{r}</button>
          ))}
        </div>
        {error ? <div className="identity-sheet-error">{error}</div> : null}
        <div className="identity-sheet-actions">
          {onCancel ? <button type="button" onClick={onCancel}>Cancel</button> : <span />}
          <button type="button" onClick={save}>Save</button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 9: Run IdentitySheet tests**

Run:
```bash
npx vitest run src/features/share/comments/IdentitySheet.test.tsx
```

Expected: PASS, 5 tests passing.

- [ ] **Step 10: Write the failing tests for `CommentsPanel`**

Create `src/features/share/comments/CommentsPanel.test.tsx`:

```typescript
import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CommentsPanel } from './CommentsPanel'
import type { Comment } from './commentTypes'
import type { GraphNode, GraphEdge } from '../../canvas/canvasTypes'
import type { StakeholderIdentity } from './identity'

const nodeMap = new Map<string, Pick<GraphNode, 'id' | 'title'>>([
  ['n1', { id: 'n1', title: 'Triage' }],
])
const edgeMap = new Map<string, Pick<GraphEdge, 'id' | 'label'>>([
  ['e1', { id: 'e1', label: 'PM review' }],
])

const comments: Comment[] = [
  {
    id: 'c1',
    mapId: 'map-1',
    anchor: { kind: 'node', nodeId: 'n1' },
    author: { name: 'Alex', role: 'PM' },
    body: 'Unclear owner',
    status: 'open',
    createdAt: '2026-06-15T00:00:00.000Z',
  },
  {
    id: 'c2',
    mapId: 'map-1',
    anchor: { kind: 'edge', edgeId: 'e1' },
    author: { name: 'Sam', role: 'Eng' },
    body: 'Add latency note',
    status: 'open',
    createdAt: '2026-06-15T01:00:00.000Z',
  },
  {
    id: 'c3',
    mapId: 'map-1',
    anchor: { kind: 'map' },
    author: { name: 'Priya', role: 'PM' },
    body: 'Where is the feedback loop?',
    status: 'resolved',
    createdAt: '2026-06-14T00:00:00.000Z',
    resolvedAt: '2026-06-15T02:00:00.000Z',
    resolvedBy: 'Alex',
  },
]

const identity: StakeholderIdentity = {
  anonymousId: 'anon-1', name: 'Alex', role: 'PM', updatedAt: '2026-06-15T00:00:00.000Z',
}

describe('CommentsPanel', () => {
  it('groups comments by element and shows map-wide at the bottom', () => {
    render(
      <CommentsPanel
        comments={comments}
        nodes={nodeMap}
        edges={edgeMap}
        filter="all"
        onFilterChange={() => {}}
        identity={identity}
        onPost={async () => {}}
        onChangeIdentity={() => {}}
        selectedAnchor={null}
      />,
    )
    expect(screen.getByText('Triage')).toBeInTheDocument()
    expect(screen.getByText('PM review')).toBeInTheDocument()
    expect(screen.getByText('Map-wide')).toBeInTheDocument()
  })

  it('hides resolved comments when filter is "open"', () => {
    render(
      <CommentsPanel
        comments={comments}
        nodes={nodeMap}
        edges={edgeMap}
        filter="open"
        onFilterChange={() => {}}
        identity={identity}
        onPost={async () => {}}
        onChangeIdentity={() => {}}
        selectedAnchor={null}
      />,
    )
    expect(screen.queryByText(/Where is the feedback loop/)).toBeNull()
  })

  it('shows the empty state when there are no comments', () => {
    render(
      <CommentsPanel
        comments={[]}
        nodes={nodeMap}
        edges={edgeMap}
        filter="open"
        onFilterChange={() => {}}
        identity={identity}
        onPost={async () => {}}
        onChangeIdentity={() => {}}
        selectedAnchor={null}
      />,
    )
    expect(screen.getByText(/no comments yet/i)).toBeInTheDocument()
  })

  it('calls onFilterChange when a filter segment is clicked', async () => {
    const user = userEvent.setup()
    const onFilterChange = vi.fn()
    render(
      <CommentsPanel
        comments={comments}
        nodes={nodeMap}
        edges={edgeMap}
        filter="open"
        onFilterChange={onFilterChange}
        identity={identity}
        onPost={async () => {}}
        onChangeIdentity={() => {}}
        selectedAnchor={null}
      />,
    )
    await user.click(screen.getByRole('button', { name: /all/i }))
    expect(onFilterChange).toHaveBeenCalledWith('all')
  })

  it('calls onPost with the body when the composer posts', async () => {
    const user = userEvent.setup()
    const onPost = vi.fn(async () => {})
    render(
      <CommentsPanel
        comments={[]}
        nodes={nodeMap}
        edges={edgeMap}
        filter="open"
        onFilterChange={() => {}}
        identity={identity}
        onPost={onPost}
        onChangeIdentity={() => {}}
        selectedAnchor={null}
      />,
    )
    await user.type(screen.getByRole('textbox'), 'hello')
    await user.click(screen.getByRole('button', { name: /post/i }))
    expect(onPost).toHaveBeenCalledWith('hello')
  })

  it('highlights the group matching the selected anchor', () => {
    const { container } = render(
      <CommentsPanel
        comments={comments}
        nodes={nodeMap}
        edges={edgeMap}
        filter="all"
        onFilterChange={() => {}}
        identity={identity}
        onPost={async () => {}}
        onChangeIdentity={() => {}}
        selectedAnchor={{ kind: 'node', nodeId: 'n1' }}
      />,
    )
    const triageGroup = container.querySelector('[data-anchor-id="n1"]')
    expect(triageGroup?.className).toMatch(/is-selected/)
    const edgeGroup = container.querySelector('[data-anchor-id="e1"]')
    expect(edgeGroup?.className ?? '').not.toMatch(/is-selected/)
    void within
  })
})
```

- [ ] **Step 11: Implement `CommentsPanel`**

Create `src/features/share/comments/CommentsPanel.tsx`:

```typescript
import { useMemo } from 'react'
import type { Comment, CommentAnchor } from './commentTypes'
import type { StakeholderIdentity } from './identity'
import { groupCommentsByAnchor } from './groupCommentsByAnchor'
import { CommentRow } from './CommentRow'
import { CommentComposer } from './CommentComposer'

export type CommentFilter = 'open' | 'all' | 'resolved'

export interface CommentsPanelProps {
  comments: Comment[]
  nodes: Map<string, { id: string; title?: string }>
  edges: Map<string, { id: string; label?: string }>
  filter: CommentFilter
  onFilterChange: (filter: CommentFilter) => void
  identity: StakeholderIdentity
  onPost: (body: string) => Promise<void>
  onChangeIdentity: () => void
  selectedAnchor: CommentAnchor | null
  ownerActions?: {
    onResolve: (commentId: string) => void
    onReopen: (commentId: string) => void
    onDelete: (commentId: string) => void
  }
}

export function CommentsPanel({
  comments,
  nodes,
  edges,
  filter,
  onFilterChange,
  identity,
  onPost,
  onChangeIdentity,
  selectedAnchor,
  ownerActions,
}: CommentsPanelProps) {
  const filtered = useMemo(
    () =>
      filter === 'open'
        ? comments.filter((c) => c.status === 'open')
        : filter === 'resolved'
          ? comments.filter((c) => c.status === 'resolved')
          : comments,
    [comments, filter],
  )

  const grouped = useMemo(
    () => groupCommentsByAnchor(filtered, nodes, edges),
    [filtered, nodes, edges],
  )

  const unresolvedCount = comments.filter((c) => c.status === 'open').length

  const isSelected = (id: string): boolean => {
    if (!selectedAnchor) return false
    if (selectedAnchor.kind === 'node') return selectedAnchor.nodeId === id
    if (selectedAnchor.kind === 'edge') return selectedAnchor.edgeId === id
    return false
  }

  return (
    <aside className="comments-panel" aria-label="Comments">
      <header className="comments-panel-header">
        <span className="comments-panel-title">Comments · {unresolvedCount} unresolved</span>
        <div className="comments-panel-filter" role="group" aria-label="Filter comments">
          <button
            type="button"
            className={filter === 'open' ? 'is-active' : ''}
            onClick={() => onFilterChange('open')}
          >Unresolved</button>
          <button
            type="button"
            className={filter === 'all' ? 'is-active' : ''}
            onClick={() => onFilterChange('all')}
          >All</button>
          <button
            type="button"
            className={filter === 'resolved' ? 'is-active' : ''}
            onClick={() => onFilterChange('resolved')}
          >Resolved</button>
        </div>
      </header>

      <div className="comments-panel-body">
        {filtered.length === 0 ? (
          <div className="comments-panel-empty">No comments yet.</div>
        ) : (
          <>
            {grouped.elementGroups.map((group) => (
              <section
                key={group.id}
                className={`comments-panel-group ${isSelected(group.id) ? 'is-selected' : ''}`}
                data-anchor-id={group.id}
              >
                <h3 className="comments-panel-group-title">{group.title}</h3>
                {group.comments.map((c) => (
                  <CommentRow
                    key={c.id}
                    comment={c}
                    ownerMode={Boolean(ownerActions)}
                    onResolve={ownerActions?.onResolve}
                    onReopen={ownerActions?.onReopen}
                    onDelete={ownerActions?.onDelete}
                  />
                ))}
              </section>
            ))}
            {grouped.mapWide.length > 0 ? (
              <section className="comments-panel-group comments-panel-mapwide">
                <h3 className="comments-panel-group-title">Map-wide</h3>
                {grouped.mapWide.map((c) => (
                  <CommentRow
                    key={c.id}
                    comment={c}
                    ownerMode={Boolean(ownerActions)}
                    onResolve={ownerActions?.onResolve}
                    onReopen={ownerActions?.onReopen}
                    onDelete={ownerActions?.onDelete}
                  />
                ))}
              </section>
            ) : null}
          </>
        )}
      </div>

      <div className="comments-panel-composer">
        <CommentComposer
          identity={identity}
          onChangeIdentity={onChangeIdentity}
          onSubmit={onPost}
        />
      </div>
    </aside>
  )
}
```

- [ ] **Step 12: Run CommentsPanel tests**

Run:
```bash
npx vitest run src/features/share/comments/CommentsPanel.test.tsx
```

Expected: PASS, 6 tests passing.

- [ ] **Step 13: Commit**

Run:
```bash
git add src/features/share/comments/CommentRow.tsx src/features/share/comments/CommentRow.test.tsx \
        src/features/share/comments/CommentComposer.tsx src/features/share/comments/CommentComposer.test.tsx \
        src/features/share/comments/IdentitySheet.tsx src/features/share/comments/IdentitySheet.test.tsx \
        src/features/share/comments/CommentsPanel.tsx src/features/share/comments/CommentsPanel.test.tsx
git commit -m "feat(share): add CommentsPanel + supporting components"
```

---

## Task 10: Share View, ProcessCanvas readOnly, Toolbar Share Button, and Comments Tab

**Files:**
- Create: `src/features/share/ShareHost.tsx`
- Create: `src/features/share/ShareHost.test.tsx`
- Create: `src/features/share/ShareView.tsx`
- Create: `src/features/share/ShareView.test.tsx`
- Create: `src/features/share/render/drawCommentBadges.ts`
- Create: `src/features/share/render/drawCommentBadges.test.ts`
- Modify: `src/features/canvas/ProcessCanvas.tsx` (add `readOnly` prop and `onElementClick`)
- Modify: `src/features/canvas/Toolbar.tsx` (add Share button)
- Modify: `src/features/canvas/PropertiesPanel.tsx` (add Comments tab/section)
- Modify: `src/features/canvas/render/drawNodes.ts` (accept and render `commentBadges`)
- Modify: `src/features/canvas/render/drawEdges.ts` (accept and render `commentBadges`)
- Modify: `src/features/canvas/canvasTypes.ts` (re-export comment types)
- Modify: `src/features/canvas/LibraryGate.tsx` (switch on `?share=` URL param)
- Modify: `src/features/canvas/registerCanvasTestHooks.ts` (add test hook for comment count)

This is a larger task. Each sub-step below is sized to be committable on its own.

- [ ] **Step 1: Re-export the comment types from the canvas types barrel**

In `src/features/canvas/canvasTypes.ts`, append the following at the bottom:

```typescript
// Re-exported for convenience so existing canvas code can use the same import path.
export type {
  Comment,
  CommentAnchor,
  CommentAuthor,
  CommentStatus,
} from '../share/comments/commentTypes'
```

- [ ] **Step 2: Write the failing tests for `drawCommentBadges`**

Create `src/features/share/render/drawCommentBadges.test.ts`:

```typescript
import { describe, expect, it } from 'vitest'
import { commentBadgeLabel } from './drawCommentBadges'

describe('commentBadgeLabel', () => {
  it('returns "💬 N" for positive counts', () => {
    expect(commentBadgeLabel(1)).toBe('💬 1')
    expect(commentBadgeLabel(7)).toBe('💬 7')
  })

  it('returns null for non-positive counts', () => {
    expect(commentBadgeLabel(0)).toBeNull()
    expect(commentBadgeLabel(-1)).toBeNull()
  })
})
```

- [ ] **Step 3: Implement `drawCommentBadges`**

Create `src/features/share/render/drawCommentBadges.ts`:

```typescript
import { Container, Graphics, Text } from 'pixi.js'

export function commentBadgeLabel(count: number): string | null {
  if (count <= 0) return null
  return `💬 ${count}`
}

export interface DrawCommentBadgeOptions {
  /** x position in canvas world coords */
  x: number
  /** y position in canvas world coords */
  y: number
  /** anchor (0..1) for label alignment relative to (x,y). Default top-right. */
  anchorX?: number
  anchorY?: number
  /** Whether there are any unresolved comments (changes the chip color). */
  hasOpen: boolean
}

/**
 * Draw a small comment-count chip at the given world coords. The returned
 * Container has `eventMode = 'none'` so it never blocks pointer events on
 * the underlying node or edge.
 */
export function drawCommentBadge(count: number, options: DrawCommentBadgeOptions): Container | null {
  const label = commentBadgeLabel(count)
  if (!label) return null

  const container = new Container()
  container.x = options.x
  container.y = options.y
  ;(container as Container & { eventMode?: string }).eventMode = 'none'
  container.label = `comment-badge:${label}`

  const text = new Text({
    text: label,
    style: {
      fontFamily:
        '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", "Segoe UI", sans-serif',
      fontSize: 11,
      fontWeight: '600',
      fill: options.hasOpen ? 0x0071e3 : 0x8a8a8e,
    },
  })

  const padX = 6
  const padY = 2
  const shape = new Graphics()
  shape.roundRect(-text.width / 2 - padX, -text.height / 2 - padY, text.width + padX * 2, text.height + padY * 2, 8)
  shape.fill({ color: 0xffffff, alpha: 0.92 })
  shape.stroke({ color: options.hasOpen ? 0x0071e3 : 0xc4c4c6, width: 1 })

  const ax = options.anchorX ?? 0.5
  const ay = options.anchorY ?? 0.5

  text.x = -text.width / 2
  text.y = -text.height / 2

  container.addChild(shape)
  container.addChild(text)
  container.x += -ax * (text.width + padX * 2)
  container.y += -ay * (text.height + padY * 2)

  return container
}
```

- [ ] **Step 4: Run drawCommentBadges tests**

Run:
```bash
npx vitest run src/features/share/render/drawCommentBadges.test.ts
```

Expected: PASS, 2 tests passing.

- [ ] **Step 5: Add `commentBadges` parameter to `drawNodes`**

In `src/features/canvas/render/drawNodes.ts`, find the `DrawNodesOptions` interface and add:

```typescript
export interface DrawNodesOptions {
  dimmedNodeIds?: Set<string>
  commentBadges?: Map<string, number>
}
```

Then, in `drawNodes` after the existing container setup and **before** the `layer.addChild(container)` line at the end of the loop, append:

```typescript
    const openCount = options.commentBadges?.get(node.id) ?? 0
    if (openCount > 0) {
      const { drawCommentBadge } = await import('../../share/render/drawCommentBadges')
      const badge = drawCommentBadge(openCount, {
        x: node.width,
        y: 0,
        anchorX: 1,
        anchorY: 0,
        hasOpen: true,
      })
      if (badge) container.addChild(badge)
    }
```

Note: the dynamic `import('../../share/render/drawCommentBadges')` keeps the existing static graph (which does not depend on the share feature) free of the comment feature for users who don't enable it. If the import path doesn't resolve, replace the dynamic import with a static `import { drawCommentBadge } from '../../share/render/drawCommentBadges'` at the top of the file.

- [ ] **Step 6: Add `commentBadges` parameter to `drawEdges`**

In `src/features/canvas/render/drawEdges.ts`, find the `DrawEdgesOptions` interface and add:

```typescript
  commentBadges?: Map<string, number>
```

Then, in the `drawEdges` function **after** the loop adds the `hit` Graphics to the layer but **before** the loop closes, add the badge for the edge. The badge should sit on top of the label. Find the label placement block (look for `labelCenter = sampleBezierMidpoint(points)`) and after the metadata loop, append:

```typescript
      const edgeOpen = options.commentBadges?.get(edge.id) ?? 0
      if (edgeOpen > 0) {
        const { drawCommentBadge } = await import('../../share/render/drawCommentBadges')
        const badge = drawCommentBadge(edgeOpen, {
          x: labelCenter.x,
          y: labelCenter.y - 24,
          hasOpen: true,
        })
        if (badge) layer.addChild(badge)
      }
```

(Use a static import if you changed Step 5 to do so.)

- [ ] **Step 7: Add `readOnly` and `onElementClick` props to `ProcessCanvas`**

In `src/features/canvas/ProcessCanvas.tsx`, modify the `ProcessCanvas` props type and add the gate logic.

Replace the existing signature:

```typescript
export function ProcessCanvas(props: { mapId?: string; initialDocument?: import('./canvasTypes').GraphDocument; onAutosave?: (doc: import('./canvasTypes').GraphDocument) => void } = {}) {
```

with:

```typescript
interface ProcessCanvasProps {
  mapId?: string
  initialDocument?: import('./canvasTypes').GraphDocument
  onAutosave?: (doc: import('./canvasTypes').GraphDocument) => void
  readOnly?: boolean
  onElementClick?: (anchor:
    | { kind: 'node'; nodeId: string }
    | { kind: 'edge'; edgeId: string }
    | { kind: 'map' }
  ) => void
  commentBadges?: Map<string, number>
}

export function ProcessCanvas(props: ProcessCanvasProps = {}) {
  const readOnly = props.readOnly === true
  // ...
}
```

Then, find the body of the component and locate the place where `onNodeClick` is wired to the canvas host. When `readOnly` is true, route the click to `props.onElementClick` instead of mutating selection. Specifically, in `registerCanvasNativeHandlers`, the `CanvasLike` interface has `onNodeClick`/`onEdgeClick`. To preserve behavior, add an `onElementClick` field to the `CanvasLike` interface inside `registerCanvasNativeHandlers.ts`:

```typescript
  onElementClick?: (anchor:
    | { kind: 'node'; nodeId: string }
    | { kind: 'edge'; edgeId: string }
    | { kind: 'map' }
  ) => void
```

Then, in `ProcessCanvas.tsx`, in the place where `onNodeClick` is plumbed into `getCanvas`, add a parallel `onElementClick` field. In the `registerCanvasNativeHandlers` body, find where `onNodeClick` is dispatched and add:

```typescript
      if (readOnly && onElementClick) {
        onElementClick({ kind: 'node', nodeId })
        return
      }
      // existing onNodeClick branch
```

Apply the same pattern for edge clicks.

Pass `commentBadges` through to `drawNodes` and `drawEdges` (extend the two call sites to include `commentBadges: props.commentBadges`).

When `readOnly` is true, **do not** mount `<Toolbar />` — return `null` for the toolbar element instead. The exact wrapper element depends on the existing JSX; locate the JSX that renders `<Toolbar />` and wrap it:

```typescript
{!readOnly ? <Toolbar ... /> : null}
```

- [ ] **Step 8: Write the failing tests for `ShareHost`**

Create `src/features/share/ShareHost.test.tsx`:

```typescript
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ShareHost } from './ShareHost'

vi.mock('../canvas/ProcessCanvas', () => ({
  ProcessCanvas: (props: { mapId?: string }) => (
    <div data-testid="process-canvas" data-map={props.mapId ?? ''} />
  ),
}))

const loadDocument = vi.fn()
const saveDocument = vi.fn()

describe('ShareHost', () => {
  it('renders the ProcessCanvas for the given mapId', () => {
    render(
      <ShareHost
        mapId="map-1"
        loadDocument={loadDocument}
        onAutosave={saveDocument}
        initialDocument={{ id: 'map-1', nodes: new Map(), edges: new Map(), selectedNodeIds: new Set(), selectedEdgeIds: new Set(), viewport: { x: 0, y: 0, zoom: 1 }, meta: { dirty: false, version: 0 } }}
      />,
    )
    expect(screen.getByTestId('process-canvas')).toHaveAttribute('data-map', 'map-1')
  })
})
```

- [ ] **Step 9: Implement `ShareHost`**

Create `src/features/share/ShareHost.tsx`:

```typescript
import { useEffect, useMemo, useState } from 'react'
import type { GraphDocument } from '../canvas/canvasTypes'

interface ShareHostProps {
  mapId: string
  initialDocument?: GraphDocument
  loadDocument: (mapId: string) => Promise<GraphDocument | null>
  onAutosave?: (doc: GraphDocument) => void
}

export function ShareHost({ mapId, initialDocument, loadDocument, onAutosave }: ShareHostProps) {
  const [doc, setDoc] = useState<GraphDocument | null>(initialDocument ?? null)

  useEffect(() => {
    if (initialDocument) {
      setDoc(initialDocument)
      return
    }
    let cancelled = false
    void loadDocument(mapId).then((loaded) => {
      if (!cancelled) setDoc(loaded)
    })
    return () => {
      cancelled = true
    }
  }, [mapId, initialDocument, loadDocument])

  const stableDoc = useMemo(() => doc, [doc])

  if (!stableDoc) return <div className="share-host-loading">Loading map…</div>

  return <ShareCanvas mapId={mapId} initialDocument={stableDoc} onAutosave={onAutosave} />
}

// Indirection so the import below is statically analyzable.
import { ProcessCanvas } from '../canvas/ProcessCanvas'
function ShareCanvas(props: { mapId: string; initialDocument: GraphDocument; onAutosave?: (doc: GraphDocument) => void }) {
  return (
    <ProcessCanvas
      mapId={props.mapId}
      initialDocument={props.initialDocument}
      onAutosave={props.onAutosave}
      readOnly
    />
  )
}
```

- [ ] **Step 10: Write the failing tests for `ShareView`**

Create `src/features/share/ShareView.test.tsx`:

```typescript
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ShareView } from './ShareView'

vi.mock('./ShareHost', () => ({
  ShareHost: () => <div data-testid="share-host" />,
}))

vi.mock('../canvas/ProcessCanvas', () => ({
  // Not used directly here, but ShareView imports types from canvas.
  ProcessCanvas: () => null,
}))

const identity = {
  anonymousId: 'anon-1', name: 'Alex', role: 'PM', updatedAt: '2026-06-15T00:00:00.000Z',
}

describe('ShareView', () => {
  it('renders the share host and the comments panel', () => {
    render(
      <ShareView
        mapId="map-1"
        comments={[]}
        nodes={new Map()}
        edges={new Map()}
        identity={identity}
        onPost={async () => {}}
        onChangeIdentity={() => {}}
        onResolve={() => {}}
        onReopen={() => {}}
        onDelete={() => {}}
        selectedAnchor={null}
      />,
    )
    expect(screen.getByTestId('share-host')).toBeInTheDocument()
    expect(screen.getByRole('complementary', { name: /comments/i })).toBeInTheDocument()
  })
})
```

- [ ] **Step 11: Implement `ShareView`**

Create `src/features/share/ShareView.tsx`:

```typescript
import { useMemo, useState } from 'react'
import type { Comment, CommentAnchor } from './comments/commentTypes'
import type { StakeholderIdentity } from './comments/identity'
import { CommentsPanel, type CommentFilter } from './comments/CommentsPanel'
import { deriveCommentBadges } from './comments/deriveCommentBadges'
import { ShareHost } from './ShareHost'
import type { GraphDocument } from '../canvas/canvasTypes'

export interface ShareViewProps {
  mapId: string
  initialDocument?: GraphDocument
  loadDocument?: (mapId: string) => Promise<GraphDocument | null>
  comments: Comment[]
  nodes: Map<string, { id: string; title?: string }>
  edges: Map<string, { id: string; label?: string }>
  identity: StakeholderIdentity
  onPost: (body: string) => Promise<void>
  onChangeIdentity: () => void
  onResolve: (commentId: string) => void
  onReopen: (commentId: string) => void
  onDelete: (commentId: string) => void
  selectedAnchor: CommentAnchor | null
}

export function ShareView(props: ShareViewProps) {
  const [filter, setFilter] = useState<CommentFilter>('open')
  const badges = useMemo(() => deriveCommentBadges(props.comments), [props.comments])

  return (
    <div className="share-view">
      <ShareHost
        mapId={props.mapId}
        initialDocument={props.initialDocument}
        loadDocument={props.loadDocument}
      />
      <CommentsPanel
        comments={props.comments}
        nodes={props.nodes}
        edges={props.edges}
        filter={filter}
        onFilterChange={setFilter}
        identity={props.identity}
        onPost={props.onPost}
        onChangeIdentity={props.onChangeIdentity}
        selectedAnchor={props.selectedAnchor}
        ownerActions={{
          onResolve: props.onResolve,
          onReopen: props.onReopen,
          onDelete: props.onDelete,
        }}
      />
    </div>
  )
}
```

- [ ] **Step 12: Add a Share button to the existing `Toolbar`**

In `src/features/canvas/Toolbar.tsx`, locate the existing toolbar markup and add a button before the existing Export/Activate buttons (or after Layout — match the existing button order). Add:

```typescript
<button
  type="button"
  className="toolbar-share"
  onClick={onShare}
  aria-label="Share map"
>
  Share
</button>
```

The `Toolbar` props type gains `onShare?: () => void`. Wire the prop through from `ProcessCanvas` so that `onShare` constructs the share URL:

```typescript
function buildShareUrl(mapId: string): string {
  const url = new URL(window.location.href)
  url.search = `?share=${encodeURIComponent(mapId)}`
  return url.toString()
}
```

And in the click handler:

```typescript
async function onShare(): Promise<void> {
  const link = buildShareUrl(mapId)
  try {
    await navigator.clipboard.writeText(link)
  } catch {
    // Fall back to a manual prompt in environments without clipboard access.
    window.prompt('Copy this share link', link)
  }
}
```

- [ ] **Step 13: Add a Comments tab/section to `PropertiesPanel`**

In `src/features/canvas/PropertiesPanel.tsx`, locate the existing element editor and add a tabbed shell around it:

```typescript
const [tab, setTab] = useState<'element' | 'comments'>('element')
```

Add a tab strip at the top of the panel:

```tsx
<div className="properties-panel-tabs" role="tablist">
  <button role="tab" aria-selected={tab === 'element'} onClick={() => setTab('element')}>Element</button>
  <button role="tab" aria-selected={tab === 'comments'} onClick={() => setTab('comments')}>Comments</button>
</div>
```

When `tab === 'comments'`, render the `CommentsPanel` (passing the same comment list, identity, and `onPost`/`onResolve`/`onReopen`/`onDelete` handlers wired through from `ProcessCanvas`). Wire the existing `useComments`/`useCommentActions` hooks to back the panel — the easiest path is to mount them at `ProcessCanvas` and pass `comments` plus action callbacks down through `PropertiesPanel` props.

- [ ] **Step 14: Wire the editor to the comment hooks**

In `src/features/canvas/ProcessCanvas.tsx`, add:

```typescript
import { useComments } from '../share/comments/useComments'
import { useCommentActions } from '../share/comments/useCommentActions'

// ... inside the component body, when mapId is known:
const { comments, refresh } = useComments(props.mapId ?? null)
const actions = useCommentActions(props.mapId ?? '')
```

Set the editor cookie when the canvas mounts in editor mode (so PATCH/DELETE calls pass the gate):

```typescript
useEffect(() => {
  if (readOnly) return
  document.cookie = 'flowent-editor=1; Path=/; SameSite=Lax'
}, [readOnly])
```

Pass `comments`, `refresh`, and the `actions` callbacks down to `PropertiesPanel` and to `<CommentsPanel>`.

- [ ] **Step 15: Switch `LibraryGate` on `?share=`**

In `src/features/canvas/LibraryGate.tsx`, near the existing `URL_PARAM` constant, add:

```typescript
const SHARE_PARAM = 'share'

function readShareMapId(): string | null {
  if (typeof window === 'undefined') return null
  const url = new URL(window.location.href)
  return url.searchParams.get(SHARE_PARAM)
}
```

When `readShareMapId()` returns a non-null id, render the new `<ShareHost>` (or `<ShareView>`) inside the gate instead of `<CanvasHost>`. Add a branch near the existing return:

```tsx
const shareMapId = readShareMapId()
if (shareMapId) {
  return (
    <ShareView
      mapId={shareMapId}
      comments={comments}
      nodes={nodes}
      edges={edges}
      identity={identity}
      onPost={...}
      onChangeIdentity={...}
      onResolve={...}
      onReopen={...}
      onDelete={...}
      selectedAnchor={...}
    />
  )
}
```

The `comments`/`identity`/etc. are the same hooks used by the editor; lift them to the gate and pass them down.

- [ ] **Step 16: Add a test hook for comment counts**

In `src/features/canvas/registerCanvasTestHooks.ts`, add:

```typescript
;(window as unknown as { __flowentGetCommentCount?: (id: string) => number | null }).__flowentGetCommentCount = (id: string) => {
  const fromCanvas = canvasRef.current.document.nodes.get(id) ?? canvasRef.current.document.edges.get(id)
  if (!fromCanvas) return null
  return commentCountRef.current?.get(id) ?? 0
}
```

Add a `commentCountRef: { current: Map<string, number> | null }` to `RegisterCanvasTestHooksArgs` and update the call site in `ProcessCanvas.tsx` to pass the live `Map` from `useComments` data.

- [ ] **Step 17: Run all tests and the type-check**

Run:

```bash
npx vitest run
npx tsc --noEmit --pretty false
```

Expected: all unit and component tests pass; type-check passes.

- [ ] **Step 18: Commit**

Run:
```bash
git add src/features/share src/features/canvas/ProcessCanvas.tsx \
        src/features/canvas/Toolbar.tsx src/features/canvas/PropertiesPanel.tsx \
        src/features/canvas/render/drawNodes.ts src/features/canvas/render/drawEdges.ts \
        src/features/canvas/canvasTypes.ts src/features/canvas/LibraryGate.tsx \
        src/features/canvas/registerCanvasTestHooks.ts
git commit -m "feat(share): wire ShareView, read-only canvas, and PropertiesPanel comments tab"
```

---

## Task 11: End-to-End Share-by-Link Coverage

**Files:**
- Create: `e2e/share-by-link.spec.ts`

- [ ] **Step 1: Write the E2E spec**

Create `e2e/share-by-link.spec.ts`:

```typescript
import { test, expect } from '@playwright/test'

const pixiCanvas = '.pixi-host canvas'
const statusBar = '.status-bar'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.evaluate(async () => {
    try { localStorage.clear() } catch { /* noop */ }
    history.replaceState(null, '', '/')
    document.cookie = 'flowent-editor=; Max-Age=0; Path=/'
    const res = await fetch('/api/library')
    const body = await res.json() as { data: { maps: { id: string }[] } }
    for (const map of body.data.maps) {
      await fetch(`/api/library/maps/${map.id}`, { method: 'DELETE' })
    }
  })
  await page.reload()
  await page.waitForSelector(pixiCanvas)
})

test('owner copies the share link and opens the share surface', async ({ page }) => {
  await expect(page.locator(statusBar)).toContainText('1 nodes')

  await page.getByRole('button', { name: /share/i }).click()

  const shareLink = await page.evaluate(() => {
    const link = document.querySelector('.toolbar-share-link') as HTMLInputElement | null
    return link?.value ?? null
  })
  expect(shareLink).toMatch(/\?share=/)

  // Open the share surface in a fresh context (no editor cookie).
  const ctx = await page.context().browser()!.newContext()
  const stakeholder = await ctx.newPage()
  await stakeholder.goto(shareLink!)
  await stakeholder.waitForSelector('.comments-panel')
  await expect(stakeholder.locator('canvas')).toBeVisible()
  await expect(stakeholder.getByRole('complementary', { name: /comments/i })).toBeVisible()
  await ctx.close()
})

test('stakeholder posts a comment after providing identity', async ({ page }) => {
  const shareUrl = await page.evaluate(async () => {
    const res = await fetch('/api/library')
    const body = await res.json() as { data: { maps: { id: string }[] } }
    const mapId = body.data.maps[0]!.id
    return `/?share=${mapId}`
  })

  await page.goto(shareUrl)
  await page.waitForSelector('.comments-panel')

  // First composer focus opens the identity sheet.
  await page.getByRole('textbox', { name: /comment body/i }).click()
  await page.getByLabel(/display name/i).fill('Alex')
  await page.getByLabel(/role tag/i).fill('PM')
  await page.getByRole('button', { name: /save/i }).click()

  await page.getByRole('textbox', { name: /comment body/i }).fill('Unclear owner')
  await page.getByRole('button', { name: /post/i }).click()

  await expect(page.getByText('Unclear owner')).toBeVisible()
  await expect(page.getByText('Alex')).toBeVisible()
})

test('owner sees and resolves the comment, stakeholder sees resolved state', async ({ page }) => {
  // Seed a comment via the API as a "stakeholder" (no cookie).
  const mapId = await page.evaluate(async () => {
    const res = await fetch('/api/library')
    const body = await res.json() as { data: { maps: { id: string }[] } }
    return body.data.maps[0]!.id
  })
  await page.evaluate(async (id) => {
    await fetch(`/api/comments/${id}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ anchor: { kind: 'map' }, author: { name: 'Sam', role: 'Eng' }, body: 'feedback loop missing' }),
    })
  }, mapId)

  // Owner opens the editor at ?map=:id.
  await page.goto(`/?map=${mapId}`)
  await page.waitForSelector(pixiCanvas)
  await page.getByRole('tab', { name: /comments/i }).click()
  await expect(page.getByText('feedback loop missing')).toBeVisible()

  await page.getByRole('button', { name: /resolve/i }).click()
  await expect(page.getByText('Resolved')).toBeVisible()

  // Stakeholder refreshes and sees the resolved state.
  const ctx = await page.context().browser()!.newContext()
  const stakeholder = await ctx.newPage()
  await stakeholder.goto(`/?share=${mapId}`)
  await stakeholder.waitForSelector('.comments-panel')
  await stakeholder.getByRole('button', { name: /^all$/i }).click()
  await expect(stakeholder.getByText('Resolved')).toBeVisible()
  await ctx.close()
})
```

- [ ] **Step 2: Run the E2E spec**

Run:
```bash
npx playwright test e2e/share-by-link.spec.ts
```

Expected: PASS, 3 tests passing.

- [ ] **Step 3: Commit**

Run:
```bash
git add e2e/share-by-link.spec.ts
git commit -m "test: cover share-by-link end-to-end"
```

---

## Task 12: Quality Gate and Documentation

**Files:**
- Modify: `README.md` (document the share-by-link surface)
- Modify: `docs/superpowers/specs/2026-06-04-flowent-canvas-builder-concept-design.md` (mark §4.5 share-link slice as in-progress → done, since this slice lands it)
- Modify: `docs/superpowers/plans/2026-06-04-flowent-canvas-builder-foundation.md` (mark "Stakeholder share links and read-only views" as done)
- Modify: `MEMORY.md` (auto-memory — note the share surface lands)

- [ ] **Step 1: Run the full suite one more time**

Run:

```bash
npx vitest run
npx tsc --noEmit --pretty false
npx playwright test
```

Expected: everything green. If anything fails, fix it and re-run before committing.

- [ ] **Step 2: Update the project README with the share-by-link section**

In `README.md`, add a "Share a map" subsection inside the existing flow documentation (find the section that already describes designing → reviewing → activating). The new subsection should explain:

- How to copy a share link from the editor toolbar
- What the stakeholder sees at `?share=:mapId`
- How to post and resolve comments
- That no account is required

Use the existing README tone and headings. Keep it short — three to five bullets plus a screenshot placeholder.

- [ ] **Step 3: Update the canvas builder concept design doc**

In `docs/superpowers/specs/2026-06-04-flowent-canvas-builder-concept-design.md`, find §4.5 "Share, Export, and Activate" and append a note at the end:

```markdown
> Implementation note: the share-by-link + comment surface slice is documented in `docs/superpowers/specs/2026-06-15-flowent-share-by-link-design.md` and shipped by `docs/superpowers/plans/2026-06-15-flowent-share-by-link.md`. PDF/PNG/SVG export and per-version snapshots remain future work.
```

- [ ] **Step 4: Update the foundation plan with a "done" marker**

In `docs/superpowers/plans/2026-06-04-flowent-canvas-builder-foundation.md`, find the bullet "Stakeholder share links and read-only views" and append a `[✓ done — see 2026-06-15 plan]` marker.

- [ ] **Step 5: Commit**

Run:
```bash
git add README.md docs/superpowers/specs/2026-06-04-flowent-canvas-builder-concept-design.md \
        docs/superpowers/plans/2026-06-04-flowent-canvas-builder-foundation.md
git commit -m "docs: cover share-by-link surface in README and concept design"
```

---

## Self-Review

**Spec coverage** — running through the spec section by section:

| Spec section | Implementation task |
|---|---|
| §1 Purpose and scope | All tasks |
| §2 Confirmed decisions (table) | Encoded across Tasks 1–11 |
| §3 In Scope (all bullets) | Tasks 1–11 |
| §3 Out of Scope | None implemented (correct) |
| §4 Information architecture | Task 10 (URL params, surface comparison, anchor kinds) |
| §5.1 Generate share link | Task 10 Step 12 (Toolbar Share button + clipboard) |
| §5.2 First visit | Task 9 IdentitySheet + Task 10 ShareView |
| §5.3 Posting a comment | Task 8 useCommentActions + Task 10 ShareView |
| §5.4 Map-wide comments | Task 1 anchor union + Task 2 grouping |
| §5.5 Owner side | Task 10 PropertiesPanel Comments tab + Task 11 e2e |
| §5.6 Filter and group | Task 9 CommentsPanel |
| §6 Data model | Tasks 1 (types), 5 (store schema), 6 (route) |
| §7.1 Module layout | Tasks 1–10 |
| §7.2 Modified files | Task 10 |
| §7.3 Read-only canvas mode | Task 10 Step 7 |
| §7.4 Persistence layer | Task 5 (store), Task 6 (route), Task 14 (cookie) |
| §7.5 Concurrency model | Tasks 7 (refresh), 10 (re-mount on mapId change) |
| §8 Visual language | Task 10 Step 3 (badges), Step 9 (ShareHost), Step 11 (ShareView layout) |
| §9 Keyboard shortcuts | Task 9 Step 4 (Cmd/Ctrl+Enter in composer). Other shortcuts (zoom/fit/focus) are inherited from the existing canvas. The Esc-to-close-identity-sheet is in Task 9 Step 8. |
| §10.1 Unit testing | Tasks 1, 2, 3, 4, 5, 7, 8 |
| §10.2 Component testing | Tasks 9 |
| §10.3 E2E testing | Task 11 |
| §10.4 Done criteria | Task 12 |
| §11 Migration and compatibility | Step 4 (Task 5) updates the schema; Task 10 Step 1 re-exports types; `data/library.json` migration is handled by the schema's `default({})`. |

**Placeholder scan** — no "TBD", "TODO", "implement later", "fill in details", "add appropriate error handling", or "similar to Task N" in the plan.

**Type consistency** — `Comment`, `CommentAnchor`, `CommentAuthor`, `CommentStatus` are defined in Task 1 and re-exported via Task 10 Step 1. `StakeholderIdentity` is defined in Task 4 and consumed by `CommentComposer`, `IdentitySheet`, and `CommentsPanel` in Task 9. `CommentFilter` is defined in `CommentsPanel.tsx` (Task 9 Step 11) and consumed only by `CommentsPanel`. `commentBadges: Map<string, number>` is used consistently in Task 3 (helper), Task 10 Steps 5–6 (drawNodes/drawEdges), and Task 10 Step 11 (`deriveCommentBadges` produces the same shape). `mapId` is consistently used as the routing key.

**Coverage gaps fixed inline** — none outstanding.

---

## Validation Summary

- All unit tests pass (Tasks 1–8)
- All component tests pass (Tasks 9–10)
- The e2e spec passes on a fresh `data/library.json` (Task 11)
- No regression in the existing canvas e2e specs (Task 12)
- The `ProcessCanvas` `readOnly` mode does not break the existing editor (Task 12)
- The Share button is reachable from the existing toolbar (Task 12)
- The Comments tab in the Properties panel renders without errors on maps with no comments (Task 9)
- The build, lint, and type-check pass cleanly (Task 12)
