# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Flowent is a process development system for product teams. It helps teams create living process maps that clarify stages, handoffs, responsibilities, decisions, and expectations across product discovery and software delivery.

Flowent should be map-first and alignment-focused rather than a generic task tracker. Its core differentiator is helping cross-functional product teams understand how work moves, who owns each part, where decisions happen, and how the process changes over time.

Tagline direction: "Process maps for aligned product teams."

## Product Scope

Flowent should support the full lifecycle of process work:

1. Design process maps.
2. Coordinate execution through those maps.
3. Measure bottlenecks and misalignment.
4. Improve the process through iteration and learning.

## Commands

```bash
npm install
npm run dev
npm run build
npm run lint
npm test
npm run test:coverage
npm run test:e2e
```

Run a single Vitest file:

```bash
npx vitest run src/features/role-navigation/RoleNavigation.test.tsx
```

## Architecture

Flowent is currently a TypeScript + React + Vite single-page prototype. Source code is organized by feature under `src/features/`:

- `process-map/` contains the typed process-map model and sample process data.
- `role-navigation/` derives role-specific process views and renders the role-first navigation surface.

Role views should be derived from a shared process map rather than duplicated as separate view data.

## Naming and Copy

Use **Flowent** consistently in project files, documentation, and UI copy. Prefer product language around process maps, alignment, handoffs, responsibilities, expectations, bottlenecks, lifecycle, and continuous improvement.
