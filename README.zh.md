# Flowent

> 为对齐的产品团队而生的工作流图谱。

Flowent 是一套面向产品团队的过程开发系统，帮助团队创建**活的工
作流图谱**，清晰呈现产品发现与软件交付过程中的阶段、交接、职责、
决策与期望。当前活跃分支 `feat/canvas-builder-foundation` 上开发
的可视化画布是该系统的核心界面，用于设计并打磨这些图谱。

## Flowent 的定位

Flowent 以**图谱为先、协作为核心**，而非通用的任务跟踪工具。它
的差异化价值在于帮助跨职能产品团队理解：

- 工作是如何流转的；
- 每个环节的负责人是谁；
- 决策在哪里发生；
- 过程如何随时间演进。

产品覆盖过程工作的完整生命周期：

1. **设计** 工作流图谱。
2. **协同** 按图谱推进执行。
3. **度量** 瓶颈与失配。
4. **改进** 通过迭代与学习不断优化。

## 命令

```bash
npm install
npm run dev         # 启动 Web 与 API（带热更新）
npm run dev:web     # 仅 Vite
npm run dev:api     # tsx watch 模式运行 server/index.ts
npm run build       # tsc -b && vite build
npm run preview     # 生产构建 + 静态 API
npm run lint        # ESLint
npm test            # Vitest 单元测试
npm run test:coverage
npm run test:e2e    # Playwright
```

运行单个 Vitest 文件：

```bash
npx vitest run src/features/role-navigation/RoleNavigation.test.tsx
```

## 架构

Flowent 是基于 TypeScript + React 19 + Vite 的单页应用，配套一个小
型 Node/Express 风格 API 服务。源码按特性（feature）组织在
`src/features/` 下：

- `process-map/` — 类型化的工作流图谱模型与样例数据。
- `role-navigation/` — 派生出基于角色的流程视图，并渲染角色优先
  的导航界面。
- `process-views/` — 同一张共享图谱的多角色视图。
- `scenario-generation/` — 由 Claude 辅助的草稿图谱生成。浏览器
  发起 `/api/scenario-drafts` 请求；服务端持有 `ANTHROPIC_API_KEY`，
  绝不暴露到客户端。
- `canvas/` — 可视化画布构建器。流程元素（阶段、活动、决策、瓶颈、
  起点/终点）可一键创建或拖拽放置，通过端口连接交接边，可原地编
  辑标签，并查看对齐诊断。包含聚焦模式（决策 / 交接 / 瓶颈）、激
  活快照、对齐清单、激活栏与 SVG 导出。
- `role-navigation/`（共享）— 见上。

角色视图统一派生自同一张共享图谱，不以独立数据形式重复维护。

Node API 位于 `server/`，每个特性一条路由：`/api/library` 提供进
程内的图谱存储，`/api/scenario-drafts` 提供 Claude 辅助生成。状态
持久化到 `data/library.json`。

## 技术栈

- TypeScript、React 19、Vite
- Pixi.js 8 — 画布渲染器
- Vitest + Playwright — 单元测试与 E2E
- `@anthropic-ai/sdk` + Zod 结构化输出（用于场景生成）
- `lucide-react` — 图标库

## 项目状态

MVP 已完成 7 个里程碑：元模型 v0、角色优先导航、多角色视图、场
景到图谱生成、临时协同工作区、全员一致激活、验证原型。

当前方向（`feat/canvas-builder-foundation` 分支）在类型化的
`ProcessMap` 模型之上增加可视化构建能力，涵盖流程元素模板、Pixi
舞台生命周期、交接边路由、聚焦模式、激活栏与 SVG 导出等。

## 命名与文案

项目文件、文档与界面文案中统一使用 **Flowent**。优先采用围绕工作
流图谱、对齐、交接、职责、期望、瓶颈、生命周期与持续改进的产品语
言。

## 许可证

私有原型。
