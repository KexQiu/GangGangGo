# R09 本地编辑与同步冲突验收

日期：2026-09-28。本批修复客户端同步在途覆盖本地新增、编辑和删除的问题，基于 R08 提交 `2d5a6bb`。R09 代码与自动化回归已完成，真实双设备验收仍待完成；不包含 R21 PostgreSQL 提交顺序修复。

## 冲突规则

1. 按 `profileId + entityType + entityId` 判断待上传状态。实体仍有 outbox 时，远端更新和删除均不覆盖本地事实；保护来自 SQLite 中的待发送记录，重启不丢失。
2. 沿用服务端现有整条记录覆盖规则，不做跨设备字段级合并，也不靠设备时钟决定胜负。本地未确认操作先保留，确认后按服务端 `version` 接受更新；另一设备在其后提交的版本仍可以覆盖。
3. push 返回后，仅删除本次请求中已确认的 mutation，并在同一事务应用对应返回版本、重建汇总。请求在途产生的新 mutation 不会被清除，旧 ACK 也不能覆盖它。
4. pull 返回时，在同一事务完成待上传检查、数据合并、汇总重建和 cursor 更新。失败整页回滚，不推进游标。
5. pull 期间出现本地操作时，本轮会补推并继续拉取。跳过的旧远端内容不会反复盖回本地：当前操作确认后会取得自己的服务端版本；同一会话的重叠同步共用一次执行。
6. 常用项除 ID 外还有同名唯一约束：保护不同 ID 的待上传新增项，避免被远端去重删除。只删除旧 ID 时，另一设备的新 ID 仍属于独立有效记录，不能因名称相同而永久跳过。删除后重新创建同名项会复用本地保留的 ID。

用户本地操作、同步读取 outbox、应用 ACK、合并 pull 共用会话写入队列；网络请求不占这个队列。排便编辑/删除、常用项增删已补入同一提交边界，避免检查与写入之间插入另一笔本地修改。排便编辑/删除在提交后更新 store，失败不撤回其他已成功的操作。

## 代码范围

- `apps/mobile/src/features/sync/fullDataSync.ts`：同会话请求合并、待上传保护、ACK 版本应用、补推循环、合并和游标事务。
- `apps/mobile/src/storage/dataSyncOutbox.ts`：队列确认与游标写入可复用调用方的数据库事务。
- `apps/mobile/src/storage/repositories/toiletRepository.ts`、`apps/mobile/src/features/toilet/toiletStore.ts`：编辑、删除和常用项写入串行，失败不污染数据库和可见状态。
- 未新增依赖，未修改同步接口或数据库 schema。

## 自动化证据

正式测试为 `apps/mobile/src/features/sync/__tests__/localEditConflicts.test.ts`。使用 Node SQLite 执行真实迁移、repository、store、每日汇总和 outbox；网络使用受控的版本日志与幂等 ACK，不冒充真实 PostgreSQL 或双设备联调。

覆盖范围：

- 训练、习惯和排便待上传记录对远端更新/删除的保护，最终补推与清空队列。
- pull 在途排便编辑/删除；push 在途再次编辑，旧确认只删除旧 mutation。
- 已确认记录遇到分页中的更旧云端历史，UI 不回退。
- 合并已经开始时本地编辑排队，保留远端未被修改的习惯字段。
- 补推断网后保留本地记录和 outbox，再同步成功。
- ACK、汇总或 cursor 写入失败回滚；重试复用 mutation，不重复生成服务端变更。
- 不上传尚未提交、最终回滚的本地 outbox；同会话重复同步共用执行。
- 不同 profile 的同 ID 待上传记录互不干扰。
- 同名常用项不同 ID、新增/删除/重新创建与同步去重的交错。
- 排便编辑、删除失败后数据库、outbox、UI 保持一致。

| 检查 | 本轮结果 |
| --- | --- |
| R09 SQLite 回归 | 21 项通过 |
| 移动端完整测试 | 24 个测试文件、168 项通过 |
| TypeScript、变更文件 ESLint、Prettier | TypeScript、变更文件 ESLint（0 warning）、全仓 format:check 均通过 |
| iOS / Android Expo export | 两个平台均导出成功 |
| 修复前负向对照 | 提取 `2d5a6bb` 的旧 `fullDataSync.ts` 到临时目录，通过 Vitest alias 跑同一习惯用例：按预期失败，记录被旧远端 delete 覆盖；当前实现通过 |

命令：`pnpm --filter @xiaotidu/mobile test`、`pnpm --filter @xiaotidu/mobile typecheck`，变更文件运行 `pnpm exec eslint ... --max-warnings 0` 与 Prettier 检查。Expo 使用 `EXPO_OFFLINE=1 EXPO_NO_TELEMETRY=1 EXPO_NO_DOTENV=1 CI=1` 执行 `bundle:check` 和 `bundle:check:android`。

## 尚未覆盖

- 真实 API/PostgreSQL、双设备交错编辑与断网恢复仍需联调；R21 的序列号分配与提交先后问题仍为单独待验证风险。
- 服务端 90 天保留与过期数据处理策略未改变；本批不承诺过期记录继续同步。
- 不提供跨设备字段级合并。多端修改同一实体时，按当前服务端整条记录版本规则收敛。
- R04、R05、R16 和原生 Watch 验收没有在本批关闭。
