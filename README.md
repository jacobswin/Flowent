# Flowent

> Process maps for aligned product teams.

Flowent is a process development system for product teams. It helps teams
create **living process maps** that clarify stages, handoffs,
responsibilities, decisions, and expectations across product discovery and
software delivery. The canvas builder (in active development on the
`feat/canvas-builder-foundation` branch) is the primary surface for
designing and refining those maps.

## What Flowent does

Flowent is map-first and alignment-focused rather than a generic task
tracker. Its differentiator is helping cross-functional product teams
understand:

- how work moves,
- who owns each part,
- where decisions happen, and
- how the process changes over time.

The product covers the full lifecycle of process work:

1. **Design** process maps.
2. **Coordinate** execution through those maps.
3. **Measure** bottlenecks and misalignment.
4. **Improve** the process through iteration and learning.

## Commands

```bash
npm install
npm run dev         # web + API with hot reload
npm run dev:web     # Vite only
npm run dev:api     # tsx watch on server/index.ts
npm run build       # tsc -b && vite build
npm run preview     # production build + non-watching API
npm run lint        # ESLint
npm test            # Vitest unit tests
npm run test:coverage
npm run test:e2e    # Playwright
```

Run a single Vitest file:

```bash
npx vitest run src/features/role-navigation/RoleNavigation.test.tsx
```

## Architecture

Flowent is a TypeScript + React 19 + Vite single-page app with a small
Node/Express-style API server. Source code is organized by feature under
`src/features/`:

- `process-map/` — the typed process-map model and sample data.
- `role-navigation/` — derives role-specific process views and renders
  the role-first navigation surface.
- `process-views/` — multi-role views of the same shared map.
- `scenario-generation/` — Claude-assisted draft map generation.
  Browser posts to `/api/scenario-drafts`; the server holds the
  `ANTHROPIC_API_KEY` and never exposes it to the client.
- `canvas/` — the visual canvas builder. Process elements (stages,
  activities, decisions, bottlenecks, start/end) snap into a
  process map; users drag-to-place or quick-create from the palette,
  wire handoff edges by port, edit labels inline, and inspect
  alignment diagnostics. Includes focus modes (Decisions /
  Handoffs / Bottlenecks), an activation snapshot, an
  alignment checklist, an activation bar, and SVG export.
- `role-navigation/` (shared) — see above.

Role views are derived from a shared process map rather than
duplicated as separate view data.

The Node API lives in `server/` with one route per feature:
`/api/library` for the in-process map store, `/api/scenario-drafts`
for Claude-assisted generation. State is persisted to `data/library.json`.

## Tech stack

- TypeScript, React 19, Vite
- Pixi.js 8 for the canvas renderer
- Vitest + Playwright for unit + E2E
- `@anthropic-ai/sdk` with structured outputs (Zod) for scenario
  generation
- `lucide-react` for icons

## Project status

The MVP shipped 7 milestones: metamodel v0, role-first navigation,
multi-role views, scenario-to-map generation, temporary collaborative
workspace, all-party consensus activation, and a validation prototype.

The current direction — the `feat/canvas-builder-foundation` branch —
adds a visual builder on top of the typed `ProcessMap` model. See the
canvas feature for process-element templates, the Pixi stage
lifecycle, edge handoff routing, focus modes, activation bar, and
SVG export.

## Naming and copy

Use **Flowent** consistently in project files, documentation, and UI
copy. Prefer product language around process maps, alignment,
handoffs, responsibilities, expectations, bottlenecks, lifecycle, and
continuous improvement.

## License

Private prototype.
