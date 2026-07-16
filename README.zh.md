# Flowent

> 为对齐的产品团队而生的过程地图。

Flowent 是一套以过程地图为中心的产品团队过程开发系统。它帮助团队
建模工作如何流转、每一步由谁负责、决策在哪里发生，以及哪些交付物、
指南、里程碑和交接关系支撑团队对齐。

当前产品方向是一个轻量的可视化过程建模画布，优先服务团队级过程设
计，而不是完整企业治理后台。

## Flowent 支持什么

- **可视化过程地图**：在 Pixi 画布上创建阶段、活动、决策、交接、
  瓶颈、开始和结束节点。
- **快速连接流程**：从节点端点连线，通过节点 `+` 快速创建下一个
  节点，编辑连线标签与颜色，删除节点或连线，并渲染会跟随线段角度
  变化的方向箭头。
- **过程资产**：
  - **Who**：Activity 支持 RASIC 职责。
  - **What**：Work Product 可作为输入、输出或交接产物。
  - **When**：Milestone 可关联阶段与工作产品成熟度。
  - **How**：Guidance 支持模板、检查单、实践、工具、培训与链接。
- **工作产品成熟度建模**：同一个 Work Product 可以同时作为某个
  Activity 的输入和输出，但成熟度必须不同，例如 `Draft -> Approved`。
- **Process assets 面板**：在顶部可折叠 dock 中管理工作产品、指南、
  里程碑，以及 What / Who / When / How 派生视角。
- **对齐诊断**：提示缺少职责、工作产品缺 producer/consumer、未关联
  guidance、里程碑缺 stage/state 等建模问题。
- **Library 持久化**：地图与过程资产继续通过现有 `/api/library`
  文档存储保存。

## 产品原则

Flowent 不是通用任务跟踪工具。它聚焦过程地图、对齐、职责、交接、
期望、瓶颈与持续改进。

Flowent 希望覆盖过程工作的完整生命周期：

1. **设计** 过程地图。
2. **协同** 按地图推进执行。
3. **度量** 瓶颈与失配。
4. **改进** 通过迭代与学习持续优化。

## 本地运行

```bash
npm install
npm run dev
```

默认开发命令会同时启动 Vite 前端和 API 服务。

常用命令：

```bash
npm run dev:web       # 仅启动 Vite
npm run dev:api       # 使用 tsx watch 启动 API
npm run build         # TypeScript 构建 + 生产 bundle
npm run preview       # 生产预览 + API 服务
npm run lint          # ESLint
npm test              # Vitest 单元测试
npm run test:coverage
npm run test:e2e      # Playwright E2E
```

运行单个 Vitest 文件：

```bash
npx vitest run src/features/canvas/render/drawEdges.test.ts
```

## 架构

Flowent 是 TypeScript + React 19 + Vite 应用，并配套一个小型 Node API。
源码按 feature 组织在 `src/features/` 下。

- `canvas/`：主要可视化建模界面，包含 Pixi 渲染、节点与连线交互、
  顶部 dock 面板、过程资产、对齐诊断、聚焦视图、library 集成与
  SVG 导出。
- `process-map/`：类型化过程地图模型与工作区操作。
- `process-views/`：从共享地图派生多角色过程视图。
- `role-navigation/`：角色优先的过程导航。
- `scenario-generation/`：服务端草稿地图生成。
- `share/`：评论与协作相关帮助方法。
- `server/library/`：`/api/library` 持久化，保存地图、文件夹、评论和
  `GraphDocument.processAssets`。

角色视图和过程视角都从同一份地图数据派生，不作为重复文档维护。

## 数据模型说明

`GraphDocument` 保存节点、连线、选中状态、viewport、元数据和
`processAssets`。

`processAssets` 当前包含：

- `workProducts`
- `guidanceItems`
- `milestones`

Work Product 保留 legacy 的 `producerNodeIds` 与 `consumerNodeIds`
字段用于兼容，同时通过更完整的 `activityLinks` 保存输入/输出关系
级别的成熟度。

`data/library.json` 是本地开发 API 使用的持久化文件。除非是有意提供
样例数据，否则不要提交个人试用地图。

## 测试

当前测试覆盖：

- graph 序列化与迁移
- work product、guidance、milestone 资产 reducer
- RASIC 职责编辑
- 工作产品成熟度冲突规则
- 过程视角与诊断
- 画布交互与连接流程
- 顶部 dock 控制区与箭头渲染
- library 保存与刷新后的数据保留

## 技术栈

- TypeScript
- React 19
- Vite
- Pixi.js 8
- Zod
- Vitest
- Playwright
- lucide-react

## 命名与文案

项目文件、文档与界面文案中统一使用 **Flowent**。优先使用围绕过程地
图、对齐、交接、职责、期望、瓶颈、生命周期与持续改进的产品语言。

## 许可证

私有原型。
