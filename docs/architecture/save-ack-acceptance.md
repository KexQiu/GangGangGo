# R08 保存与 Watch 回执验收

日期：2026-09-28。范围：训练、习惯、排便新增记录，以及 Watch 实时发送和离线重放的保存结果。代码实现及自动化回归已完成；不能据此关闭真机验收项。

## 已实现

- 记录、outbox、每日汇总和 Watch 去重回执在同一 SQLite 事务提交。任何一步失败均回滚；手机 store 在提交后更新，失败向调用者抛出。
- 训练页面等待保存再跳转，失败停留并提供重试；重试复用 ID、结束时间和会话代次。习惯入口展示保存失败，不提前播放成功反馈。
- 状态协议 v4、事件协议 v3，同步升级手机和 Watch，不提供旧格式兼容。事件固定 `userId/profileId`，计时操作固定 `sessionId`。
- 实时事件也先持久化到 Watch 队列；逐条等待业务回执。`accepted/duplicate` 确认，`retryable`、未知/错 ID 回执和超时保留重试；`rejected` 提示失败并终止。原生桥接未就绪和超时返回 `retryable`。
- SQLite 回执跨进程去重；同 ID 不同内容永久拒绝。旧习惯事件重放不会覆盖后续修改，旧计时事件不能结束新计时。
- Watch 训练结束页区分待同步、已确认和永久失败；传输成功本身不显示保存成功。

## 自动化覆盖

| 测试文件 | 主要证据 |
| --- | --- |
| `src/features/watch/__tests__/watchPersistence.test.ts` | 真实 SQLite 事务；记录/outbox/汇总/回执故障回滚；提交前 UI 不变；重复投递；换号；习惯并发字段合并；计时清除失败后重试；过期计时目标拒绝 |
| `src/features/training/__tests__/trainingCompletion.test.ts` | 保存前不跳转、失败重试复用草稿、重复点击共用写入、旧会话失败不跳转 |
| `src/features/toilet/__tests__/watchTimerPersistence.test.ts` | 等待 KV 写入、失败恢复、重试不重置继续时间、不覆盖新计时 |
| `src/features/watch/__tests__/watchProtocol.test.ts` | 状态 fixture、隐私字段、非法事件拒绝、Swift 省略 level 的清除语义 |
| `src/storage/__tests__/migrations.test.ts` | 空库、版本 1 增量升级保留记录、重复初始化、失败回滚 |
| `ios/Tests/WatchCoreTestMain.swift` | 队列重启、顺序重放、临时不可用不删队列、保留原归属、业务回执分类、过期和容量限制 |
| `ios/Tests/WatchSessionManagerTestMain.swift` | 真实 manager + 受控传输；发送前入队、可重试回执、回执状态刷新不绕过退避、迟到回执、错 ID、确认与永久拒绝、无回调超时 |

测试路径均相对 `apps/mobile`。SQLite 使用 Node `DatabaseSync` 执行真实 SQL，原生存储、设备展示和网络传输采用 mock；测试通过不代表真实 WatchConnectivity 或设备端存储异常已验收。

本轮执行记录：

| 检查 | 结果 |
| --- | --- |
| 移动端完整测试 | 23 个测试文件、147 项通过；启动恢复状态补充断言另跑 Watch 持久化测试，19 项通过 |
| 移动端 TypeScript | 通过 |
| ESLint、Prettier、文档检查 | 全量 lint、format:check、docs:check 通过；后续调整的定向 lint 通过 |
| Swift fixture / 核心 / manager 受控传输测试 | 全部通过；manager 包含真实等待 15 秒无回调超时后重试 |
| iOS / Android Expo export | 均通过；仅验证 JS/资源导出，不替代原生构建 |
| watchOS 原生 scheme 构建 | 未完成：本机仅安装 Command Line Tools，未找到完整 Xcode |

命令：`pnpm --filter @xiaotidu/mobile test`、`pnpm --filter @xiaotidu/mobile typecheck`、`pnpm lint`、`pnpm format:check`、`pnpm docs:check`。Expo export 使用 `EXPO_OFFLINE=1 EXPO_NO_TELEMETRY=1 EXPO_NO_DOTENV=1 CI=1` 执行 `bundle:check` 和 `bundle:check:android`。Swift 编译命令见 `.github/workflows/ci.yml`。

## 保留的验收边界

- SQLite 与计时 KV 不是跨库事务：暂停/继续通过幂等重放恢复；结束记录提交后清除失败，通过持久化回执补做清除。Live Activity、通知和统计不参与健康记录提交。
- 手机训练失败草稿保留在当前页面，不承诺杀进程后恢复；Watch 队列仍限制为 25 条和 24 小时，超限/过期会移除事件。
- R04 只完成事件创建后的归属、计时 ID 和持久化幂等；训练开始时归属、设备状态乱序等完整生命周期仍待修复。R09 本地编辑/pull 冲突、R21 PostgreSQL 提交顺序未包含在本批。
- 待完整 Xcode 编译 iPhone/Watch/Complication，并在配对设备验证：离线实时操作、后台恢复、数据库不可写、ACK 丢失、换号、新旧计时、重启后重放。设备结果记录在[真机验收总清单](./physical-device-acceptance-checklist.md)。
