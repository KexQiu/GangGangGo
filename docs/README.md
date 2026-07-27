# 小提督文档索引

当前文档按版本归档。

当前仓库已经整理为轻量 monorepo：

```text
apps/mobile          # v0.2 Expo / iOS / Watch App
apps/api             # v0.2 Hono + Postgres API
packages/contracts   # 跨端 Zod schema 与 TypeScript 类型
```

工程结构详见：[项目结构说明](./project-structure.md)。

整体开发步骤详见：[开发路线图](./development-roadmap.md)。

当前架构重构的实际剩余工作以 [Architecture v2 后续待办](./architecture/architecture-v2-follow-up-todo.md) 为准。

所有需要真实 iPhone、Apple Watch、系统能力或发布签名验证的事项统一记录在[真机验收总清单](./architecture/physical-device-acceptance-checklist.md)。

## v0.1 当前完成版

- [产品定位](./v0.1/product-positioning.md)
- [PRD](./v0.1/prd-v0.1.md)
- [开发方案](./v0.1/development-plan.md)
- [UI 交互设计](./v0.1/ui-interaction-design.md)
- [整体风格设计指南](./v0.1/visual-style-guide.md)

v0.1 是当前 App 已实现和验收的单人本地健康习惯闭环，包括菊花抬、蹲会儿、小账本、小暗号、最近小报告、小花说明书和灵动岛计时基础能力。

## v0.2 规划版

- [好友关系重构（当前社交模型）](./v0.2/friends-refactor.md)
- [需求文档](./v0.2/prd.md)
- [Apple Watch 需求文档](./v0.2/apple-watch-prd.md)
- [Apple Watch 开发计划](./v0.2/apple-watch-development-plan.md)
- [Apple Watch 手动测试清单](./v0.2/apple-watch-manual-test-checklist.md)
- [开发方案](./v0.2/development-plan.md)
- [后端详细开发方案](./v0.2/backend-development-plan.md)
- [后端接口文档](./v0.2/api-reference.md)
- [移动端后端接入计划](./v0.2/mobile-integration-plan.md)
- [移动端后端联调手动测试清单](./v0.2/mobile-backend-manual-test-checklist.md)
- [产品总待办清单（历史规划）](./v0.2/todo-checklist.md)
- [Apifox/OpenAPI 导入文件](./v0.2/openapi.json)

v0.2 当前进入增长免费阶段：用户侧隐藏 Pro 页面、购买入口和付费锁，现有高级小报告与 Apple Watch 操作对符合账号边界的用户开放。订阅表、交易接口和 `proStatus` 仍保留为内部商业化骨架，服务端通过 `COMMERCIAL_MODE=growth_free|paid` 切换开放策略。

当前数据页采用“今日总览 → 90 天日历 → 7/30/90 天分类折线”的单页结构。日历可点选日期查看训练次数、小账本细节和蹲会儿完整记录；90 天日历与 90 天折线在增长阶段直接开放，完整账号同步仍要求登录。旧 `/trends/advanced` 地址会返回新的数据页。

个人完整记录通过 `/data-sync/push` 和 `/data-sync/pull` 增量同步，使用 SQLite outbox、服务端幂等 mutation 和单调游标。健康事实与每日汇总保留 90 天，自定义小信号常用项持续保留；好友数据由服务端按关系权限从每日汇总中裁剪，不再上传独立共享快照。

Apple Watch 联动使用账号能力字段控制操作：增长阶段登录用户可使用菊花抬、小账本和蹲会儿操作，未登录状态保持只读提示。Watch App、WatchConnectivity、离线队列、Complication 共享低敏状态和 `/watch` 开发调试页均已接入。2026-06-16 已完成真机初步测试；仍需补齐表盘 Complication、haptic 手感、系统刷新节奏和完整手动清单留痕。

增长事件采用第一方白名单协议，匿名安装标识和待发送事件存入 SQLite outbox；登录后同一安装最近 90 天的匿名事件可关联账号。服务端不接收健康明细，只保存事件名和少量枚举属性，并按 90 天窗口清理。
