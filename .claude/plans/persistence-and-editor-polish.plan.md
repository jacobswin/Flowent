# Plan: Canvas Polish — Zoom Step, Node Editing, File Persistence, Library Sidebar

**Source**: User follow-ups after Flowent Milestone 7 ("validation-prototype")
**Complexity**: Medium
**Status**: pending → in-progress after approval

## Summary
Four related improvements to make the canvas feel like a real process-development tool:
faster zoom, in-place node editing, automatic persistence, and a left-side library
of saved maps. Currently edits are lost on refresh and only one map exists at a time.

## Patterns to Mirror
| Category | Source | Pattern |
|---|---|---|
| Server routes | `server/index.ts:21-37` | Plain `http.createServer` + URL routing; one file-per-route, no framework |
| Web → server | `vite.config.ts:7-9` | Vite dev proxy `/api` → `http://127.0.0.1:8787` |
| State writes | `useCanvasState.ts:117-145` | All canvas mutations funnel through `applyCommand`; debounce-free, sync, undo-friendly |
| Editor panel | `PropertiesPanel.tsx:67-94` | `useState` for draft, `onBlur` commits to `onUpdate` — already exists, just needs ActivityEditor to also handle roleIds |
| Selection ref | `useCanvasState.ts:100` | `useRef` as a synchronous shadow to bypass React batching for native event handlers |
| Sidebar style | `styles.css:95-` | Floating-toolbar style (rounded pill, subtle shadow) is the visual language for chrome |

## Files to Change
| File | Action | Why |
|---|---|---|
| `src/features/canvas/ProcessCanvas.tsx` | UPDATE | Wheel zoom factor 1.0015 → 1.25 |
| `src/features/canvas/useCanvasState.ts` | UPDATE | Add `autosave` effect, expose `saveStatus` |
| `src/features/canvas/PropertiesPanel.tsx` | UPDATE | ActivityEditor adds role-tag multi-select |
| `src/features/canvas/canvasTypes.ts` | UPDATE | New types: `SavedMap`, `SavedFolder`, `LibraryState` |
| `src/features/canvas/Library.tsx` | CREATE | Left-side panel: tree + new-map/folder buttons |
| `src/features/canvas/ProcessCanvas.tsx` | UPDATE | Mount `<Library />`, render `saveStatus` in status bar |
| `server/index.ts` | UPDATE | Add 4 routes: `GET/POST/PATCH/DELETE /api/library/*` |
| `server/library/libraryStore.ts` | CREATE | File-based JSON store at `data/library.json` (zod-validated) |
| `src/features/canvas/useLibrary.ts` | CREATE | Hook: fetch + mutate library state, debounced autosave |
| `src/features/canvas/library.ts` | CREATE | Pure helpers: buildTree, findById, isAncestor (no JSX) |
| `src/styles.css` | UPDATE | Library panel + tree styles + role-tag chip styles |
| `e2e/library.spec.ts` | CREATE | New map → appears in list; rename; delete; switch |
| `e2e/zoom-step.spec.ts` | CREATE | One wheel event lands within expected zoom range |
| `e2e/editor-role-tags.spec.ts` | CREATE | Open activity, add role, blur, persists in `data/library.json` |
| `src/features/canvas/library.test.ts` | CREATE | Unit tests for buildTree, findById, isAncestor, moveNode |
| `src/features/canvas/PropertiesPanel.test.tsx` | UPDATE | Activity editor commits roleIds array |

## Design Decisions
1. **Zoom step 1.25× per wheel notch** — the current 1.0015 factor was designed for trackpads
   (which emit many small wheel events). User wants `+` and `-` keystrokes and discrete
   mouse-wheel notches to feel responsive. Use 1.25 per notch; throttling caps at 6
   notches/sec to prevent runaway zoom when the user spins the wheel.

2. **Node editing reuses `PropertiesPanel`** — it already opens on double-click
   (`ProcessCanvas.tsx:488-489`) and already has `ActivityEditor` + `DecisionEditor`.
   Just add role-tag multi-select to ActivityEditor (the "对应负责角色" requirement).

3. **Persistence: server-side JSON file** at `data/library.json`. Schema:
   ```ts
   {
     folders: [{ id, name, parentId | null, order }],
     maps:    [{ id, name, folderId | null, order, document: GraphDocument, updatedAt }]
   }
   ```
   Autosave fires 500ms after the last edit (debounced). On load, the hook
   `useLibrary` fetches `/api/library`, then `useCanvasState` initializes from the
   active map.

4. **Library sidebar = full folder tree** — supports infinite nesting. Drag-and-drop
   reordering is **out of scope for this plan**; we use ↑/↓ buttons and a
   "move to folder" dropdown. That keeps the implementation in ~250 LOC.

5. **"Active map" lives in URL** — `?map=foo-bar` selects which map to load. First
   load with no param picks the most recently updated map. "New map" creates
   a new entry and switches to it.

## Tasks

### Task 1: Faster wheel zoom (1.25× per notch, throttled)
- **Action**: In `ProcessCanvas.tsx`, replace the single-event `ZOOM_FACTOR_PER_WHEEL = 1.0015`
  with a per-notch factor of 1.25. Detect notches via `event.deltaMode`: in `DOM_DELTA_PIXEL`
  mode (trackpad/macOS magic mouse), keep continuous; in `DOM_DELTA_LINE` mode
  (mouse wheel with detents), use the line count as discrete notches.
- **Mirror**: existing `zoomAt` in `useCanvasState.ts:469-487` already clamps 0.2 ≤ zoom ≤ 3
- **Validate**: `npx vitest run`; new e2e `zoom-step.spec.ts` simulates 1 wheel notch and
  asserts zoom is within 1.20 ≤ z ≤ 1.30

### Task 2: Activity role-tag editor
- **Action**: In `PropertiesPanel.tsx`, extend `ActivityEditor` with a multi-select
  input for role tags. New prop `roleIds: string[]`. New `<RoleTagInput>` subcomponent:
  chips for existing roles + a `<datalist>`-backed text input that adds a new tag on Enter.
  Tags persist on blur via the same `onUpdate` path.
- **Mirror**: `ActivityEditor` already commits `title`/`summary` on blur
- **Validate**: new `PropertiesPanel.test.tsx` test, plus e2e `editor-role-tags.spec.ts`

### Task 3: Library state + persistence API
- **Action**: New `server/library/libraryStore.ts` exports `load()`/`save(library)`. New
  zod schema `librarySchema` validates on read; on invalid, log + back up to
  `data/library.broken-{ts}.json` and start fresh. `server/index.ts` adds:
  - `GET  /api/library` → full state
  - `POST /api/library/maps` → create map
  - `PATCH /api/library/maps/:id` → rename, move, or update document
  - `DELETE /api/library/maps/:id` → delete map
  - Mirror endpoints for folders
- **Mirror**: existing route structure in `server/index.ts:18-42`
- **Validate**: shell test for each route (vitest, uses `node:http` directly)

### Task 4: Client-side library hook
- **Action**: New `useLibrary.ts` exports `useLibrary()` returning
  `{ library, activeMap, activeMapDocument, createMap, renameMap, deleteMap, moveMap,
   createFolder, renameFolder, deleteFolder, moveFolder, saveActiveMapDocument }`.
  Uses `fetch` with `?map=` query param. Returns `saveStatus: 'idle' | 'saving' | 'saved' | 'error'`.
- **Mirror**: `useCanvasState.ts` is the pattern for state + actions as one hook
- **Validate**: unit test for the helpers (`buildTree`, `findById`, `isAncestor`)

### Task 5: Wire library into ProcessCanvas
- **Action**: `ProcessCanvas.tsx` mounts `<Library />` on the left. `useCanvasState` is
  refactored: instead of `createInitialDocument()` returning a hard-coded start node,
  it accepts `{ initialDocument }` and `{ autosave: (doc) => void }`. The new
  `LibraryGate` wrapper (a new top-level component in `App.tsx`) loads the library,
  decides which map is active, and renders `<ProcessCanvas>` with the right props.
- **Mirror**: `App.tsx` already does `React.lazy(() => import('./features/canvas/ProcessCanvas'))`
- **Validate**: vitest + e2e `library.spec.ts`

### Task 6: Library tree component
- **Action**: New `Library.tsx` — collapsible tree with folder rows (▶/▼) and map
  rows. Each row has hover actions: rename (inline input), move (folder dropdown),
  delete (× button, confirms with `window.confirm`). "+ Map" and "+ Folder" buttons
  pinned at the bottom. CSS in `styles.css` mirrors the existing toolbar visual
  language (rounded, subtle shadow, `--surface` color).
- **Mirror**: existing `Toolbar` styling in `styles.css`
- **Validate**: e2e `library.spec.ts`

### Task 7: Autosave wiring + save-status indicator
- **Action**: `useCanvasState` adds a 500ms `setTimeout` debounce on history changes.
  When it fires, it calls `autosave(document)`. The status bar shows a small
  "Saving…" → "Saved" pulse using CSS animation. On error, shows "Save failed"
  with a retry click target.
- **Mirror**: existing status bar at `ProcessCanvas.tsx:661-673`
- **Validate**: e2e — edit a node, wait 600ms, then `fetch('/api/library')` and assert
  the new title is in the response

## Validation
```bash
npm run lint
npm test                         # 124 + new unit tests
npm run test:e2e                 # 13 + new e2e
npm run build
npm run dev                      # then manually verify: edit, refresh, edit, switch maps
```

## Risks
| Risk | Likelihood | Mitigation |
|---|---|---|
| 1.25× wheel zoom feels too fast on trackpads (which fire many events per gesture) | Medium | Detect `event.deltaMode`: line-mode (mouse wheel) uses 1.25, pixel-mode (trackpad) uses 1.0015 |
| Autosave writes corrupt JSON if the process is killed mid-write | Low | Use `writeFile` to `data/library.json.tmp` then `rename` (atomic on POSIX) |
| Drag-and-drop folder reordering not implemented | — | Out of scope; ↑/↓ + move-to-folder dropdown covers 80% of the use case |
| Library sidebar steals screen width from the canvas | Medium | Default to 240px; collapsible via a chevron in the panel header |
| First-load with empty library | — | `LibraryGate` creates a "Welcome" starter map on first run |

## Acceptance
- [ ] One mouse-wheel notch changes zoom by ~25% (clamped 0.2-3)
- [ ] Double-click any activity node → side panel edits title, summary, AND role tags
- [ ] Edit → wait 1s → refresh → edit is still there
- [ ] Left sidebar shows all saved maps, with folder tree, rename, and delete
- [ ] Create folder, drag map into it (via move-to dropdown), works
- [ ] All tests pass: 124 vitest + ≥5 e2e
- [ ] Lint clean
- [ ] Build succeeds; production preview shows new library without regression
