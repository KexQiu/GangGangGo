# Architecture v2 后续待办

更新日期：2026-07-13  
审计基线：`codex/architecture-v2` / `b1030b2` / Draft PR #1

本文是 Architecture v2 集中优化完成后的唯一后续执行清单。它以代码、测试、CI 和现有文档的实际状态为准；旧的 [v0.2 总待办](../v0.2/todo-checklist.md) 继续记录产品规划，但其中与当前实现不符的勾选状态不再作为架构进度依据。

## 状态和优先级

- `P0`：合并当前 PR 前必须完成。
- `P1`：原 Architecture v2 计划尚未完成，合并后应优先偿还。
- `P2`：上线前需要完成的产品化、运维和合规工作。
- `P3`：已经明确不在当前版本范围内，只有重新排期后才实施。
- 每项只有在实现、自动化验证和必要的人工验收都有证据时才能勾选。

## P0：关闭当前重构分支

- [x] 修复 API 测试对 `DATABASE_URL` 的环境依赖。
  - 现状：`apps/api/src/__tests__/app.test.ts` 中“数据库未配置”场景在 CI 已注入 Postgres 时仍期望 `503`，导致 `typescript` job 失败。
  - 验收：该场景显式隔离环境变量，既不影响其他数据库测试，也不依赖执行顺序。
  - 证据：2026-07-13 已在未设置和显式设置 `DATABASE_URL` 的两种环境下通过测试。
- [x] 重新运行并通过 Draft PR #1 的全部 GitHub Actions。
  - 当前状态：`apple-builds` 与 `typescript` 均已通过。
  - 验收：Linux 类型检查、单元测试、Postgres 集成测试、OpenAPI 漂移检查和三个 Apple scheme 均为绿色。
- [x] 在合并前再次执行最终本地门禁。
  - 验收：`pnpm check`、Expo dependency check、三个 Xcode scheme 全部通过，工作区没有意外生成物。
  - 证据：2026-07-13 本地门禁通过，更新 Expo 补丁版本后远端三个 Apple scheme 再次通过。

## P1：代码结构

### 移动端页面分层

路由文件尚未做到只负责参数解析和导航，以下页面仍是大型单体文件：

- [ ] 拆分 `apps/mobile/app/trends/advanced.tsx`（约 1035 行）。
- [ ] 拆分 `apps/mobile/app/reminders/index.tsx`（约 977 行）。
- [ ] 拆分 `apps/mobile/app/index.tsx`（约 738 行）。
- [ ] 拆分 `apps/mobile/app/nudges/[userId]/index.tsx`（约 718 行）。
- [ ] 拆分 `apps/mobile/app/trends/index.tsx`（约 622 行）。
- [ ] 拆分 `apps/mobile/app/habits/index.tsx`（约 614 行）。
- [ ] 拆分 `apps/mobile/app/team/index.tsx`（约 596 行）。
- [ ] 拆分 `apps/mobile/app/watch/index.tsx`（约 537 行）。
- [ ] 拆分 `apps/mobile/app/toilet/index.tsx`（约 492 行）。
- [ ] 拆分 `apps/mobile/app/me/profile/index.tsx`（约 312 行）。
- [ ] 为上述页面建立对应 feature 目录，将 screen、section、hook 和样式按职责分离。
  - 验收：路由文件只保留路由参数、导航配置和 feature screen 挂载；业务逻辑可独立测试；原则上单文件不超过约 300 行。

### API 分层

- [ ] 为 team 领域建立 repository，移出 service 中的 Drizzle 查询。
- [ ] 为 nudge 领域建立 repository，移出 service 中的 Drizzle 查询。
- [ ] 为 report 领域建立 repository，统一批量写入和范围读取。
- [ ] 将队伍容量、单用户单小队、提醒限额和回执修改规则整理为无数据库依赖的 policy。
- [ ] 拆分约 550 行的 `teamService.ts` 和约 509 行的 `nudgeService.ts`。
  - 验收：route 只处理 HTTP；service 只编排用例和事务；repository 只负责查询；policy 可通过纯单元测试验证。

### OpenAPI 单一来源

- [ ] 用 Hono Zod OpenAPI 路由定义替代 `apps/api/scripts/generate-openapi.ts` 中手工维护的 operations 列表。
- [ ] 让请求、响应和错误 schema 直接来自 `packages/contracts`。
- [ ] 保留生成命令和 CI 漂移检查，但删除路由与生成脚本之间的重复接口登记。
  - 验收：新增或修改路由只需改路由声明和共享 schema；生成的 `openapi.json` 无人工编辑；快照测试通过。

### 移动端模块拆分

- [ ] 按 auth、users、teams、nudges、reports、push 拆分约 319 行的 API client。
- [x] 拆分约 567 行的 nudge store，并在完成服务端状态迁移后删除不再需要的 store action。
  - 证据：提醒服务端状态已迁入 `nudgeQueries.ts`，纯展示模型迁入 `nudgeModel.ts`，原 `nudgeStore.ts` 已删除。
- [ ] 为 Query hooks、mutation hooks 和 query key 建立稳定的 feature 级出口。
  - 验收：调用方不直接依赖一个全局大 client 或大 store；模块职责与 contracts 领域划分一致。

## P1：移动端状态、存储与同步

### 服务端状态边界

- [x] 将用户资料、Pro 权益、小队、邀请、提醒线程和报告改为直接由 TanStack Query 持有。
- [x] 从 Zustand 中移除云端状态副本及其手工刷新动作。
  - 证据：`authStore` 只保留安全会话、hydration 和开发账号选择；原 `teamStore`、`nudgeStore`、`reportStore` 已删除，云端 GET 调用仅存在于 Query options/hooks。
- [x] 删除移动端对 inbox/sent 双接口的依赖。
  - 证据：`getNudgeInbox`、`getNudgeSent`、`loadInbox`、`loadSent` 及对应 query key 已删除，移动端旧引用扫描为空。
- [x] 统一改用 `GET /nudges/threads` 和线程游标接口。
  - 证据：首页、小队页、成员设置和提醒聊天均直接使用 TanStack Query；聊天使用 30 条游标分页。
  - 验收：Zustand 只保留本地领域状态、短期 UI 状态和登录会话；云端数据没有双份缓存和双重失效逻辑。

### SQLite 范围读取与分页

- [x] 为训练、蹲会儿和习惯记录 repository 增加真正的 LIMIT/cursor 分页，而不只是 `sinceDateTime` 过滤。
- [x] 移除启动时把最近 366 天记录整体装入 Zustand 的行为。
- [x] 首页、趋势、报告和同步分别声明自己的最小数据窗口。
- [x] 保持现有 `PRAGMA user_version` 迁移链可从旧版本无损升级。
  - 验收：启动内存和查询量不随历史总量线性增长；90 天报告只读取 90 天；滚动加载不会重复或漏记录。
  - 证据：启动窗口缩减为 30 天，报告独立分页读取 90 天；v3 迁移增加复合游标索引并覆盖 v0、v2 升级路径。

### SyncCoordinator 完整闭环

- [x] 用 revision/event 通知协调器，避免订阅完整历史数组。
- [x] 补齐 bootstrap、前后台切换、快速 mutation 风暴和尾随补跑行为。
- [x] 明确共享快照、报告和 Push 的独立失败状态与重试入口。
  - 验收：一次本地操作风暴最多产生一个运行中同步和一个尾随同步；任一子任务失败不阻塞其他子任务。
  - 证据：调度核心为 Watch、权益、共享快照、报告和 Push 分别记录状态并提供单任务重试；5 项自动化测试覆盖防抖、single-flight、尾随补跑、前后台、失败隔离和定向重试。

### 提醒会话刷新

- [x] 验证提醒列表和聊天仅在页面聚焦且 App 位于前台时启用 15 秒刷新。
  - 证据：首页、小队页和聊天统一使用 `useForegroundFocus` 与 `shouldPollNudges`；条件矩阵已有自动化测试。
- [x] 页面失焦、进入后台和用户切换时取消未完成请求。
- [x] 完成游标翻页、去重、顺序稳定和新消息回填。
  - 验收：后台无提醒轮询；快速切换页面不会把旧用户或旧线程响应写入当前缓存。
  - 证据：统一取消函数由首页、小队页和聊天失焦/后台路径调用；QueryClient 测试覆盖 AbortSignal、用户 key 隔离、cursor 传递、跨页去重排序和 refetch 新消息回填。

## P1：iOS、Watch 与桥接

### Expo Modules 迁移

- [ ] 将 `ToiletTimerLiveActivityModule` 从旧 React Native bridge 迁移为本地 Expo Module。
- [ ] 保持 Live Activity 与 WatchConnectivity 为两个独立、类型化的 TypeScript 接口。
- [ ] 清理 `NativeModules.ToiletTimerLiveActivityModule` 和旧 `.m` 导出层。
  - 验收：Expo prebuild/Xcode 工程可重复生成；模块在开发、预览和生产配置下均能编译。

### WatchSessionManager 解耦

- [ ] 将约 612 行的 `WatchSessionManager.swift` 拆成主线程 ViewModel。
- [ ] 提取独立 Connectivity client。
- [ ] 提取持久化 state store。
- [ ] 使用 actor 隔离离线事件队列和 ACK 状态。
- [ ] 缩小 Watch Expo Module 原生文件的职责。
  - 验收：UI 状态、WCSession 生命周期、磁盘状态和队列并发可分别测试；重复事件保持幂等。

### Watch 计时与刷新

- [ ] 用下一阶段边界的一次性调度替代训练和蹲会儿每秒检查阶段 haptic。
- [ ] 保留 1 Hz 显示刷新，但确保它不承担阶段业务判断。
- [ ] 验证 WCSession 推送优先、首次失败后 5 秒重试、指数退避至 30 秒和后台零轮询。
  - 验收：每个阶段只触发一次 haptic；切换前后台不会遗留 timer；后台网络和连接轮询计数为零。

### 隐私日志约束

- [ ] 为日志建立统一脱敏入口，禁止 token、健康记录明细和完整 Watch payload。
- [ ] 为错误日志和调试日志增加自动化检查或测试。
  - 验收：测试 fixture 中的敏感值不会出现在日志输出；生产构建关闭仅供开发的 payload 日志。

## P1：自动化测试与性能验收

### Contracts

- [ ] 为 common、auth、users、teams、nudges、reports、push、subscriptions 的每个 schema 增加合法输入测试。
- [ ] 为长度、范围、枚举、日期、分页 cursor 和可选字段增加边界测试。
- [ ] 为未知字段、错误类型和跨字段冲突增加非法输入测试。
- [ ] 增加生成 OpenAPI 的快照测试。
  - 当前状态：只有 5 个较宽泛的 contracts 测试。

### API 与真实 Postgres

- [ ] 覆盖登录、refresh 轮换、旧 token 失效、logout 撤销和 session 过期。
- [ ] 覆盖并发建队和“单用户只能处于一个未移除小队”。
- [ ] 补齐并发接受邀请、重复接受、邀请失效和满员边界。
- [ ] 覆盖并发提醒每日额度，证明不会超发或产生 500。
- [ ] 覆盖回执并发创建、幂等重试和只允许一次修改。
- [ ] 覆盖 90 条报告 bulk upsert、覆盖写入和 7/30/90 天汇总读取。
- [ ] 覆盖用户 upsert、权益、共享权限和日期范围过滤。
  - 当前状态：真实 Postgres 只覆盖 refresh 轮换和并发接受邀请容量。

### 移动端

- [x] API client：10 秒超时、外部 AbortSignal、非 JSON、Zod 校验失败和错误分类。
- [ ] 认证：401 只刷新一次，并发 401 合并刷新，刷新失败只清会话不删健康数据。
- [x] 重试：GET/幂等 PUT 最多自动重试一次，创建类 POST 不隐式重试。
- [x] 同步：防抖、single-flight、尾随补跑和子任务失败隔离。
- [ ] Mock 用户切换：清云端 Query cache，保留 SQLite 健康记录。
- [x] SQLite：从 v0/v1 升级、失败回滚和数据无损。
  - 证据：Node 22 内存 SQLite 直接执行生产迁移 SQL，覆盖 v0 全链路、带健康记录的 v1 升级，以及 ALTER 后故障回滚；版本、schema 和既有记录均有断言。
- [x] 提醒：聚焦刷新、后台停刷、取消请求和游标分页。
  - 审计基线：移动端只有 Watch 协议 fixture 的 2 个测试。
  - 进展：2026-07-13 已增加 API transport、同步协调器、报告构建、分页、真实 SQLite 迁移、提醒模型/轮询/取消/游标、小队缓存和认证偏好迁移测试，移动端测试增至 33 项。

### Watch

- [ ] 覆盖 schema v2 兼容、隐私字段过滤和错误 ACK。
- [ ] 覆盖离线队列重启恢复、重复事件幂等和发送成功清理。
- [ ] 覆盖训练剩余时间推导、阶段边界和一次性 haptic 调度。
- [ ] 覆盖连接失败退避、恢复连接和后台无轮询。

### 性能门禁

- [ ] 为提醒列表和线程详情增加数据库语句计数断言，证明返回条数增加时查询数保持固定。
- [ ] 断言 90 天上传最多执行一次 bulk upsert SQL。
- [ ] 为 SQLite 大历史量建立启动、分页和 90 天报告基准。
- [ ] 为同步风暴和 Watch 后台行为建立可重复的计数型测试。

## P1：文档、资产与人工验收

### 文档校准

- [ ] 更新 `docs/development-roadmap.md`，删除已完成的“M1 下一步”和过期阶段描述。
- [ ] 校准 `docs/v0.2/todo-checklist.md`，修正 mock 用户、认证会话、并发保护、Postgres 测试设施和 OpenAPI 等已完成项。
- [ ] 更新移动端联调清单，删除“固定 mock 用户”和“上传冗余滚动汇总”等过期步骤。
- [ ] 在 API 分层完成后更新相关 ADR 和项目结构文档。

### 图片资产

- [ ] 盘点重复 PNG 和未使用资源。
- [ ] 对重复 PNG 进行无损压缩或去重。
- [ ] 确认 iOS App Icon 与 Android adaptive icon 各自保留正确语义和尺寸。
- [ ] 在 iOS 与 Android 构建中做视觉回归，确认不改变现有设计。
  - 当前状态：Architecture v2 分支没有 PNG 优化改动。

### 人工清单

- [ ] 完成移动端双用户联调清单并记录日期、设备、账号和结果。
- [ ] 完成 Watch 手动清单，包括离线恢复、重复事件、haptic、Complication 和系统刷新节奏。
- [ ] 在真机验证 Live Activity 签名、启动、更新、结束和 App 重启恢复。
- [ ] 复核 development、preview、production 三套 entitlement 与 Push capability。

## P2：上线前产品化

### 安全、隐私与账号

- [ ] 增加通用 API rate limit、请求体大小限制和安全响应头。
- [ ] 完成账号删除、数据导出和服务端数据保留策略。
- [ ] 完成隐私政策、健康数据边界和审计留痕流程。
- [ ] 建立密钥轮换、数据库备份恢复和最小权限访问流程。

### 生产环境与运维

- [ ] 部署生产 API 与 Postgres，配置独立环境变量和 secrets。
- [ ] 建立健康检查、结构化日志、指标、告警和备份演练。
- [ ] 验证迁移发布、回滚、连接池和超时参数。
- [ ] 建立生产故障和数据恢复手册。

### Apple 能力与商业化

- [ ] 接入真实 StoreKit 购买、恢复购买和取消后的权益生命周期。
- [ ] 接入 App Store Server API 校验和 Server Notifications。
- [ ] 接入真实 Sign in with Apple，并完成 Apple Developer capability。
- [ ] 接入远程 Push 发送、回执、失败重试队列和生产证书。
- [ ] 完成 Live Activity 真机签名和发布配置。
- [ ] 完成 Paywall、邀请分享、提醒设置和 onboarding 的产品验收。

### 发布准备

- [ ] 准备 App Store 隐私申报、订阅说明、截图和审核备注。
- [ ] 明确非医疗用途边界和用户可见说明。
- [ ] 完成生产双用户、Watch、Push、购买和账号生命周期回归。

## P3：明确延期范围

以下内容不是当前 Architecture v2 PR 的缺陷，保持延期，重新立项后再拆任务：

- [ ] Android 完整适配与发布。
- [ ] 社区功能。
- [ ] 自由聊天。
- [ ] AI 功能。
- [ ] 当前 v0.2 范围之外的新健康领域和 UI 重设计。

## 已完成基线

以下事项已落地，不应再以“待开发”重复排期；只保留上文列出的补测或验收工作：

- 工程版本统一为 `0.2.0`，pnpm lockfile、ESLint、Prettier、根检查脚本、提交前检查和 GitHub Actions 已建立。
- Contracts 已按领域拆分，并由 Zod schema 推导 TypeScript 类型。
- 15 分钟 access token、可轮换/撤销 refresh session、SecureStore 和 logout 撤销已实现。
- 数据库单一基线迁移、session/counter 表、关键索引、连接池配置和核心并发保护已实现。
- 提醒线程接口、联表查询、报告 bulk upsert 和读取时汇总已实现。
- 移动端 API 超时/取消/校验基础、TanStack Query、SyncCoordinator、SQLite 版本迁移和 90 天范围报告已实现。
- 开发环境 mock-user-a/b/c 切换已实现。
- Watch schema v2、共享 fixture、WatchConnectivity Expo Module、文件保护、1 Hz 显示刷新和前台退避重试已实现。
- 根 README、四份 ADR、动态 Expo 配置和生成式 OpenAPI 文档已建立。
- 三个 Xcode scheme 已在本地和当前 Apple CI 中通过。

## 推荐执行顺序

1. 先修复 P0 CI，得到可合并、可回归的稳定基线。
2. 补齐 contracts、API、移动端和 Watch 的关键自动化测试。
3. 完成 TanStack Query/Zustand 边界、SQLite 分页和同步事件化。
4. 完成 API 分层、OpenAPI 单一来源和移动端页面拆分。
5. 完成 Expo Modules/Watch 解耦、性能门禁和人工清单。
6. 校准旧文档、优化图片资产，再进入 P2 生产化工作。
