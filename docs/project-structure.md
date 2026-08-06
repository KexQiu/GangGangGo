# 小提督项目结构说明

日期：2026-08-06
阶段：v0.2 模块化 monorepo

## 1. 总体结构

仓库使用 pnpm workspace，移动端、API 与共享运行时契约在同一仓库内统一构建和校验。

```text
.
├── .github/workflows/ci.yml
├── .nvmrc
├── apps/
│   ├── api/
│   └── mobile/
├── docs/
├── packages/
│   └── contracts/
├── scripts/
├── package.json
├── pnpm-lock.yaml
└── pnpm-workspace.yaml
```

| 路径 | 包名 | 职责 |
| --- | --- | --- |
| `apps/mobile` | `@xiaotidu/mobile` | Expo + React Native、iOS Live Activity、Apple Watch |
| `apps/api` | `@xiaotidu/api` | Hono + Drizzle + PostgreSQL API |
| `packages/contracts` | `@xiaotidu/contracts` | 前后端共享 Zod schema 与 TypeScript 类型 |

根目录固定 pnpm 10.32 和 Node 22 类型基线；本地可使用 Node 22-24，CI 使用 Node 22。

## 2. 根脚本与门禁

常用命令：

```bash
pnpm api:dev
pnpm build
pnpm api:start
pnpm mobile:ios
pnpm mobile:android
pnpm check
```

`pnpm build` 先生成 contracts 的 ESM 产物，再把 API 编译到 `apps/api/dist`；`pnpm api:start` 只运行编译后的 JavaScript，不依赖运行时 `tsx`。

`pnpm check` 包含版本一致性、生产构建、全仓类型检查、ESLint、Prettier、测试、OpenAPI 漂移检查，以及 iOS/Android Expo bundle 门禁。Apple 原生 scheme 继续由 macOS CI 构建。

## 3. 移动端

### 3.1 路由

```text
apps/mobile/app/
├── _layout.tsx
├── +native-intent.ts
├── (tabs)/
│   ├── _layout.tsx
│   ├── index.tsx
│   ├── trends.tsx
│   ├── friends.tsx
│   └── me.tsx
├── friend/join/[token]/index.tsx
├── friends/
│   ├── invite/index.tsx
│   └── [userId]/
│       ├── index.tsx
│       └── events.tsx
├── habits/index.tsx
├── me/profile/index.tsx
├── pro/index.tsx
├── reminders/index.tsx
├── safety/index.tsx
├── settings/index.tsx
├── toilet/
│   ├── index.tsx
│   ├── complete.tsx
│   └── records/[id].tsx
├── training/
│   ├── index.tsx
│   ├── session.tsx
│   └── complete.tsx
├── trends/advanced.tsx
└── watch/index.tsx
```

路由文件只负责导航参数与 feature screen 挂载。底部一级页面为首页、数据、好友和我的。

### 3.2 业务源码

```text
apps/mobile/src/
├── api/
│   ├── client/
│   │   ├── auth.ts
│   │   ├── dataSync.ts
│   │   ├── friends.ts
│   │   ├── growth.ts
│   │   ├── health.ts
│   │   ├── push.ts
│   │   ├── reports.ts
│   │   ├── subscriptions.ts
│   │   └── users.ts
│   └── transport.ts
├── components/
├── features/
│   ├── account/
│   ├── data/
│   ├── friends/
│   ├── growth/
│   ├── habits/
│   ├── reminders/
│   ├── reports/
│   ├── settings/
│   ├── sync/
│   ├── today/
│   ├── toilet/
│   ├── training/
│   ├── trends/
│   └── watch/
├── navigation/
├── storage/
└── theme/
```

云端状态由 TanStack Query 持有；Zustand 只保存登录会话、本地健康领域状态和短期 UI 状态。SQLite repository 负责本地优先数据与 profile 隔离。

`features/toilet/ToiletRecordForm.tsx` 只保留表单编排；滚轮和选择字段位于 `components/ToiletRecordFormFields.tsx`，常量与样式分别位于 `toiletRecordForm.constants.ts` 和 `styles/toiletRecordFormStyles.ts`。

### 3.3 构建环境

development 可使用 Mac 局域网 API；preview/production 必须提供 HTTPS `EXPO_PUBLIC_API_BASE_URL`，且不能指向 localhost。EAS profile 显式设置 `EXPO_PUBLIC_RUNTIME_ENV`。

```bash
cp apps/mobile/.env.example apps/mobile/.env.local
pnpm --filter @xiaotidu/mobile bundle:check
pnpm --filter @xiaotidu/mobile bundle:check:android
```

## 4. API

### 4.1 入口与装配

```text
apps/api/
├── drizzle/
├── scripts/
├── src/
│   ├── server.ts
│   ├── app.ts
│   ├── app/
│   │   ├── createApiApp.ts
│   │   ├── errorHandler.ts
│   │   ├── registerRoutes.ts
│   │   ├── requestLogger.ts
│   │   └── types.ts
│   ├── cli/
│   │   └── purgeExpiredData.ts
│   ├── config/
│   ├── db/
│   ├── dependencies/
│   ├── http/
│   ├── lib/
│   ├── modules/
│   └── __tests__/
├── tsconfig.json
└── tsconfig.build.json
```

调用链保持 `server.ts -> app.ts/createApiApp -> registerRoutes`。依赖装配在 `dependencies/createDependencies.ts` 中选择 Mock 或 Drizzle 实现。

全局 HTTP 层包含 request id、结构化请求日志、安全响应头、请求体大小限制、通用固定窗口限流、认证和统一错误响应。当前限流状态是单进程内存级；多实例部署仍需在网关或共享存储层提供全局限流。

### 4.2 数据库结构

```text
apps/api/src/db/schema/
├── audit.ts
├── auth.ts
├── common.ts
├── dataSync.ts
├── enums.ts
├── friends.ts
├── growth.ts
├── push.ts
├── reports.ts
├── subscriptions.ts
├── users.ts
└── index.ts
```

`src/db/schema.ts` 保持为兼容出口，实际表定义位于 `src/db/schema/`。

### 4.3 业务模块

```text
apps/api/src/modules/
├── auth/
├── dataSync/
├── entitlements/
├── friends/
├── growth/
├── health/
├── push/
├── reports/
├── storage/
├── subscriptions/
└── users/
```

好友域按职责拆分：

- `friendService.ts`：Drizzle 用例与事务编排。
- `friend.policy.ts`：邀请、勿扰、限额、游标和数据投影规则。
- `friend.mapper.ts`：数据库行到 contracts DTO 的转换。
- `friend.mock.ts`：内存测试实现。
- `friend.types.ts`：稳定服务合同。

账号数据生命周期由 `users/accountDataService.ts` 负责；统一定时清理由 `storage/retentionService.ts` 负责，不在增长事件上传请求内执行历史删除。

### 4.4 当前主要接口

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/health`、`/health/db` | 服务与数据库健康检查 |
| `POST` | `/auth/apple`、`/auth/refresh`、`/auth/logout` | 登录与会话 |
| `GET/PATCH/DELETE` | `/me` | 资料读取、更新、永久删除账号 |
| `GET` | `/me/export` | 导出当前账号数据 |
| `GET` | `/me/entitlements` | 商业模式与功能能力 |
| `POST` | `/data-sync/push`、`/data-sync/pull` | 本地健康数据同步 |
| `POST` | `/growth-events`、`/me/growth-events` | 增长事件上传 |
| 多种 | `/friend-invites/*`、`/friends/*`、`/friend-events/*` | 好友邀请、权限、数据、提醒与回执 |
| `POST/DELETE` | `/push-tokens` | Push token 管理 |
| 多种 | `/reports/*`、`/report-snapshots/*` | 报告与快照 |
| 多种 | `/subscriptions/*` | 订阅入口 |

准确接口以生成的 `docs/v0.2/openapi.json` 和 `api-reference.md` 为准。

### 4.5 数据库验证

真实 PostgreSQL 集成测试覆盖认证、用户/权益、报告、好友/同步、账号删除与保留策略。未配置 `DATABASE_URL` 时这些测试显式跳过；CI 会启动 PostgreSQL 17、应用迁移后运行完整测试。

## 5. 共享契约

```text
packages/contracts/src/
├── auth.ts
├── common.ts
├── dataSync.ts
├── friends.ts
├── growth.ts
├── push.ts
├── reports.ts
├── subscriptions.ts
├── users.ts
└── index.ts
```

Zod schema 同时用于 API 输入输出校验、移动端响应解析和 OpenAPI 生成。API 生产构建使用 contracts 的 `dist` ESM；React Native 使用源码入口。

## 6. 数据保留与账号操作

个人健康事实、同步变更和每日汇总按 90 天窗口清理；增长事件按接收时间保留 90 天。过期认证会话、好友邀请、临时好友事件和旧每日计数由独立清理任务处理。

开发环境：

```bash
pnpm --filter @xiaotidu/api data:purge-expired
```

生产构建：

```bash
pnpm build
pnpm --filter @xiaotidu/api data:purge-expired:prod
```

账号导出不包含 refresh token 摘要和 Push token 原文。永久删除会删除用户及级联关联记录，并显式删除原本会匿名化保留的增长、审计和订阅事件关联数据；本机 SQLite 数据不会由云端删除接口自动清除。

## 7. 修改原则

- 先更新 `packages/contracts`，再同步 API route/service 与移动端 client。
- OpenAPI 生成物不手工编辑。
- 不把数据库实体直接暴露给移动端。
- 结构调整必须保持 API path、响应 envelope、表名和迁移历史兼容。
- 修改后至少执行 `pnpm check` 与 `git diff --check`。
