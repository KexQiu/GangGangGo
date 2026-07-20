# 小提督项目结构说明

日期：2026-07-13
阶段：Architecture v2 / P1 优化后的 monorepo 工程结构

## 1. 总体结构

当前仓库采用 pnpm monorepo。移动端、后端和共享运行时契约位于同一仓库，统一执行类型、lint、格式、测试、OpenAPI 漂移和 Apple 原生构建门禁。

```text
.
├── apps/
│   ├── mobile/              # Expo App、iOS / Watch target 与本地 Expo Modules
│   └── api/                 # Hono + Postgres + Drizzle 模块化 API
├── packages/
│   └── contracts/           # 前后端共享 Zod schema 与推导类型
├── docs/
│   ├── architecture/        # ADR 与结构优化待办
│   ├── v0.1/                # v0.1 归档文档
│   └── v0.2/                # v0.2 需求、实现和验收文档
├── package.json             # monorepo 根脚本
├── pnpm-workspace.yaml      # pnpm workspace 配置
└── pnpm-lock.yaml
```

工作区包名：

| 路径 | 包名 | 说明 |
| --- | --- | --- |
| `apps/mobile` | `@xiaotidu/mobile` | Expo + React Native 移动端 App |
| `apps/api` | `@xiaotidu/api` | Hono + Drizzle 模块化 API |
| `packages/contracts` | `@xiaotidu/contracts` | Zod 运行时契约与推导类型 |

## 2. 根目录职责

根目录只放 monorepo 级别配置，不再放移动端源码。

关键文件：

| 文件 | 说明 |
| --- | --- |
| `package.json` | 根脚本，统一调度移动端、后端和类型检查 |
| `pnpm-workspace.yaml` | 声明 `apps/*` 和 `packages/*` 工作区 |
| `pnpm-lock.yaml` | 全仓库统一依赖锁定 |
| `.gitignore` | 统一忽略依赖、构建产物和本地环境文件 |

常用根脚本：

```bash
pnpm mobile:start
pnpm mobile:ios
pnpm mobile:android
pnpm mobile:dev-client
pnpm api:dev
pnpm api:start
pnpm check
```

依赖安装应在仓库根目录执行：

```bash
pnpm install
```

## 3. 移动端结构

移动端位于 `apps/mobile`，保留 Expo Router 的标准结构。

```text
apps/mobile/
├── app.config.ts
├── eas.json
├── package.json
├── tsconfig.json
├── app/                    # 只负责参数、导航和 feature screen 挂载
├── src/                    # 移动端业务源码
├── modules/                # Live Activity、WatchConnectivity、SQLite 保护 Expo Modules
├── assets/                 # 图标、启动图、音效
└── ios/                    # iOS 原生工程与 Live Activity 扩展
```

### 3.1 页面路由

```text
apps/mobile/app/
├── _layout.tsx
├── index.tsx
├── settings/index.tsx
├── training/
│   ├── index.tsx
│   ├── session.tsx
│   └── complete.tsx
├── toilet/
│   ├── index.tsx
│   └── complete.tsx
├── habits/index.tsx
├── reminders/index.tsx
├── safety/index.tsx
└── trends/index.tsx
```

当前导航是单首页结构，不使用底部 Tab。首页为 `apps/mobile/app/index.tsx`，二级页统一使用 `AppTopBar` 返回或关闭。

### 3.2 移动端源码

```text
apps/mobile/src/
├── components/             # 通用 UI 组件
├── api/client/             # auth/users/teams/nudges/reports/push 等领域 client
├── features/               # screen、section、hook、Query 与本地领域逻辑
├── navigation/             # 路由常量
├── storage/                # SQLite 初始化、迁移和 repository
└── theme/                  # 深浅色主题 token 和 provider
```

核心功能域：

| 路径 | 说明 |
| --- | --- |
| `features/training` | 菊花抬训练、训练模式、训练记录 |
| `features/toilet` | 蹲会儿计时、阶段提醒、音效、Live Activity 桥接 |
| `features/habits` | 小账本标准、快速打卡、详情滑块 |
| `features/reminders` | 小暗号提醒、多段勿扰、本地通知 |
| `features/today` | 首页今日正反馈 |
| `features/trends` | 最近小报告 7 天与 30 天统计、90 天高级小报告同步与展示 |
| `features/settings` | App 设置、灵动岛计时、阶段音效开关 |

云端状态由 TanStack Query 持有；Zustand 只保存登录会话、本地健康领域状态和短期 UI 状态。SQLite repository 按日期范围与复合游标分页，`SyncCoordinator` 通过 revision/event 防抖并保证 single-flight 与一次尾随补跑。

### 3.3 iOS 原生工程

```text
apps/mobile/
├── modules/
│   ├── live-activity/
│   ├── watch-connectivity/
│   └── storage-protection/
└── ios/
    ├── app/
    ├── XiaoTiduLiveActivities/
    ├── XiaoTiduWatchApp/
    ├── XiaoTiduWatchComplications/
    ├── Tests/
    ├── app.xcodeproj/
    └── app.xcworkspace/
```

iOS 原生能力包括 ActivityKit + WidgetKit Extension、Watch App、Complication 和三个本地 Expo Modules。Live Activity 与 WatchConnectivity 保持独立类型化接口，Watch 侧进一步拆分 ViewModel、Connectivity client、state store 与 actor 离线队列。

注意：

- Expo Go 不能验证 Live Activity。
- Development Build 或正式包才能验证灵动岛计时。
- `eas.json` 在 `apps/mobile` 内，EAS 构建命令应从移动端目录执行。
- 如果出现 `The sandbox is not in sync with the Podfile.lock`，需要在 `apps/mobile/ios` 下执行 `pod install` 同步 CocoaPods sandbox。

```bash
cd apps/mobile
pnpm exec eas build --profile development --platform ios
```

### 3.4 资源

```text
apps/mobile/assets/
├── icon.png
├── adaptive-icon.png
├── splash-icon.png
├── favicon.png
└── sounds/
    ├── toilet-knock-5.wav
    ├── toilet-chime-10.wav
    ├── toilet-warning-15.wav
    └── toilet-stop-20.wav
```

PNG 的用途、重复关系、无损压缩与原生构建回归记录见
[移动端图片资产审计](./architecture/mobile-assets.md)。

## 4. 后端结构

后端位于 `apps/api`，当前是 Hono + Drizzle 的模块化单体 API 服务。

```text
apps/api/
├── package.json
├── tsconfig.json
├── drizzle.config.ts
├── drizzle/               # Drizzle 生成的 SQL migration
└── src/
    ├── server.ts          # Node 入口，负责 listen 和关闭依赖
    ├── app.ts             # 兼容导出 createApiApp
    ├── app/               # Hono app 装配层
    ├── config/            # 环境变量和版本
    ├── db/                # Drizzle client、schema、health check
    ├── dependencies/      # API 依赖装配
    ├── http/              # 通用响应、错误和 middleware
    ├── lib/               # 基础设施工具
    ├── modules/           # 按业务域组织的后端模块
    └── __tests__/         # API handler 集成测试
```

当前已实现接口：

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/health` | 服务健康检查 |
| `GET` | `/health/db` | 数据库连通性检查 |
| `POST` | `/auth/apple` | Apple 登录 |
| `POST` | `/auth/refresh` | refresh session 轮换 |
| `POST` | `/auth/logout` | 撤销当前 session |
| `GET/PATCH` | `/me` | 当前用户信息读取和更新 |
| `GET` | `/me/entitlements` | 会员权益 |
| `POST/GET/PATCH` | `/teams/*` | 小队、成员和邀请操作 |
| `GET/POST` | `/team-invites/*` | 邀请预览和接受邀请 |
| `PUT` | `/share-settings` | 共享设置 |
| `PUT` | `/share-snapshots/today` | 每日低敏共享快照 |
| `GET/POST` | `/nudges/*` | 提醒线程、游标详情、发送和回执 |
| `POST` | `/push-tokens` | Push token 同步 |
| `POST` | `/subscriptions/*` | 订阅校验和恢复入口 |
| `GET/PUT` | `/reports/*`、`/report-snapshots/*` | 高级报告和报告快照 |

结构原则：

- `server.ts` 只负责启动 Hono 服务和关闭依赖。
- `src/app/` 负责 request id、请求日志、错误处理和路由注册。
- `src/dependencies/` 负责选择 mock 或 Drizzle 实现，避免散落在入口文件。
- `src/modules/` 采用 feature-first 结构，把 route、service、repository、policy、mapper 和 mock 放在同一业务域内。
- 所有 Hono route 已归入对应模块，`app/registerRoutes.ts` 只负责挂载路径，不承载业务逻辑。
- route 直接注册共享 Zod schema 并生成 OpenAPI；service 编排事务；repository 负责 Drizzle；policy 保存无数据库依赖的业务规则。
- `src/db/schema.ts` 是 Drizzle schema 兼容出口，实际表定义拆在 `src/db/schema/` 下。
- 结构迁移必须保持 API path、响应格式、Drizzle 表名 / 字段名 / enum 名和 `packages/contracts` 类型稳定。

当前后端源码分层：

```text
apps/api/src/
├── app/
│   ├── createApiApp.ts
│   ├── errorHandler.ts
│   ├── registerRoutes.ts
│   ├── requestLogger.ts
│   └── types.ts
├── db/
│   ├── client.ts
│   ├── health.ts
│   ├── schema.ts
│   └── schema/
│       ├── audit.ts
│       ├── common.ts
│       ├── enums.ts
│       ├── nudges.ts
│       ├── push.ts
│       ├── reports.ts
│       ├── sharing.ts
│       ├── subscriptions.ts
│       ├── teams.ts
│       └── users.ts
├── dependencies/
│   └── createDependencies.ts
└── modules/
    ├── auth/
    ├── entitlements/
    ├── health/
    ├── nudges/
    ├── push/
    ├── reports/
    ├── subscriptions/
    ├── teams/
    └── users/
```

运行：

```bash
pnpm api:dev
pnpm api:start
pnpm --filter @xiaotidu/api typecheck
pnpm --filter @xiaotidu/api test
```

## 5. 共享契约结构

共享契约位于 `packages/contracts`。

```text
packages/contracts/src/
├── common.ts
├── auth.ts
├── users.ts
├── teams.ts
├── nudges.ts
├── reports.ts
├── push.ts
├── subscriptions.ts
└── index.ts               # 仅重导出
```

每个领域以 Zod schema 为单一来源并通过 `z.infer` 导出类型，API 和移动端在运行时解析请求或响应。当前包含：

- 会员状态：`ProStatus`
- 搭子提醒类型：`BuddyNudgeType`
- 提醒回执：`BuddyNudgeAckStatus`
- 每日共享快照：`DailyShareSnapshot`
- 小队成员角色与状态
- API 响应类型：`ApiHealthResponse`、`EntitlementsResponse`

原则：

- 前后端共用的状态、枚举和接口响应类型放在 `packages/contracts`。
- 移动端私有 UI 类型不放入 contracts。
- 后端数据库实体不直接暴露给移动端，需转成共享 DTO。

## 6. 验证命令

每轮结构或代码调整后执行：

```bash
pnpm check
pnpm --filter @xiaotidu/mobile exec expo install --check
git diff --check
```

说明：

- `pnpm check` 会执行全仓类型、ESLint、Prettier、单元/集成测试和 OpenAPI 漂移检查。
- `expo install --check` 需要针对移动端包执行。
- 三个 Xcode scheme 由 GitHub Actions 的 macOS job 构建，真机能力仍按手动清单验收。

## 7. Git 注意事项

移动端文件均在 `apps/mobile` 下修改，不向根目录新增 `app/`、`src/`、`ios/` 或 `assets/`。OpenAPI 文件是生成物，不手工编辑；更新路由或 contracts 后运行生成命令并提交结果。
