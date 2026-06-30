# Flowent

> Process maps for aligned product teams.

Flowent is a map-first process development system for product teams. It helps
teams model how work moves, who owns each step, where decisions happen, and
which artifacts, guidance, milestones, and handoffs keep delivery aligned.

The current product direction is a lightweight visual process modeling canvas
for team-level process design instead of enterprise governance.

## What Flowent Supports

- **Visual process maps**: create stages, activities, decisions, handoffs,
  bottlenecks, start, and end nodes on a Pixi-powered canvas.
- **Fast connection flow**: connect from node endpoints, quick-create the next
  node from a node `+`, edit connection labels and colors, delete nodes or
  edges, and render directional arrowheads that follow the line angle.
- **Process assets**:
  - **Who**: Activity responsibilities with RASIC roles.
  - **What**: Work products linked as inputs, outputs, or handoff artifacts.
  - **When**: Milestones tied to stages and work product maturity.
  - **How**: Guidance items such as templates, checklists, practices, tools,
    training, and links.
- **Work product maturity modeling**: the same work product can be both an
  input and output of an activity when the maturity differs, for example
  `Draft -> Approved`.
- **Process assets panel**: manage work products, guidance, milestones, and
  What / Who / When / How perspectives from a collapsible top dock.
- **Alignment diagnostics**: surface missing responsibilities, incomplete work
  product links, unused guidance, milestone gaps, and related modeling issues.
- **Library persistence**: maps and process assets are saved through the
  existing `/api/library` document store.

## Product Principles

Flowent is not a generic task tracker. It is designed for process maps,
alignment, responsibilities, handoffs, expectations, bottlenecks, and continuous
improvement.

The lifecycle Flowent aims to support:

1. **Design** process maps.
2. **Coordinate** execution through those maps.
3. **Measure** bottlenecks and misalignment.
4. **Improve** the process through iteration and learning.

## Run Locally

```bash
npm install
npm run dev
```

The default dev command starts both the Vite app and the API server.

Useful commands:

```bash
npm run dev:web       # Vite only
npm run dev:api       # API server with tsx watch
npm run build         # TypeScript build + production bundle
npm run preview       # production preview + API server
npm run lint          # ESLint
npm test              # Vitest unit tests
npm run test:coverage
npm run test:e2e      # Playwright E2E tests
```

Run a single Vitest file:

```bash
npx vitest run src/features/canvas/render/drawEdges.test.ts
```

## Architecture

Flowent is a TypeScript + React 19 + Vite application with a small Node API.
Source code is organized by feature under `src/features/`.

- `canvas/`: the primary visual modeling surface, including Pixi rendering,
  node and edge interactions, top dock panels, process assets, diagnostics,
  focus views, library integration, and SVG export.
- `process-map/`: typed process map model and workspace operations.
- `process-views/`: derived multi-role process views.
- `role-navigation/`: role-first process navigation.
- `scenario-generation/`: server-backed draft map generation.
- `share/`: shared comments and collaboration helpers.
- `server/library/`: `/api/library` persistence for maps, folders, comments,
  and `GraphDocument.processAssets`.

Role views and process perspectives are derived from shared map data rather
than duplicated as separate documents.

## Data Model Notes

`GraphDocument` stores nodes, edges, selected state, viewport, metadata, and
`processAssets`.

`processAssets` currently contains:

- `workProducts`
- `guidanceItems`
- `milestones`

Work products retain legacy `producerNodeIds` and `consumerNodeIds` fields for
compatibility, while the richer `activityLinks` model stores relation-level
maturity for input/output links.

`data/library.json` is the local development persistence file used by the API.
Avoid committing personal sandbox maps unless they are intended sample data.

## Testing

The current suite includes unit, component, and E2E coverage for:

- graph serialization and migration
- work product, guidance, and milestone asset reducers
- RASIC responsibility editing
- work product maturity conflict rules
- process perspectives and diagnostics
- canvas interaction and connection flows
- top dock controls and arrow rendering
- library persistence and refresh behavior

## Tech Stack

- TypeScript
- React 19
- Vite
- Pixi.js 8
- Zod
- Vitest
- Playwright
- lucide-react

## Naming and Copy

Use **Flowent** consistently in code, documentation, and UI copy. Prefer product
language around process maps, alignment, handoffs, responsibilities,
expectations, bottlenecks, lifecycle, and continuous improvement.

## License

Private prototype.
