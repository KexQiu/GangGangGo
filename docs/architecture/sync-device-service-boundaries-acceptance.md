# R21 / R04 / R16 / R05 修复与验收

日期：2026-09-28；基于 R09 提交 `a833934`。本批包含代码、迁移和自动化回归。不代表真实 Apple 登录、配对设备、推送平台或部署环境已完成验收。

## R21：同步版本与事务提交顺序

真实 PostgreSQL 的两个独立客户端调用实际 `createDrizzleDataSyncService`。第一笔完成所有 SQL 后暂停提交；第二笔写入不同日期，避开每日汇总的同一行锁；观察数据库实际锁等待或第二笔完成，再执行 pull。

修复前：3 项中 1 项失败，两个事务成功提交后，连续 pull 的结果只包含 1 条记录。证据保留为正式测试 `apps/api/src/__tests__/postgres.data-sync-ordering.integration.test.ts`；本轮负向运行日志 `/tmp/gangganggo-r21-before.log`。

修复：push 事务在任何版本分配前取得按用户命名的 PostgreSQL transaction advisory lock，直到提交或回滚自动释放。不同 API 实例共用同一数据库约束，不同用户仍可并发；没有改变游标格式或用设备时钟判断胜负。

修复后：提交延迟、事务回滚、不同用户不互相阻塞 3 项通过，同时检查重试 mutation 幂等。本轮实例来自 macOS 已安装的 PostgreSQL 18.3（CI 配置为 PostgreSQL 17，本轮未在 CI 执行），仅监听 `127.0.0.1:55439`，数据目录位于独立 `/tmp/gangganggo-r21-pg.*`；没有使用项目现有或生产数据库。

## R04：Watch 归属与状态顺序

- 训练开始时固定 owner，发送完成事件必须仍匹配当前 owner；换号清除未完成的训练展示。不能把 A 开始的训练以 B 的身份提交。
- 手机计时持久化开始时 owner，Watch 状态、计时动作及重复事件清理均检查 owner/sessionId。
- 状态协议升级为 v5，增加持久化递增 revision；Watch 保存最新 revision，拒绝较旧或相等的状态。覆盖主动消息、刷新响应、事件 ACK 及重启恢复。事件协议继续为 v3。
- 延用 R08 的持久化幂等与串行离线队列。手机与 Watch 更新为同一版本，不做旧开发格式兼容。

Swift 核心测试、真实 WatchSessionManager 加受控传输测试，以及 TypeScript/SQLite 回归覆盖账号切换、旧状态、重启、计时归属和存储失败。当前 Mac 只有 Command Line Tools；不能把这些测试算作完整 watchOS scheme 或签名配对设备验收。iPhone 重装清空 revision 时需同步重置/重新配对 Watch 缓存。

## R16：限流来源、容量与多实例

所有请求先按连接的真实来源使用基础预算；无效 Authorization 和任意转发头不能新建独立预算。认证成功后另按稳定 userId 计数，正常 token 轮换不重置预算。

默认忽略 `X-Forwarded-For` / `X-Real-IP`。只有连接来源位于 `API_TRUSTED_PROXY_IPS` 的明确 IP 列表中，且 X-Forwarded-For 为单个合法 IP 时才采用转发值；无效或多值回退到连接来源。部署代理必须覆盖该头，不能直接透传客户端内容。

生产入口有数据库时注入 PostgreSQL 共享计数器，多个 API 实例使用同一预算。内存实现用于无数据库开发及测试。两种实现均限制最多 10,000 个桶；达到上限时保留未过期预算，拒绝新身份，过期后回收。计数封顶，数据库失败不会自动降级到独立内存放行。数据库实现使用短事务锁保证容量及递增原子性；公开服务前仍应按预期流量验证数据库成本。

自动化覆盖轮换无效 token、伪造来源头、可信代理、用户令牌轮换、容量上限，以及两个独立数据库客户端共享预算。部署环境的实际代理覆盖规则、直连访问控制和压测仍待验收。

## R05：设备推送绑定与离线退出

注册必须带稳定 deviceId，服务端将其绑定到已认证且仍有效的 session。投递查询同时验证 session 的用户、撤销状态与有效期；刷新迁移绑定到同 family 的新 session。退出撤销本登录 family，不影响另一设备的独立会话。

新增设备解绑接口，仅匹配当前用户/deviceId/sessionId。原账号迟到的解绑、离线撤销，以及旧绑定的 DeviceNotRegistered 回执，不会关闭新绑定。通知权限拒绝时客户端也会撤销该设备当前绑定。

退出先持久化原 refresh token 和账号归属至独立 SecureStore 补偿队列，再删除本地登录会话并持久化清理完成标记；完成标记写入前不会发送并移除撤销请求。网络请求通过 `/auth/revoke` 仅撤销原 family，不使用当前账号凭证。启动、前台切换、前台每 60 秒与下次推送注册重试；临时失败保留队列。中断后恢复发现未完成的本账号撤销标记，会先清除旧会话，包含刷新恰好写入另一凭证的场景。旧 refresh 摘要只用于撤销，保留到过期；不会恢复刷新权限。

真实 PostgreSQL 测试覆盖刷新、独立设备、换号迟到撤销、过期会话、迟到平台错误及刷新/撤销并发。推送 fetch 使用受控响应，没有向 Expo/APNs 发送真实消息。离线请求未抵达服务端前，或投递已开始（已读取绑定）/平台已接受在途通知时，不能承诺立即停止投递。撤销完成后新开始的投递会过滤已撤销会话。

## 迁移与执行

新增 `0001_little_wasp.sql`：auth session family、push session 关联、限流桶及索引。现有无 session 的开发 push 行不会被发送查询选中，重新注册才会绑定。先迁移数据库再启动新 API；不修改已有健康记录。

主要命令：

- `DATABASE_URL=<隔离测试库> NODE_ENV=test pnpm --filter @xiaotidu/api db:migrate`
- `DATABASE_URL=<隔离测试库> NODE_ENV=test pnpm --filter @xiaotidu/api test`
- `pnpm --filter @xiaotidu/mobile test`
- `pnpm --filter @xiaotidu/contracts test`
- `pnpm typecheck`、`pnpm lint`、`pnpm format:check`、`pnpm --filter @xiaotidu/api docs:check`
- Swift 测试命令沿用 `.github/workflows/ci.yml`，fixture 更新为 v5。
- iOS / Android Expo export 使用本地离线依赖执行。

| 检查 | 结果 |
| --- | --- |
| R21 修复前负向验证 | 确认漏掉一条成功提交记录 |
| R21 PostgreSQL 回归 | 3 项通过 |
| R16 / R05 定向服务端回归 | 已纳入通过的完整 API 测试，包含真实 PostgreSQL 并发与绑定测试 |
| 移动端、contracts、API 全量 | 移动端 27 文件 / 179 项，contracts 6 文件 / 50 项，API 17 文件 / 70 项均通过；API 使用真实 PostgreSQL，无数据库跳过项；退出补偿收尾后专项复验 2 文件 / 22 项通过 |
| TypeScript / lint / 格式 / OpenAPI | API build、全仓 typecheck、全仓 lint、format:check、docs:check 均通过 |
| Swift 核心 / manager / fixture | 三个可执行测试均通过；manager 的传输为受控替代，未构建 watchOS scheme |
| iOS / Android Expo export | 两个平台均导出成功 |

本轮临时 PostgreSQL 在集成测试完成后已关闭，日志和临时数据目录保留；未推送，原有 `apps/mobile/ios/Podfile.lock` 改动未纳入本批。
