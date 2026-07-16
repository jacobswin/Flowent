# Flowent

> Process maps for aligned product teams.

Flowent 是一个面向产品与工程团队的流程开发系统。它用可视化流程图、职责、工作产品、交接、阶段和过程度量，帮助团队理解工作如何流动、由谁负责，以及流程应如何持续改进。

Flowent is a map-first process development system for product and engineering
teams. It combines reusable process elements, visual modeling, AI-assisted
generation, responsibility mapping, and process intelligence in one workspace.

Flowent is currently a private, local-first prototype. It is not a generic task
tracker and does not yet provide enterprise identity, permissions, or hosted
multi-tenant storage.

## Product Direction

Flowent supports the process lifecycle:

1. **Design** how work should move.
2. **Coordinate** responsibilities, handoffs, inputs, and outputs.
3. **Measure** waiting, rework, bottlenecks, and alignment gaps.
4. **Improve** the process through review and iteration.

## Current Capabilities

### Visual process canvas

- Model start, end, activity, decision, bottleneck, and stage elements.
- Connect endpoints directly or use the node `+` action to create the next
  element.
- Edit connection labels and colors, use keyboard or context-menu deletion, and
  render directional arrows on rounded orthogonal routes.
- Use focused object actions, alignment diagnostics, undo/redo, zoom from 5% to
  500%, and collapsible top controls.
- Keep node titles readable with centered truncation and full hover text.

### Flow and Swimlane views

- **Flow** arranges the process from left to right and shows the Responsible role
  above each activity. Input and output summaries remain visually distinct.
- **Swimlane** arranges work from top to bottom across Role, Input, Activity, and
  Output lanes. Role and work-product cards are derived views rather than extra
  persisted graph nodes.
- Stage containers span their member activities and decisions. New stage
  containers organize internal nodes but are not direct connection endpoints.

### Shared element library

The left library separates map management from reusable modeling elements:

- **Map**: a saved process view containing process instances and local modeling
  state.
- **Process**: a reusable composition of shared activities, decisions, internal
  handoffs, and stage containers.
- **Activity**: a reusable unit of work with expectations, RASIC, and input/output
  relationships.
- **Role**: a shared role or person reference used by RASIC and stage ownership.
- **Work Product**: a shared artifact linked to activities as an input or output.

Shared Process instances are projected into maps at runtime. Editing a shared
Process, Activity, Role, or Work Product updates every map that references it.
Deletion reports affected maps and relationships before cleanup.

### Responsibilities and process assets

- Activities use fixed RASIC responsibilities: Responsible, Accountable,
  Supporting, Consulted, and Informed.
- Responsible accepts one role; the remaining responsibility kinds accept
  multiple roles.
- Entering a new RASIC role can create it in the shared Role library; existing
  roles can be selected and reused.
- Work Products support relationship-level maturity, so an activity can consume
  `Draft` and produce `Approved` without treating the same maturity as both input
  and output.
- Guidance supports templates, checklists, practices, tools, training, links,
  and other references.
- Milestones can associate stage context with required Work Product maturity.
- What, Who, When, and How perspectives derive navigable views from the same
  model.

### AI-assisted process generation

- Users configure their own AI provider. Flowent does not require a platform
  provider or platform API key.
- Supported protocols are OpenAI-compatible APIs and Anthropic.
- Presets include Custom OpenAI-compatible, OpenAI, OpenRouter, DeepSeek, Kimi,
  Qwen/DashScope, SiliconFlow, Zhipu GLM, and Anthropic Claude.
- Provider settings can fetch visible models from the configured endpoint and
  test the connection before generation.
- Generate from pasted text or one uploaded `.txt`, `.md`, `.csv`, `.json`,
  `.docx`, `.pptx`, or text-based `.pdf` file.
- Preview a generated map before creating a new map or replacing the current
  map.
- AI generation currently prioritizes a compact activity mainline. It extracts
  explicit roles, RASIC relationships, Work Products, maturity, and measured
  process data when supported by the source.
- Start and End are normalized by Flowent, while malformed or rate-limited model
  responses can fall back to a smaller source-derived mainline.

### Process intelligence

Activities can be classified as value-add, wait, or rework and can store measured
P50/P90 duration. With optional WIP, Flowent derives cycle-time totals, value-add
ratio, waiting and rework share, throughput, data gaps, and ranked findings.

Available analysis profiles:

- Software
- Services
- Manufacturing
- Healthcare
- Engineering Development
- Automotive Development
- Electronics & Hardware Development
- Construction & Engineering Projects

Profile thresholds are Flowent defaults for analysis, not compliance standards.
AI only includes timing measurements when they are present in the source.

### Export

The current Flow or Swimlane view can be exported as:

- SVG
- single-page A4 landscape PDF
- 2x PNG
- 2x JPG
- versioned Flowent JSON backup with the map and referenced shared elements

Flowent JSON export is available; an import/restore UI is not yet implemented.

## AI Data and Privacy

Source text and extracted file content are sent only to the provider selected by
the user. Flowent does not proxy requests through a Flowent-owned model account.

- Provider API keys are submitted to the local API, encrypted with AES-GCM, and
  returned to the browser only as masked metadata.
- The local master key defaults to `data/flowent-ai-master.key` and must never be
  committed.
- Uploaded files are limited to 10 MB. Extracted text is limited to 80,000
  characters and is truncated with a warning when necessary.
- Scanned PDFs without selectable text and legacy `.doc`/`.ppt` files are not
  supported.
- The selected third-party provider's privacy and retention terms still apply.

## Run Locally

Requirements: a current Node.js LTS release and npm.

```bash
npm install
npm run setup:git-hooks
npm run dev
```

The development command starts:

- Vite web app: `http://localhost:5173`
- local API: `http://localhost:8787`

For LAN access, start Vite with an explicit host and run the API separately:

```bash
npm run dev:web -- --host 0.0.0.0
npm run dev:api
```

Useful commands:

```bash
npm run build
npm run lint
npm test
npm run test:coverage
npm run test:e2e
npm run check:readme
```

Run one Vitest file:

```bash
npx vitest run src/features/canvas/layout/swimlaneLayout.test.ts
```

## Configuration

The API supports these environment variables:

| Variable | Default | Purpose |
| --- | --- | --- |
| `FLOWENT_API_PORT` | `8787` | Local API port |
| `FLOWENT_LIBRARY_FILE` | `data/library.json` | Saved library path |
| `FLOWENT_AI_MASTER_KEY_FILE` | `data/flowent-ai-master.key` | Provider-key encryption key |

For a production-style deployment, serve the built `dist/` directory and proxy
`/api` to the Node API. The current repository does not yet install a persistent
service supervisor automatically.

## Architecture

Flowent is a TypeScript, React 19, Vite, and Pixi.js application with a small
Node API.

- `src/features/canvas/`: Pixi rendering, graph state, interactions, layouts,
  routing, assets, shared elements, diagnostics, process intelligence, and
  export.
- `src/features/ai/`: provider settings, model discovery, file/text generation,
  progress, and preview UI.
- `src/features/process-map/`: typed process workspace operations.
- `src/features/process-views/`: derived process views.
- `src/features/role-navigation/`: role-focused navigation derived from shared
  process data.
- `src/features/share/`: map comment and collaboration primitives.
- `server/ai/`: provider adapters, safe errors, file extraction, prompt rules,
  fallback generation, validation, and GraphDocument normalization.
- `server/library/`: local folders, maps, comments, AI settings, shared element
  library, migrations, and persistence.
- `e2e/`: Playwright coverage for canvas, assets, layouts, AI profiles, library,
  connections, and zoom.

The main persisted root is `SavedLibrary`, containing folders, maps, comments,
AI settings, and the shared element library. Each map stores a `GraphDocument`
with nodes, edges, viewport, layout metadata, Process instances, and map-scoped
assets. Role and perspective views are derived rather than duplicated.

`data/library.json` is runtime workspace data. Do not include personal maps,
encrypted provider records, recovery files, or master keys in commits.

## Quality Status

The repository contains unit, component, API, serialization/migration, and
Playwright E2E tests. High-risk areas with focused coverage include:

- graph history, serialization, routing, and layout
- shared element projection and deletion cleanup
- RASIC and Work Product maturity rules
- AI provider storage, model listing, file extraction, prompt construction, and
  draft normalization
- Flow/Swimlane rendering and multi-format export
- process intelligence metrics and profile persistence
- library save, refresh, and compatibility migration

Known limitations are tracked below rather than hidden in completed capability
lists.

## Current Plan

1. Make local and reverse-proxy deployment reliable across restarts.
2. Complete backup restoration and safer shared-element lifecycle management.
3. Improve AI mainline quality, role/Work Product extraction, and transparent
   fallback diagnostics across user-owned providers.
4. Expand process intelligence from fixed profiles toward configurable team
   baselines and clearer measurement guidance.

## TODO

- [ ] Add a persistent service definition and documented health/restart workflow.
- [ ] Add Flowent JSON import, validation, conflict handling, and restore preview.
- [ ] Allow workspace-specific Process Intelligence thresholds.
- [ ] Add OCR for scanned PDFs and an explicit conversion path for legacy Office
  files.
- [ ] Add authenticated multi-user access, permissions, and a production-grade
  secrets strategy before hosted use.
- [ ] Add Process versioning, change history, and controlled map upgrades.
- [ ] Continue stabilizing the full Pixi/JSDOM test run and broaden visual export
  regression coverage.

## Before Pushing

Review this README before every functional push. At minimum:

- Move newly completed work into Current capabilities.
- Update Current Plan, TODO, Quality status, and Known limitations when their
  state changes.
- Run the relevant unit tests, `npm run lint`, and `npm run build`; run E2E tests
  when the change affects user workflows.
- Confirm `data/library.json`, `data/*.key`, recovery files, generated output,
  and credentials are not staged.
- Keep Flowent product language current and remove obsolete references.

Enable the repository-managed guard once per clone:

```bash
npm run setup:git-hooks
```

The pre-push guard examines outgoing commits. If functional application, server,
test, build, workflow, or public-asset files changed without a `README.md` change
in the same push range, it stops the push and asks for a README review.

Use `npm run check:readme` to apply the same policy to the current branch against
its configured upstream.

## Tech Stack

- TypeScript
- React 19
- Vite 8
- Pixi.js 8
- Zod
- Vitest
- Playwright
- lucide-react
- jsPDF and svg2pdf.js

## License

Private prototype.
