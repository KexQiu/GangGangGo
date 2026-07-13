# 小提督 v0.2 移动端后端接入计划

版本：v0.2
日期：2026-07-13
状态：代码接入完成，待生产能力与人工验收

## 1. 目标

移动端按完整产品形态接入后端，而不是只做临时调试页。

目标链路：

```text
Apple 登录 -> Token 持久化 -> 权益读取 -> Pro 门槛 -> 小队/邀请 -> 共享快照同步 -> 搭子提醒/回执 -> 高级小报告
```

v0.1 本地能力继续免费、离线可用；v0.2 云端能力只在用户登录后启用。

## 2. 当前实现状态

已接入：

- API base URL 集中配置。
- 按 auth/users/teams/nudges/reports/push 拆分的 API client，支持超时、取消、错误分类和 Zod 响应校验。
- SecureStore 会话，包含 15 分钟 access token、30 天可轮换 refresh session 和服务端撤销。
- TanStack Query 管理用户、权益、小队、提醒和报告；Zustand 只保存本地领域状态、短期 UI 状态和登录会话。
- `/me` 我的页，集中承载登录、昵称与头像编辑、Pro 状态、小队入口、搭子提醒和高级小报告入口。
- `/me` 当前使用开发 Mock 登录。真实 Apple 登录入口因 Personal Team 不支持相关 capability，已临时关闭。
- 设置页已精简为外观、小暗号、安全说明、灵动岛、声音与震动。
- `/me`、`/pro`、`/team`、`/team/invite`、`/team/join/[token]`、`/team/settings`、`/team/member/[userId]`、`/nudges`。
- 小队、邀请、接受邀请、共享设置、成员状态、搭子提醒、提醒回执。
- 今日低敏共享快照同步。
- Pro 高级报告最近 90 天快照批量同步。
- `/trends/advanced` 90 天高级小报告详情页。
- Push token 注册尝试。
- 后端 `/auth/refresh` 与 `/auth/logout` 已接入轮换和撤销。
- `SyncCoordinator` 负责防抖、single-flight、尾随补跑和子任务失败隔离。
- WatchConnectivity 与 Live Activity 已迁入独立本地 Expo Modules。

未完成：

- 真实 Apple 登录入口和真机联调。
- 真实订阅购买和恢复。
- 完整视觉验收和真机联调。

## 3. 前端分层规则

移动端后端接入按以下分层：

- `src/api/client`：按领域负责 HTTP、鉴权、超时、取消、错误分类和运行时响应校验。
- `src/features/account`：安全会话与账户 Query。
- `src/features/team`：小队、邀请、成员、共享设置 Query 与 mutation。
- `src/features/nudges`：线程、游标分页、回执和提醒设置 Query 与 mutation。
- `src/features/sync`：从范围化 SQLite repository 读取本地记录，生成低敏摘要并协调上传。
- 路由文件只解析参数和挂载 feature screen；页面不直接拼接 fetch，也不复制云端 store。

所有 API 类型必须来自 `@xiaotidu/contracts`，移动端不重复定义后端 DTO。

## 4. 数据同步边界

允许上传：

- 小花训练是否达标。
- 小账本完成度 `0-4`。
- 今天是否记过蹲会儿。
- 连续天数。
- 高级报告使用的最近 90 天日级 `date`、`trainingDone`、`habitCompletion`、`streakDays`、`toiletRecorded` 和 `toiletLongMeeting`。

不允许上传：

- 具体蹲会儿时长。
- 明显便血。
- 明显不舒服。
- 排便感受详情。
- 本地 SQLite 原始记录。

云端同步失败不能影响本地功能。
7/30/90 天聚合只在服务端读取响应时计算，不由移动端上传或持久化。

## 5. Pro 体验规则

免费可用：

- v0.1 所有本地功能。
- 登录账号。
- 查看当前权益。
- 接受小队邀请。
- 查看已加入的小队。
- 修改自己的共享设置。
- 回复搭子提醒。

需要 Pro：

- 创建小队。
- 创建邀请。
- 主动提醒搭子。
- 高级小报告。
- 小队周报。

真实订阅接入前，Pro 测试通过数据库手动写入 active 订阅完成。

## 6. 验收流程

后端：

```bash
pnpm api:start
curl http://localhost:8787/health/db
```

移动端：

```bash
pnpm mobile:ios
```

验收项：

- 未登录时，v0.1 本地功能全部可用。
- 首页右上角可以进入 `我的` 和 `设置`。
- `我的` 页可以 Mock Apple 登录。
- 设置页不再出现登录、Pro 或小队管理入口。
- 登录后 `我的` 页显示用户和免费权益。
- 登录后可在 `我的` 页修改昵称、预设 emoji 和背景色头像，小队成员卡同步展示。
- 免费用户创建小队会进入 Pro 引导。
- 测试用户变为 Pro 后，可以创建小队和邀请搭子。
- 接受邀请后，小队页能看到成员和低敏今日状态。
- 搭子可以发送固定提醒，对方可以回执。
- 关闭某项共享后，小队页不再展示对应字段。
- Pro 用户可以看到高级小报告入口。
- 进入 90 天回看前会尝试同步最近 90 天快照，失败时展示错误但不影响基础小报告。
- 90 天回看默认显示当前月份，可左右滑动切换月份，并可点击日期查看低敏详情弹窗。
- 退出登录后，本地健康记录不丢失。
