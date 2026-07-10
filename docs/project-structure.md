# 小提督项目结构说明

日期：2026-05-22
阶段：当前 monorepo 工程结构

## 1. 总体结构

当前仓库采用轻量 monorepo。移动端、后端和共享契约放在同一个仓库中，便于 v0.2 开始接入好友监督、会员权益和 Apple Watch 联动时共享类型与接口定义。

```text
.
├── apps/
│   ├── mobile/              # v0.1 Expo App，当前主要交付物
│   └── api/                 # v0.2 后端服务骨架
├── packages/
│   └── contracts/           # 前后端共享类型与接口契约
├── docs/
│   ├── v0.1/                # 当前完成版文档
│   └── v0.2/                # 下一版本规划文档
├── package.json             # monorepo 根脚本
├── pnpm-workspace.yaml      # pnpm workspace 配置
└── pnpm-lock.yaml
```

工作区包名：

| 路径 | 包名 | 说明 |
| --- | --- | --- |
| `apps/mobile` | `@xiaotidu/mobile` | Expo + React Native 移动端 App |
| `apps/api` | `@xiaotidu/api` | v0.2 后端服务骨架 |
| `packages/contracts` | `@xiaotidu/contracts` | 前后端共享类型 |

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
pnpm run typecheck
```

依赖安装应在仓库根目录执行：

```bash
pnpm install
```

## 3. 移动端结构

移动端位于 `apps/mobile`，保留 Expo Router 的标准结构。

```text
apps/mobile/
├── app.json
├── eas.json
├── package.json
├── tsconfig.json
├── app/                    # Expo Router 页面
├── src/                    # 移动端业务源码
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
├── features/               # 按功能域组织业务逻辑
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

### 3.3 iOS 原生工程

```text
apps/mobile/ios/
├── app/
│   ├── AppDelegate.swift
│   ├── Info.plist
│   ├── ToiletTimerLiveActivityModule.swift
│   └── ToiletTimerLiveActivityModule.m
├── XiaoTiduLiveActivities/
│   ├── Info.plist
│   ├── ToiletTimerAttributes.swift
│   └── ToiletTimerLiveActivityWidget.swift
├── app.xcodeproj/
└── app.xcworkspace/
```

iOS 原生能力包括 ActivityKit + WidgetKit Extension，用于蹲会儿灵动岛 / 锁屏 Live Activity。

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
| `POST` | `/auth/logout` | 登出占位 |
| `GET/PATCH` | `/me` | 当前用户信息读取和更新 |
| `GET` | `/me/entitlements` | 会员权益 |
| `POST/GET/PATCH` | `/teams/*` | 小队、成员和邀请操作 |
| `GET/POST` | `/team-invites/*` | 邀请预览和接受邀请 |
| `PUT` | `/share-settings` | 共享设置 |
| `PUT` | `/share-snapshots/today` | 每日低敏共享快照 |
| `GET/POST` | `/nudges/*` | 搭子提醒和回执 |
| `POST` | `/push-tokens` | Push token 同步 |
| `POST` | `/subscriptions/*` | 订阅校验和恢复入口 |
| `GET/PUT` | `/reports/*`、`/report-snapshots/*` | 高级报告和报告快照 |

结构原则：

- `server.ts` 只负责启动 Hono 服务和关闭依赖。
- `src/app/` 负责 request id、请求日志、错误处理和路由注册。
- `src/dependencies/` 负责选择 mock 或 Drizzle 实现，避免散落在入口文件。
- `src/modules/` 采用 feature-first 结构，把 route、schema、service、repository、mapper、mock 放在同一业务域内。
- 所有 Hono route 已归入对应模块，`app/registerRoutes.ts` 只负责挂载路径，不承载业务逻辑。
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
packages/contracts/
├── package.json
├── tsconfig.json
└── src/
    └── index.ts
```

当前包含：

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
pnpm run typecheck
pnpm --filter @xiaotidu/mobile exec expo install --check
pnpm peers check
plutil -lint apps/mobile/ios/app/Info.plist apps/mobile/ios/XiaoTiduLiveActivities/Info.plist
git diff --check
```

说明：

- `pnpm run typecheck` 会递归检查 `@xiaotidu/mobile`、`@xiaotidu/api`、`@xiaotidu/contracts`。
- `expo install --check` 需要针对移动端包执行。
- iOS plist 检查只验证 plist 格式，不等价于完整 Xcode 构建。

## 7. Git 注意事项

本次从单 Expo 项目改成 monorepo 后，Git 会显示大量根目录文件删除，以及 `apps/mobile` 下的大量新增文件。这是目录迁移的正常现象。

提交时建议把这次改动作为一次结构性提交，提交信息示例：

```text
Refactor project into monorepo
```

后续移动端文件均应在 `apps/mobile` 下修改，不再向根目录新增 `app/`、`src/`、`ios/` 或 `assets/`。
