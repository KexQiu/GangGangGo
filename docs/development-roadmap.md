# 小提督整体开发路线图

日期：2026-05-22
阶段：v0.1 已完成，v0.2 规划开发
关联文档：[项目结构说明](./project-structure.md)、[v0.1 PRD](./v0.1/prd-v0.1.md)、[v0.2 PRD](./v0.2/prd.md)、[v0.2 开发方案](./v0.2/development-plan.md)

## 1. 当前状态

当前项目已经完成 v0.1 的单人本地闭环，并已改造成轻量 monorepo。

已完成：

- 移动端 App：`apps/mobile`
- 后端骨架：`apps/api`
- 前后端共享类型：`packages/contracts`
- v0.1 文档归档：`docs/v0.1`
- v0.2 需求与开发方案：`docs/v0.2`

v0.1 当前能力：

- 菊花抬训练。
- 蹲会儿计时、阶段提醒、阶段音效和离开提醒。
- 小账本打卡、固定判断标准、首页快速打卡撤销。
- 小暗号提醒、多段勿扰。
- 最近小报告。
- 小花说明书。
- iOS Live Activity / 灵动岛计时基础能力。

v0.2 目标：

- 小提督 Pro 会员权益。
- 好友监督、小队、搭子提醒和提醒回执。
- Apple Watch 联动。
- 高级小报告。

## 2. 开发原则

### 2.1 免费能力不倒退

v0.1 的单人本地能力必须继续免费、离线可用：

- 菊花抬。
- 蹲会儿。
- 小账本。
- 小暗号。
- 最近小报告基础版。
- 小花说明书。

云端或订阅失败时，不能影响这些基础能力。

### 2.2 隐私优先

v0.2 后端不做完整健康数据仓库。默认只上传 Pro 功能必要的低敏摘要。

不上云的数据：

- 明显便血。
- 明显不舒服。
- 具体蹲会儿时长。
- 具体排便感受。
- 训练过程明细。

可选上传的低敏摘要：

- 今日菊花抬是否完成。
- 今日小账本完成度。
- 今日是否记过蹲会儿。
- 连续完成天数。
- 最近 7 天摘要。

### 2.3 契约先行

跨端共享的数据结构先写入 `packages/contracts`，再分别在 `apps/api` 和 `apps/mobile` 中实现。

适合放入 contracts：

- API 请求/响应 DTO。
- 会员状态。
- 小队成员状态。
- 搭子提醒类型。
- 提醒回执类型。
- 低敏共享快照。

不适合放入 contracts：

- 移动端 UI props。
- 后端数据库实体内部字段。
- 本地 SQLite 私有记录。

### 2.4 纵向切片开发

每个阶段优先做一条可跑通的端到端链路，而不是一次性铺满所有页面和表。

推荐节奏：

1. 先定义 contracts。
2. 再实现 API。
3. 再接移动端 store/client。
4. 最后补 UI 和验收。

## 3. 版本节奏

| 版本 | 阶段 | 目标 |
| --- | --- | --- |
| v0.1 | 已完成 | 单人本地健康习惯闭环 |
| v0.1.x | 稳定期 | 修复体验问题、完善真机测试和发布准备 |
| v0.2-alpha | 开发期 | 账号、会员、小队、搭子提醒基础链路 |
| v0.2-beta | 测试期 | 好友监督闭环、高级小报告、Apple Watch 初版 |
| v0.2 | 发布候选 | 小提督 Pro 第一版 |

## 4. v0.1 稳定期

目标：保证当前移动端在 monorepo 后仍能稳定开发、构建和测试。

### M0.1 工程稳定

交付物：

- 根脚本可用。
- `apps/mobile` 可正常启动。
- iOS 原生路径在 monorepo 下可构建。
- 文档能准确描述当前结构。

验收：

```bash
pnpm run typecheck
pnpm --filter @xiaotidu/mobile exec expo install --check
pnpm peers check
plutil -lint apps/mobile/ios/app/Info.plist apps/mobile/ios/XiaoTiduLiveActivities/Info.plist
git diff --check
```

### M0.2 真机测试准备

交付物：

- Expo Go 测试路径。
- Development Build 测试路径。
- Live Activity 真机测试说明。
- 远程测试限制说明。

验收：

- Expo Go 能打开首页和核心流程。
- Development Build 能验证图标、通知和 Live Activity。
- 文档中明确 Expo Go 不支持灵动岛。

## 5. v0.2 开发阶段

### M1. 后端基础设施

目标：把 `apps/api` 从骨架推进到可持续开发的服务底座。

交付物：

- API 框架：优先 Hono。
- 统一错误结构。
- 请求日志。
- 环境变量读取。
- `/health` 保留。
- `/me/entitlements` 保留。
- 本地开发脚本。
- 后端测试脚本。

建议文件：

```text
apps/api/src/
  server.ts
  app.ts
  config/env.ts
  http/errors.ts
  http/response.ts
```

验收：

- `pnpm api:dev` 可启动服务。
- `GET /health` 返回正常。
- 类型检查通过。
- 没有接入数据库时也能运行。

### M2. 数据库与迁移

目标：建立 v0.2 云端数据基础。

推荐技术：

- Postgres。
- Drizzle 或 Prisma。

首批表：

- `users`
- `subscriptions`
- `teams`
- `team_members`
- `team_invites`
- `share_settings`
- `daily_share_snapshots`
- `buddy_nudges`
- `buddy_nudge_acks`
- `push_tokens`

验收：

- 本地数据库可启动。
- migration 可重复执行。
- seed 可创建测试用户、小队和快照。
- 数据库实体不直接暴露给移动端。

### M3. 账号与会员权益

目标：先跑通“用户是谁”和“是否 Pro”。

后端：

- Sign in with Apple 登录入口。
- 用户资料。
- 会员权益查询。
- App Store 订阅校验占位。
- App Store Server Notifications 接收入口。

移动端：

- 账号页。
- 登录状态 store。
- 会员权益 store。
- 设置页增加账号和 Pro 入口。

验收：

- 未登录时 v0.1 功能完整可用。
- 登录后能看到账号状态。
- 免费用户权益为 `free`。
- Pro 页面能根据权益状态切换展示。

### M4. Pro Paywall 与订阅恢复

目标：建立清晰的会员边界。

移动端：

- Pro 介绍页。
- 订阅购买页。
- 恢复购买入口。
- 取消订阅后的状态说明。

后端：

- 订阅状态表。
- 订阅状态刷新。
- grace period / expired / revoked 处理。

验收：

- 免费功能不被 paywall 拦截。
- Pro 功能入口能展示订阅页。
- 取消订阅后 Pro 功能冻结但数据保留。
- 恢复订阅后能力恢复。

### M5. 低敏共享快照

目标：让本地数据能以低敏摘要形式上云，为小队做准备。

contracts：

- `DailyShareSnapshot`
- `ShareSettings`

后端：

- `PUT /share-snapshots/today`
- `GET /me/share-snapshot`
- `PUT /share-settings`

移动端：

- 从本地 SQLite 汇总今日状态。
- 仅在用户登录并开启共享时上传。
- 上传失败不影响本地记录。

验收：

- 上传内容不包含便血、不适、具体时长。
- 离线时本地继续可用。
- 恢复网络后可补传最新摘要。

### M6. 小队与邀请

目标：跑通好友监督的关系链。

后端：

- 创建小队。
- 生成邀请。
- 接受邀请。
- 成员列表。
- 退出/移除成员。
- 暂停共享。

移动端：

- 小队首页。
- 拉个搭子页面。
- 邀请接受页。
- 共享设置页。

验收：

- Pro 用户能创建小队。
- 好友能通过链接加入。
- 小队最多 3 个搭子。
- 暂停共享后搭子看不到新状态。
- 移除搭子后对方不能继续访问新数据。

### M7. 搭子提醒与回执

目标：形成“提醒 -> 收到 -> 回执”的监督闭环。

contracts：

- `BuddyNudgeType`
- `BuddyNudgeAckStatus`

后端：

- `POST /nudges`
- `GET /nudges/inbox`
- `POST /nudges/:id/ack`
- 每日提醒次数限制。
- 30 分钟内允许修改一次回执。

移动端：

- 搭子提醒按钮。
- 通知快捷操作：收到、等会儿、已完成。
- 小队页展示回执状态。
- 单个搭子每日提醒上限设置，默认 5 次。

验收：

- 不支持自由文本。
- 每条提醒只能回执一次。
- 回执只展示给发起提醒的搭子。
- 0 次上限等同关闭主动提醒。

### M8. 高级小报告

目标：把 Pro 的长期价值做出来。

高级报告：

- 90 天小报告。
- 小队周报。
- 小花训练达标趋势。
- 小账本满格趋势。
- 蹲会儿长会趋势。

原则：

- 不做健康评分。
- 不做排行榜。
- 风险数据不庆祝。
- 风险提示仍指向小花说明书。

验收：

- 免费用户看到基础小报告。
- Pro 用户能看 90 天。
- 小队周报只展示低敏摘要。

### M9. Apple Watch 初版

目标：减少手机操作成本。

Watch 能力：

- 今日状态。
- 菊花抬训练。
- 小账本快速达标。
- 蹲会儿状态查看。
- 基础 complication。

同步：

- 使用 WatchConnectivity。
- iPhone 仍是本地数据主源。
- Watch 离线操作重连后补同步。

验收：

- Watch 完成菊花抬后 iPhone 有记录。
- Watch 快速打卡后 iPhone 首页更新。
- Watch 不展示敏感数据。
- Watch 不播放蹲会儿阶段音效，只使用震动。

### M10. 发布前验收

目标：保证 v0.2 可提测。

验收清单：

- v0.1 免费流程完整可用。
- 订阅成功、取消、恢复流程可用。
- 好友监督链路可用。
- 分享数据不包含敏感字段。
- 通知权限、推送 token、搭子提醒可用。
- Apple Watch 关键流程可用。
- 隐私说明和会员说明文案完整。
- TestFlight 包可安装。

## 6. 数据边界

### 6.1 本地保留

继续只在本机保存：

- 原始训练记录。
- 原始蹲会儿记录。
- 明显便血。
- 明显不舒服。
- 排便感受。
- 小账本每日明细。

### 6.2 云端保存

云端只保存：

- 账号。
- 会员状态。
- 小队关系。
- 邀请。
- 低敏每日快照。
- 搭子提醒。
- 提醒回执。
- Push token。
- 高级报告所需摘要。

## 7. 分支与提交建议

建议每个里程碑单独分支，分支名前缀使用 `codex/`：

```text
codex/api-foundation
codex/db-schema
codex/auth-entitlements
codex/pro-paywall
codex/team-invites
codex/buddy-nudges
codex/advanced-report
codex/watch-app
```

提交粒度建议：

- contracts 修改单独提交。
- API schema/migration 单独提交。
- 移动端 UI 和接入逻辑分开提交。
- 原生 Watch / iOS 能力单独提交。

## 8. 每阶段验收命令

基础命令：

```bash
pnpm run typecheck
pnpm --filter @xiaotidu/mobile exec expo install --check
pnpm peers check
git diff --check
```

后端阶段额外检查：

```bash
pnpm api:dev
```

iOS 原生阶段额外检查：

```bash
plutil -lint apps/mobile/ios/app/Info.plist apps/mobile/ios/XiaoTiduLiveActivities/Info.plist
```

如涉及 EAS 或 Watch：

```bash
cd apps/mobile
pnpm exec eas build --profile development --platform ios
```

## 9. 当前下一步

建议下一步进入 **M1 后端基础设施**：

1. 在 `apps/api` 引入 Hono。
2. 拆分 `server.ts` 为 `app.ts`、`config/env.ts`、`http/*`。
3. 在 `packages/contracts` 补充统一 API 响应和错误类型。
4. 保持 `/health` 和 `/me/entitlements` 可用。
5. 增加后端最小测试或 smoke script。

这一步完成后，再进入数据库和账号体系会更稳。
