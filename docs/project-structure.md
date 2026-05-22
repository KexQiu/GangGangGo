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
| `features/trends` | 最近小报告 7 天与 30 天统计 |
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

后端位于 `apps/api`，当前是 v0.2 的轻量骨架。

```text
apps/api/
├── package.json
├── tsconfig.json
└── src/
    └── server.ts
```

当前已实现接口：

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/health` | 服务健康检查 |
| `GET` | `/me/entitlements` | 会员权益占位，当前返回 `free` |

当前后端运行时暂用 Node.js `http`，后续可以替换为 Hono 或其他轻量框架。替换框架时应保持 `packages/contracts` 中定义的接口类型稳定。

运行：

```bash
pnpm api:dev
pnpm api:start
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
