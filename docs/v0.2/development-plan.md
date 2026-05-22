# 小提督 v0.2 开发方案

版本：v0.2
日期：2026-05-22
阶段：下一版本开发规划
关联文档：[v0.2 PRD](./prd.md)、[v0.1 开发方案](../v0.1/development-plan.md)

工程结构总览：[项目结构说明](../project-structure.md)

## 1. 开发目标

v0.2 在 v0.1 本地优先 App 之上增加云端与会员能力：

1. 小提督 Pro 会员权益。
2. 好友监督、小队、搭子提醒和提醒回执。
3. Apple Watch 联动。
4. 90 天高级小报告和小队周报。

v0.1 的基础功能继续免费，且本地单人闭环不依赖云端可用。

当前仓库采用轻量 monorepo：

```text
apps/mobile          # Expo App
apps/api             # v0.2 后端服务
packages/contracts   # 前后端共享类型
```

当前工作区包名：

- `@xiaotidu/mobile`
- `@xiaotidu/api`
- `@xiaotidu/contracts`

常用脚本：

```bash
pnpm mobile:start
pnpm mobile:ios
pnpm api:dev
pnpm api:start
pnpm run typecheck
pnpm --filter @xiaotidu/mobile exec expo install --check
pnpm peers check
```

移动端 EAS 构建仍从 `apps/mobile` 执行，因为 `eas.json` 和原生工程都在移动端包内：

```bash
cd apps/mobile
pnpm exec eas build --profile development --platform ios
```

## 2. 推荐技术路线

移动端继续使用：

- Expo + React Native + TypeScript。
- Expo Router。
- zustand。
- expo-sqlite。
- expo-notifications。
- expo-haptics。
- expo-audio。
- iOS ActivityKit + WidgetKit Extension。

v0.2 新增：

- 后端服务：`apps/api`，用于账号、会员权益、好友关系、共享快照、提醒回执。
- 共享类型：`packages/contracts`，用于统一会员、搭子提醒、回执和共享快照类型。
- 数据库：Postgres 或等价关系型数据库。
- 认证：iOS 首期优先 Sign in with Apple。
- 订阅：StoreKit / App Store Server API。
- Watch：原生 watchOS target，使用 WatchConnectivity 与 iPhone 同步。
- Push：用于搭子提醒、提醒回执、小队状态更新。

不建议在 v0.2 直接做开放社区、自由聊天或 AI 健康助手。

当前已落地的后端骨架：

- `GET /health`：服务健康检查，返回 `xiaotidu-api`。
- `GET /me/entitlements`：会员权益占位接口，当前返回 `free`。
- 运行时暂用 Node.js `http`，后续可在不影响接口契约的前提下替换为 Hono。
- `@xiaotidu/contracts` 已定义会员状态、搭子提醒类型、提醒回执、每日共享快照等共享类型。

## 3. 系统模块

### 3.1 账号与会员

客户端需要新增：

- 登录入口。
- 账号状态 store。
- 会员权益 store。
- Pro paywall。
- 恢复购买入口。
- 订阅状态展示。

后端需要提供：

- 用户创建和登录绑定。
- App Store 订阅校验。
- 会员权益缓存。
- 订阅取消、过期、恢复后的状态同步。

会员状态建议：

- `free`
- `pro_active`
- `pro_grace_period`
- `pro_expired`

取消订阅后策略：

- v0.1 免费功能继续可用。
- 小队关系保留但暂停共享更新。
- Pro 页面和高级小报告变为只读或 paywall。
- 重新订阅后恢复小队和高级能力。

### 3.2 好友监督

新增核心对象：

- 小队。
- 搭子关系。
- 邀请链接。
- 共享设置。
- 搭子提醒。
- 提醒回执。

共享数据只上传低敏状态快照：

- 今日菊花抬是否完成。
- 今日小账本完成度。
- 今日蹲会儿是否记过。
- 最近 7 天摘要。
- 连续完成天数。

不得默认上传：

- 明显便血。
- 明显不舒服。
- 具体蹲会儿时长。
- 具体排便感受。

搭子提醒：

- 只允许预设文案。
- 不支持自由文本。
- 每个搭子每日提醒上限可设置，默认 5 次。
- 建议选项：0、3、5、8 次。
- 0 次等同关闭该搭子的主动提醒。

提醒回执：

- 固定选项：收到、等会儿、已完成。
- 每条提醒只能回执一次。
- 30 分钟内允许修改一次。
- 回执只展示给发起提醒的搭子。
- 不进入小队公开动态。

### 3.3 Apple Watch

新增 watchOS target：

- Watch 首页。
- 菊花抬训练页。
- 小账本快速打卡页。
- 蹲会儿状态页。
- 基础 complication。

数据同步：

- Watch 通过 WatchConnectivity 与 iPhone 同步。
- iPhone 仍是本地数据主源。
- Watch 离线完成的动作需要在重新连接后补同步。

Watch 端限制：

- 不做小账本三档精细调整。
- 不做自由文本。
- 不播放蹲会儿阶段音效。
- 蹲会儿提醒以震动为主。

### 3.4 高级小报告

Pro 解锁：

- 90 天小报告。
- 小队周报。
- 长会趋势。
- 小账本满格趋势。
- 菊花抬营业趋势。

高级小报告仍不做：

- 健康评分。
- 医疗判断。
- 排行榜。
- 风险数据庆祝。

## 4. 客户端页面调整

新增页面：

- Pro 介绍页。
- 订阅购买页。
- 账号页。
- 小队首页。
- 邀请搭子页。
- 邀请接受页。
- 共享设置页。
- 搭子提醒设置页。
- 高级小报告页。
- Watch 配对说明页。

现有页面调整：

- 首页增加轻量 Pro 入口，但不抢菊花抬主行动。
- 设置页增加账号、Pro、小队、Apple Watch。
- 最近小报告增加 90 天入口。
- 小暗号设置页不强推会员。

## 5. 数据与接口方向

后端接口应覆盖：

- 登录和用户资料。
- 会员状态。
- 创建/查询/退出小队。
- 生成/接受/撤销邀请。
- 查询搭子状态快照。
- 更新共享设置。
- 发送搭子提醒。
- 提交提醒回执。
- 查询高级小报告。

接口原则：

- 健康敏感数据默认不上云。
- 风险数据默认不共享。
- 服务端只保存 Pro 功能必需的低敏摘要。
- 所有小队和提醒接口都要校验成员关系和会员状态。

## 6. 测试计划

基础回归：

- v0.1 免费功能在未登录、未订阅状态下完整可用。
- 本地 SQLite 数据记录不受云端失败影响。

会员：

- 订阅成功后权益生效。
- 取消订阅后 Pro 能力冻结，基础功能可用。
- 恢复购买后权益恢复。

好友监督：

- 邀请、接受、退出、移除都正确。
- 共享只展示低敏状态。
- 搭子提醒每日上限生效。
- 0 次上限会关闭该搭子的主动提醒。
- 回执只能提交一次，30 分钟内可修改一次。

Apple Watch：

- Watch 菊花抬完成后同步回 iPhone。
- Watch 小账本快速打卡同步回 iPhone。
- Watch 蹲会儿状态和 iPhone 一致。
- Watch 离线操作重新连接后补同步。

隐私：

- 明显便血、明显不适不上传到小队共享。
- 暂停共享后搭子不再看到新状态。
- 退出小队后不能访问对方新数据。

## 7. 开发顺序建议

1. 账号与会员权益底座。
2. Pro paywall 和订阅恢复。
3. 小队和邀请流程。
4. 低敏状态共享快照。
5. 搭子提醒和提醒回执。
6. 高级小报告。
7. Apple Watch target 和 WatchConnectivity。
8. 全链路隐私与异常处理验收。

## 8. 当前结论

v0.2 可以作为小提督 Pro 的第一版，但要坚持两条边界：

1. v0.1 单人基础能力继续免费。
2. 好友和云端只处理低敏摘要，不把私密健康细节社交化。
