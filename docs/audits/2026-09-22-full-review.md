# 小提督全项目审查报告

审查日期：2026-09-22。分支：`feat/payment-overhaul`。基准提交：`82e4d2e`。

文档复核与修订日期：2026-09-28，复核提交：`c07d487`；该提交相对原基准只新增本报告，业务实现未变。本次修订补齐修复边界、纠正路由描述并调整优先级，不代表问题已修复。当前排期以 [Architecture v2 后续待办](../architecture/architecture-v2-follow-up-todo.md) 为准。

2026-09-28 实施更新：R02、R03、R10 已完成会话归属、HTTP 重试和暂时刷新失败处理，正式回归测试见[会话归属回归记录](../architecture/session-ownership-acceptance.md)。以下缺陷描述保留原始审查证据，不代表当前实现仍有相同行为；其余条目按待办继续跟踪。

## 结论

当前版本的主要页面、共享契约和常规测试已有基础，但还不适合直接作为正式发布候选。优先处理账号切换与同步竞态、Watch 旧事件归属、保存失败、退出后的推送解绑，并在 API 对外开放前补齐限流防护。真实登录、小屏操作可达性与隐私说明按依赖并行推进，随后补齐记录纠错、提醒续排与错误状态。

本报告是跨模块代码审查与针对性验证，不是“所有设备、所有路径均已通过”的验收。保留 21 个跟踪项，修订后为 11 项 P1、10 项 P2；R09、R16 从 P2 提升为 P1。其中 R21 最初是数据库并发时序推导，现已在隔离 PostgreSQL 复现并修复；R19 的后台表现仍需真机验证。没有发现足以定为 P0 的证据。

- **P0**：需立即处置的严重故障或已确认的重大数据安全事件。
- **P1**：公开测试或正式发布前必须解决或完成验收的关键项；条件项须注明对应功能开放前提。
- **P2**：应排期修复的体验、可恢复性或维护问题，按依赖安排，可与 P1 同批处理。
- **P3**：当前版本延期或仅在扩大产品范围时实施的事项。
- **证据类型**：“界面实测”指模拟器直接操作；“隔离复现”指真实业务函数加受控依赖；“静态证据”指代码路径核对；“时序推导”不等同于生产环境已复现。

优先级与后续待办采用同一定义。优先级不代表证据置信度或完成状态；R21 的当前实现和真实数据库证据见[本轮回归](../architecture/sync-device-service-boundaries-acceptance.md)，下文保留原始审查证据。

审查期间未修改业务实现。原有 `apps/mobile/ios/Podfile.lock` 修改保留；临时复现测试已移出源码目录。

## 范围与验证

### 2026-09-22 原始审查记录

以下范围和结果仅描述原始审查当日，不代表本次文档修订重新完成了全量测试或真机验收。

| 范围 | 本次覆盖 | 边界 |
| --- | --- | --- |
| 移动端 UI、交互 | 首页、计时、训练、完成页、数据日历、日详情、我的页面实测；设置、提醒、好友、记录编辑等代码审查 | 实测设备为 iPhone SE 第三代、iOS 17.5；未覆盖全部机型、深色模式与字体大小 |
| 业务状态 | 账号恢复与切换、本地资料分区、训练/习惯/排便记录、提醒、数据统计、错误处理 | 故障注入在隔离测试中完成 |
| 同步 | outbox、完整数据同步、旧摘要同步、协调器、远端合并、保留期 | 未进行双真机完整同步验收 |
| API 与契约 | 登录会话、好友权限、事件、推送、数据同步、账户相关接口、校验与限流 | 未连接生产服务；数据库集成测试有跳过项 |
| 原生功能 | Watch 协议、离线队列、事件处理、核心时间逻辑、Live Activity 桥接代码 | 无配对实体 Watch、APNs、正式签名安装包端到端测试 |
| 文案 | 入口名称、成功/失败状态、隐私说明、共享范围、记录语义、开发文案 | 未作临床有效性或法律合规背书 |

模拟器使用本机已有的开发客户端原生壳，加载本次提交的 JS；因此 UI 结论适用于本次 JS 与该原生壳组合，不能替代当前原生代码的重新编译验收。API 地址指向本地未运行的测试端口，使用匿名资料与合成记录，没有操作真实账号或生产健康数据。

| 检查 | 结果 |
| --- | --- |
| `pnpm test` | 189 通过，7 跳过：contracts 66，mobile 65，API 58 通过 / 7 跳过 |
| `pnpm typecheck`、`pnpm lint`、`pnpm build`、`pnpm format:check` | 通过（格式检查在新增本报告前执行） |
| `pnpm docs:check`、`pnpm versions:check` | 通过，版本 0.2.0 |
| iOS / Android `bundle:check` | 均通过；验证 JS 导出，不等于原生安装包构建通过 |
| Watch Swift 核心测试与协议 fixture | 通过 |
| 本次额外故障/竞态复现 | 9 个用例通过，断言的是缺陷确实存在，并非修复已通过 |

API 跳过项受 `DATABASE_URL` 未配置影响。原记录引用的 `/tmp/gangganggo-audit-tests.log` 与 `/tmp/gangganggo-audit-reproductions` 在 2026-09-28 复核环境中均不存在，因此上述历史结果保留为当日记录，不能作为当前可重复执行的测试证据。后续修复需将关键故障和竞态用例纳入仓库正式测试。

### 2026-09-28 文档复核

- 对照当前账号、同步、Watch、提醒、路由和限流实现重新核对关键发现。
- 运行移动端 `transport.test.ts`、`syncCoordinatorCore.test.ts`、`watchProtocol.test.ts`：3 个文件、16 项既有测试通过。这些测试未覆盖本次补充的跨账号重试和 Watch 失败回执问题。
- 使用实际业务函数和受控依赖隔离复现：R14 只生成两天提醒、R15 包含勿扰起点、R16 更换无效 Authorization 后绕过限流，以及 R03 的 HTTP 重试使用另一账号令牌。可重复执行的步骤见文末附录。
- Watch 对 `rejected` 回执也删除离线事件的结论来自 Swift 静态调用链核对；尚未补成原生回归测试。
- 未重跑全量 `pnpm check`，未进行真实 PostgreSQL 并发测试、生产请求或真机验收。

源码位置改用仓库相对链接；行号对应本次复核基线，后续实现变化时应同步更新。问题关闭需附修复提交、正式测试路径及执行结果；涉及设备能力时另附[真机验收记录](../architecture/physical-device-acceptance-checklist.md)。

## 发现

### R01 · P1 · 正式环境没有可用的真实登录入口

**证据：静态证据；开发态入口已实测。** “我的”未登录卡片无条件显示“开发 Mock 登录”，调用 `loginWithMockApple()`。`__DEV__` 只控制下方 A/B/C 账号选择，不控制主登录按钮。好友邀请加入页也调用 Mock 登录。服务端生产配置明确禁止 Mock Apple 验证；代码中没有完成真实 Apple 身份令牌获取的 UI 接入。

**影响：** 按当前代码发布后，正常用户无法通过该入口登录，云端同步、好友和需登录的 Watch 操作随之受阻。

**位置：** [me.tsx:117](<../../apps/mobile/app/(tabs)/me.tsx#L117>)、[authStore.ts:81](<../../apps/mobile/src/features/account/authStore.ts#L81>)、[邀请加入页](<../../apps/mobile/app/friend/join/[token]/index.tsx#L28>)、[env.ts:79](<../../apps/api/src/config/env.ts#L79>)。

**修复与验收：** 接通平台支持的正式登录方式；Mock 入口和文案只在开发态出现。用生产配置验证登录、取消授权、令牌失效、退出后重新登录及邀请加入全过程。

### R02 · P1 · 延迟返回的刷新请求会恢复已退出的旧会话

**证据：隔离复现。** A 的刷新请求发出后执行退出，待退出完成再返回 A 的刷新结果，`refreshSession()` 仍持久化并写回 A 的 access token。全局 `refreshPromise` 没有绑定账号或会话代次，退出也没有使其失效。

**影响：** 用户退出后旧身份重新出现；切换 B 时也可能被 A 的延迟响应覆盖。本地资料可能已经切到另一个分区，使认证和数据归属进一步失配。

**位置：** [authStore.ts:114](<../../apps/mobile/src/features/account/authStore.ts#L114>)，尤其 120–123 行的无条件写回。

**修复与验收：** 引入会话 generation；登录、退出、换号时递增，在持久化和状态写回前验证请求归属。同步约束 HTTP 层的 refreshPromise 和 unauthorized 回调，旧请求的失败不得清除新会话。覆盖“刷新→退出→旧响应”和“A 刷新→登录 B→A 响应”的成功、失败两条分支，以及“A 的 401 延迟到达 B 会话”的场景。

### R03 · P1 · 同步与 HTTP 重试可能把记录上传到另一账号

**证据：隔离复现。** 同步先读取 token，再异步读取活动 profile 和 user；只校验 user 非空，没有验证它与 token 属于同一身份。登录又先切本地 profile，再写入新 token，形成真实的失配窗口。测试提供 token A 与活动 profile B，B 的待同步记录被传入 `push(..., tokenA)`。

2026-09-28 补充复现：A 的请求发出后切换到 B，再让旧请求返回 401；`ApiTransport` 调用不带原请求身份的刷新回调，并用返回的新 token 重发原 body。受控刷新返回 B 的 token 时，A 的 body 被携带 B 的 token 重发。这条路径在同步入口校验之后发生，不能只修复首次读取 token/profile 的窗口。

**影响：** 账号切换期间可能将敏感记录写入错误账号。`push` 返回后的上下文检查不能撤回已经发送的数据。

**位置：** [fullDataSync.ts:36](<../../apps/mobile/src/features/sync/fullDataSync.ts#L36>)、[authStore.ts:64](<../../apps/mobile/src/features/account/authStore.ts#L64>)。

**补充位置：** [transport.ts:121](../../apps/mobile/src/api/transport.ts#L121)。

**修复与验收：** 将 userId、profileId、token、generation 组成一致的会话快照，身份变更期间暂停同步；首次请求、自动刷新、每次重试及本地应用响应前均验证原请求归属。同一会话内令牌正常轮换应继续可用，换号后旧请求必须终止，不能换用当前账号的令牌。覆盖 token/profile 错配、请求在途换号、刷新等待期间换号和旧 401 回调，证明不会在任一方向跨账号上传 outbox。

### R04 · P1 · Watch 旧计时事件能结束当前新计时

2026-09-28 实施进展：代码与自动化回归已完成，见[本轮修复记录](../architecture/sync-device-service-boundaries-acceptance.md)。以下描述为修复前基线；设备或部署验收边界详见记录。

**证据：隔离复现。** Watch 动作没有关联的用户、profile 或 timer session 身份。处理 `finish` 时直接使用手机当前 `activeSession.startedAt`，结束时间却取旧事件 `createdAt`。测试中 09:00 的旧 finish 结束了 10:00 开始的新计时，保存出“结束早于开始”的记录，并清空新计时。

**影响：** 离线重放、重新连接或换号后，旧暂停/结束操作会污染新计时；训练和习惯事件同样缺少账号归属。进程内事件 Set 也不足以提供跨重启的去重保障。

**位置：** [watchEventHandler.ts:110](<../../apps/mobile/src/features/watch/watchEventHandler.ts#L110>)、[watchTypes.ts](<../../apps/mobile/src/features/watch/watchTypes.ts>)。

**修复与验收：** 协议携带稳定的 user/profile/session 身份；核对归属和时间范围后应用。持久化幂等处理结果；验证旧 session、换号、跨重启和重复投递都不会修改新的状态。

### R05 · P1 · 退出登录不会解除该设备的账号推送绑定

2026-09-28 实施进展：代码与自动化回归已完成，见[本轮修复记录](../architecture/sync-device-service-boundaries-acceptance.md)。以下描述为修复前基线；设备或部署验收边界详见记录。

**证据：静态证据。** 服务端 logout 只撤销会话；push token 服务只有注册/重新归属，没有注销接口。发送端按 userId 与 enabled 查 token，不依赖会话是否已撤销。

**影响：** A 退出后，该设备仍可能收到 A 的好友/健康相关提醒。只有后续 B 成功重新注册同一 token 才会改绑；未登录、拒绝权限或网络失败时，旧归属仍在。

**位置：** [auth.route.ts:82](<../../apps/api/src/modules/auth/auth.route.ts#L82>)、[pushTokenService.ts:36](<../../apps/api/src/modules/push/pushTokenService.ts#L36>)、[pushNotificationService.ts:64](<../../apps/api/src/modules/push/pushNotificationService.ts#L64>)。

**修复与验收：** 增加设备级推送绑定撤销，明确多设备与多会话关系；退出时解绑且服务端可校验有效绑定。不能只依赖一次成功的 logout 请求，需要设计离线退出的解绑补偿及其归属校验。模拟 A 退出、设备停留匿名态、B 登录失败等情况，验证撤销生效后不再向该绑定投递 A 的内容，并记录离线撤销尚未送达及通知已在途时的边界。

### R06 · P1 · 用户看到的隐私说明小于实际同步与共享范围

2026-09-28 实施进展：登录前说明与好友逐字段说明已补齐，包含本机/云端 90 天保留期和自定义文字披露，见[本轮记录](../architecture/small-screen-privacy-acceptance.md)。以下为修复前证据；真实登录和原生交互验收尚未完成。

**证据：静态证据；登录卡片文案已实测。** 登录前只提示“同步云端能力”，实际会绑定本地资料并启动完整健康数据同步。好友“完整”权限说明只提到次数、时长、感受或等级，但服务端展开整个 toilet summary，包含形状、颜色、需留意次数和自定义小信号文字计数。用户难以根据现有说明判断具体披露范围。

旧 `AdvancedTrendsScreen` 源码还写有“不会上传便血、不适、排便感受或具体蹲会儿时长”，与完整同步已不一致。但 `/trends/advanced` 实际[重定向到新数据页](../../apps/mobile/app/trends/advanced.tsx#L5)，没有挂载该旧 screen；这部分属于废弃代码清理，不计作当前用户可见问题。R06 的发布阻断依据是仍在使用的登录说明和好友授权说明。

**位置：** [me.tsx:101](<../../apps/mobile/app/(tabs)/me.tsx#L101>)、[好友权限说明:39](<../../apps/mobile/app/friends/[userId]/index.tsx#L39>)、[friend.policy.ts:217](<../../apps/api/src/modules/friends/friend.policy.ts#L217>)、[dailyData.ts:223](<../../apps/mobile/src/features/data/dailyData.ts#L223>)、[AdvancedTrendsScreen.tsx:205](<../../apps/mobile/src/features/trends/screens/AdvancedTrendsScreen.tsx#L205>)。

**修复与验收：** 登录前说明同步的记录种类、历史范围和保留期；完整好友共享前列出自定义文字等具体字段，明确个人账号同步与向好友披露的区别。先利用现有 none/summary/detailed 权限完成清晰说明与选择，字段级权限作为独立产品决策，不作为本项默认重构范围。逐字段比对请求/响应与用户可见说明；废弃页面文案和历史文档另行清理。

### R07 · P1 · 小屏训练页的暂停、结束按钮不可到达

2026-09-28 实施进展：复核时训练页已恢复滚动，计时页仍禁用滚动。本轮将两页操作区固定在安全区内，正文独立滚动，移除计时页不可见占位，见[本轮记录](../architecture/small-screen-privacy-acceptance.md)。以下为原始审查时的界面证据；本轮未重新运行原生小屏实测。

**证据：界面实测。** iPhone SE 第三代、默认字体下，新手训练页的计时卡与说明卡占满屏幕，“暂停／结束”完全落在底部可视区外。尝试向下滚动没有效果。计时页“收工／暂停”的底部也被裁切。

**原因：** 两页使用 `scroll={false}`，配合固定圆环尺寸、大量纵向 padding 和不能有效压缩的内容。训练提示要求不适时停止，但正常结束控件不可达；用户只能从顶部关闭并放弃。

**位置：** [training/session.tsx:118](<../../apps/mobile/app/training/session.tsx#L118>)、[训练操作区:156](<../../apps/mobile/app/training/session.tsx#L156>)、[ToiletScreen.tsx:49](<../../apps/mobile/src/features/toilet/screens/ToiletScreen.tsx#L49>)。

**修复与验收：** 为操作区保留安全区域，将内容区改为可滚动或按可用高度缩放；不要依赖 `space-between` 消化超高内容。验证 375×667、小屏大字体、较大底部安全区下始终能暂停和结束。

### R08 · P1 · 训练和习惯保存失败仍表现为成功

2026-09-28 实施进展：保存事务、手机失败反馈和 Watch 分类回执已实现，见 [R08 回归记录](../architecture/save-ack-acceptance.md)。下述问题描述为修复前证据；原生构建与配对设备验收仍待完成。

**证据：隔离复现。** 模拟 repository 抛出 `disk full`，两个 store 的操作 Promise 都正常 resolve，并保留乐观更新的记录。错误只写入 store 字段。训练结束页调用 `addSession` 后立即跳转结果页，甚至未等待落库；Watch 对对应操作也可能返回接受回执。

**影响：** 用户看见完成/达标，重启后记录消失；手表收到成功回执后不再重试，扩大数据丢失影响。

**补充证据：Swift 静态调用链。** `WatchSessionManager.handleDeliveryResult` 对传输层 `.success(reply)` 无条件确认离线事件，未检查业务 `status`；`acknowledge` 会持久化删除该事件。因此，即使手机改为保存失败时返回 `rejected`，离线重放仍可能丢记录。实时发送收到拒绝也没有进入重试队列。

**位置：** [trainingStore.ts:53](<../../apps/mobile/src/features/training/trainingStore.ts#L53>)、[habitStore.ts:71](<../../apps/mobile/src/features/habits/habitStore.ts#L71>)、[training/session.tsx:87](<../../apps/mobile/app/training/session.tsx#L87>)。

**补充位置：** [WatchSessionManager.swift:163](../../apps/mobile/ios/XiaoTiduWatchApp/Connectivity/WatchSessionManager.swift#L163)、[WatchOfflineEventQueue.swift:209](../../apps/mobile/ios/XiaoTiduWatchApp/Connectivity/WatchOfflineEventQueue.swift#L209)。

**修复与验收：** 持久化失败需要返回明确失败并回滚或保留可重试草稿；只有落库成功才显示保存成功和发送 Watch 接受回执。手机与 Watch 联合定义回执语义：accepted/duplicate 才确认完成；临时失败保留或入队重试；账号/session 不匹配等永久拒绝明确提示并按约定终止，不得换账号重放。现有协议只有 rejected，尚无可重试分类，需要同步补齐两端协议；App 尚未上线，无需保留旧版兼容。覆盖实时发送、离线重放、数据库不可写、超时、未知回执、应用重启和重复投递。

### R09 · P1 · 拉取响应覆盖同步途中产生的本地新编辑

2026-09-28 实施进展：待上传记录保护、上传确认版本应用、同步补推与原子提交已实现，见 [R09 回归记录](../architecture/local-edit-sync-acceptance.md)。下述复现为修复前证据；真实双设备验收仍待完成。

**证据：隔离复现，使用 SQLite 执行实际合并 SQL。** push 阶段已结束、pull 尚未返回时，用户将饮水从 medium 改为 good；随后旧远端版本到达。合并只比较 `sync_version`，本地编辑未提升该服务器版本，也没有 pending outbox 保护，因此 good 被改回远端 low。

**影响：** 刚修改的记录突然回退。后续推送可能再恢复它，所以这里不能一概称为永久丢失；但用户可能基于回退后的整条记录继续编辑，生成错误的后续提交。

**位置：** [fullDataSync.ts:153](<../../apps/mobile/src/features/sync/fullDataSync.ts#L153>)，其他实体的合并和删除路径也需同类保护。

**修复与验收：** 合并时检查实体的本地修订号和待提交状态，采用明确的冲突解决策略。覆盖“pull 在途→用户修改/删除→旧响应到达”，确保 UI 与最终云端结果不回退。

### R10 · P2 · 暂时断网会被当成刷新凭证失效

**证据：隔离复现。** `refreshSession` 对所有异常执行清除凭证、清空云端缓存和切换匿名 profile。测试仅注入网络异常，也触发完整登出。

**影响：** access token 到期时遇到弱网，会让仍有有效 refresh token 的用户被迫重新登录；本地记录因资料分区切换而暂时“消失”。

**位置：** [authStore.ts:125](<../../apps/mobile/src/features/account/authStore.ts#L125>)。

**修复与验收：** 区分凭证明确失效与网络/服务暂时不可用；仅前者登出。HTTP 刷新结果需要保留失败分类，不能把暂时失败统一折成 null，再由原请求的 401 触发全局登出。断网时保留会话及本地资料，提供可恢复状态和重试；与 R02/R03 同批验证，旧账号的失败不得影响新账号。

### R11 · P2 · 新数据页没有已保存排便记录的编辑/删除入口

**证据：静态路由及调用点核对。** 新日详情里的 `ToiletDetailCard` 只能展开；唯一导航到 `routes.toiletRecord(id)` 的位置仍在未挂载的旧高级日历。旧高级页路由已重定向到新数据页，因此该调用点不是当前可达的编辑入口。

**影响：** 编辑/删除页面虽存在，用户通过当前正常流程无法到达，难以纠正时长、感受、自定义信号或删除误记数据。

**位置：** [DataDashboardSections.tsx:577](<../../apps/mobile/src/features/data/DataDashboardSections.tsx#L577>)、[AdvancedCalendarSection.tsx:246](<../../apps/mobile/src/features/trends/sections/AdvancedCalendarSection.tsx#L246>)。

**修复与验收：** 在日详情记录卡提供“编辑”和清晰的删除操作，接回现有记录页。验收“首页保存→数据日历→记录→编辑/删除→统计和同步更新”的完整路径。

### R12 · P2 · 关闭未保存的排便表单会丢失整次计时

**证据：界面实测与代码核对。** 点击“收工”进入已自动带入时长的记录页，随后点击左上角关闭，直接返回待开始页面，没有提示或草稿恢复入口。`endTimer()` 已提前清空持久化计时状态，而完成页只靠路由参数保存数据。

**位置：** [useToiletTimerScreen.ts:179](<../../apps/mobile/src/features/toilet/hooks/useToiletTimerScreen.ts#L179>)、[toilet/complete.tsx:37](<../../apps/mobile/app/toilet/complete.tsx#L37>)。

**修复与验收：** 将结束计时转为待补充的持久化草稿；保存后再清理。返回、手势离开、杀进程后均可恢复，主动放弃时明确告知。若产品选择自动保存基础时长，也要区分未填写的字段。

### R13 · P2 · 结束时间取“保存表单时刻”，扭曲记录日期与事件时间

**证据：静态证据。** 结束计时只传 startedAt 与 duration，`saveSession()` 使用新的当前时间作为 endedAt。用户结束后晚几分钟再填写，记录的时间和真实结束时刻就不一致；跨午夜填写可能改变按结束日期归档的结果。

**位置：** [toilet/complete.tsx:25](<../../apps/mobile/app/toilet/complete.tsx#L25>)、[useToiletTimerScreen.ts:185](<../../apps/mobile/src/features/toilet/hooks/useToiletTimerScreen.ts#L185>)。

**修复与验收：** 点击收工时固定 endedAt，与草稿一起保存。验证跨午夜、延迟填写和暂停过的计时，事件时间与统计日期保持一致。

### R14 · P2 · 久坐提醒只排到明天，之后开关仍开但不再提醒

**证据：隔离复现与调度调用点核对。** `SEDENTARY_SCHEDULE_DAYS = 2`，创建的是一次性 DATE 通知。补排主要发生在初始化/更改设置；回前台没有提醒续排。测试确认所有通知都只落在今天和明天。

**影响：** 用户超过这段排程窗口未重新初始化或调整设置，提醒自然耗尽；页面仍可能显示“每 60 分钟提醒”。

**位置：** [reminderLogic.ts:14](<../../apps/mobile/src/features/reminders/reminderLogic.ts#L14>)、[notificationService.ts:80](<../../apps/mobile/src/features/reminders/notificationService.ts#L80>)、[reminderStore.ts:93](<../../apps/mobile/src/features/reminders/reminderStore.ts#L93>)。

**修复与验收：** 选择明确的长期通知策略并滚动补排，至少在日期变化/回前台时校准；展示真实的下次提醒。若系统约束无法保证长期离线续排，文案需要准确说明限制。验收第三天及更长时间的行为。

### R15 · P2 · 勿扰开始边界仍会安排久坐通知

**证据：隔离复现。** 勿扰设为 12:00–14:00、间隔 60 分钟，生成结果包含 12:00。循环使用 `minute <= windowEnd`，而 windowEnd 正是勿扰起点；同文件的勿扰判定却将起点视为勿扰时间。

**位置：** [reminderLogic.ts:159](<../../apps/mobile/src/features/reminders/reminderLogic.ts#L159>)、[勿扰判定:189](<../../apps/mobile/src/features/reminders/reminderLogic.ts#L189>)。

**修复与验收：** 统一半开区间语义，并对最终候选通知再次过滤勿扰。覆盖午间、跨午夜、相邻和重叠区间。

### R16 · P1 · 限流可通过轮换无效 Authorization 值绕开

2026-09-28 实施进展：代码与自动化回归已完成，见[本轮修复记录](../architecture/sync-device-service-boundaries-acceptance.md)。以下描述为修复前基线；设备或部署验收边界详见记录。

**证据：隔离复现，未向外部服务发请求。** 限流优先哈希任何 Authorization 请求头作为独立身份，不先验证身份。阈值设为 1 时，连续两个不同的伪造请求头都获得 200。公开登录等入口不能靠这一规则限制同源请求。

**影响：** 防滥用能力失效；大量新键也会增长内存 Map，因为超过 10,000 后只清过期项。转发 IP 同样应有可信代理边界。

**位置：** [rateLimit.ts:22](<../../apps/api/src/http/middleware/rateLimit.ts#L22>)。

**修复与验收：** 在 API 对外开放前完成基础防护；未认证流量按可信来源施加基础预算，认证成功后再叠加稳定 userId 维度。限制桶数量，明确多实例方案。验证随机无效 token 仍触发基础限流；如由网关承担，必须验证可信代理和无法绕过网关直连应用的部署边界，不能只凭配置声称已解决。

### R17 · P2 · “云端同步已连接”不能反映真实同步状态

**证据：静态证据。** “我的”根据 user 是否存在直接显示该文案。协调器又将所有正常 resolve 的任务标为 success，包括返回 false 的任务；现有任务状态/重试接口没有接入用户界面。登录成功不代表完整记录已经上传或最近一次同步成功。

**位置：** [me.tsx:101](<../../apps/mobile/app/(tabs)/me.tsx#L101>)、[syncCoordinatorCore.ts:167](<../../apps/mobile/src/features/sync/syncCoordinatorCore.ts#L167>)。

**修复与验收：** 将“已登录”与“记录同步状态”分开呈现。同步任务明确返回成功/跳过/失败，显示最近成功时间、待上传数量、错误与重试入口；断网时不得给出已同步的暗示。

### R18 · P2 · 数据读取失败被显示为永久加载或无记录

**证据：静态证据。** 日详情失败后将 details 设回 null，弹窗把 null 解释为“正在读取当天记录…”。列表加载错误被忽略，初始生成的 90 天零值占位汇总会继续显示为零记录总览。

**影响：** 用户无法区分无记录与数据库异常，也没有重试入口，容易误以为历史数据丢失。

**位置：** [TrendsScreen.tsx:40](<../../apps/mobile/src/features/trends/screens/TrendsScreen.tsx#L40>)、[TrendsScreen.tsx:68](<../../apps/mobile/src/features/trends/screens/TrendsScreen.tsx#L68>)、[DataDashboardSections.tsx:465](<../../apps/mobile/src/features/data/DataDashboardSections.tsx#L465>)。

**修复与验收：** 分离 loading / error / empty / ready，失败后保留已有数据并给出重试。注入本地读取异常，确保不会永久转圈或伪装成零记录。

### R19 · P2 · 训练计时依赖回调次数，缺少后台恢复规则

**证据：静态证据；未完成实体设备后台复现。** 训练每次 `setInterval` 回调简单加 1，没有依据时间戳校准，也没有 AppState 切换处理。JS 回调被挂起或延迟时，计时、动作阶段和结束条件都会落后；与已有的排便时间戳计时方案不一致。

**位置：** [training/session.tsx:45](<../../apps/mobile/app/training/session.tsx#L45>)。

**修复与验收：** 先明确产品规则：离开前台自动暂停，还是后台继续计时。按选择持久化开始时刻、暂停累计时长并在恢复时校准。真机验证锁屏、切后台、来电和重启；本次模拟器操作未形成可靠后台证据，不能当作已实测通过或失败。

### R20 · P2 · 主要按钮与弱文本对比度偏低

**证据：样式数值计算与浅色页面视觉观察。** 主按钮固定白字；浅色 primary `#2FB77D` 的白字对比度约 2.56:1，深色 primary `#41D492` 配白字约 1.90:1。浅色弱文本 `#94A39A` 在白底约 2.64:1。图表还存在 9 单位字号，进一步增加阅读负担。

这里给出的是颜色计算值，不声称已完成整套无障碍标准认证；深色模式尚未实测。

**位置：** [AppButton.tsx:52](<../../apps/mobile/src/components/AppButton.tsx#L52>)、[colors.ts:28](<../../apps/mobile/src/theme/colors.ts#L28>)、[DataDashboardSections.tsx:346](<../../apps/mobile/src/features/data/DataDashboardSections.tsx#L346>)。

**修复与验收：** 增加独立的按钮前景色 token；浅色按钮加深底色，深色按钮可使用深色字。提升关键信息字号与对比，补测选中、禁用、警告状态及较大字体。

### R21 · P1 · 同步游标以序列号前进，可能漏掉后提交的较小版本

2026-09-28 实施进展：代码与自动化回归已完成，见[本轮修复记录](../architecture/sync-device-service-boundaries-acceptance.md)。以下描述为修复前基线；设备或部署验收边界详见记录。

**证据：数据库并发时序推导，尚未在 PostgreSQL 实测。** change.version 为 bigserial；push 各自使用事务，没有发现按用户串行分配/提交的机制。pull 查询 `version > cursor`，直接推进到当前可见最大版本。序列分配先后不能保证事务提交先后。

可疑时序：同一用户的两个设备对不同日期实体操作。T1 分配 101 后未提交；T2 分配 102 并先提交；客户端 pull 看到 102，将 cursor 设为 102；T1 随后提交 101，后续查询只取大于 102，于是错过 101。选择不同日期是为了排除同一日汇总行锁对该例的串行化影响。

**位置：** [dataSync.ts:142](<../../apps/api/src/db/schema/dataSync.ts#L142>)、[dataSyncService.ts:41](<../../apps/api/src/modules/dataSync/dataSyncService.ts#L41>)、[push 事务:67](<../../apps/api/src/modules/dataSync/dataSyncService.ts#L67>)。

**修复与验收：** 用真实数据库的两个连接控制提交顺序，先确认上述场景；再采用按用户串行的版本分配/提交机制，或能够处理提交空洞的同步设计。不能仅增加一个全局 sequence 值来证明游标完整性。

## 文案与交互调整建议

以下是体验建议，不额外计入上述缺陷数量。轻松的“小花／收工／小账本”语气可以保留，但涉及保存、共享、错误和退出时，应让动作结果明确。

| 场景 | 当前问题 | 建议表达或行为 |
| --- | --- | --- |
| 首页“开始计时” | 点击只是进入另一个还需开始的页面，无障碍提示却说会立即计时 | 实现一次点击即开始；或改成“进入计时”，已有计时时显示“继续查看计时” |
| 登录 | “登录后同步云端能力”没有说明同步什么 | “登录后可同步训练、习惯和排便记录”，另提供具体字段与保留说明 |
| 好友完整共享 | “完整时长与感受”不能覆盖自定义文字等字段 | 逐项列出次数、时长、感受、形状、颜色、小信号文字；确认后再扩大范围 |
| 保存按钮 | “记好了”更像结果，且部分路径保存失败仍庆祝 | 可保留品牌语气，但区分“保存记录 / 保存中 / 保存失败，重试” |
| 可选感受 | 文案说“其他想记再记”，却默认写入“一般”；Watch 完成也填 normal | 支持“未填写”，或明确提示默认值并要求确认，避免把缺失信息变成真实感受 |
| 同步状态 | “已连接”无法说明数据是否保存到云端 | “已登录”；下方显示“最后同步于… / N 条待上传 / 暂时无法同步” |
| 提醒状态 | “已安排”仅凭设置，不能反映排程耗尽或无权限 | 展示“下次提醒…”、“需要开启通知”或“暂未安排成功” |
| 开发说明 | Mock、Expo Go、真机开发包等词出现在用户流中 | 开发构建保留，正式构建隐藏；用户侧描述功能是否可用及下一步 |
| 数据空态 | “没有记录”与“读取失败”混淆 | 无记录可引导开始记录；失败则说明“记录暂时读不出来”并提供重试 |
| 训练完成 | “可以下班”同时给出突出“再抬一组” | 主操作回到首页，根据当日进度调整次操作；保持建议量与行动引导一致 |

## 保留的设计基础与技术债

- 契约集中管理、类型检查、数据库迁移、共享权限的 none/summary/detailed 分层，为后续修复提供了基础。
- 现有代码已有 SecureStore 会话存储、本地 profile 隔离、outbox、同步事务和部分失败状态；重点是补齐这些模块之间的原子边界与用户反馈。
- 首页入口、卡片与图标语言较一致；数据页的今日总览、日历及日详情在本次小屏实测中能正常打开并显示合成训练记录。
- 训练页面已有疼痛/不适时停止的提示，应保留并确保停止操作实际可达。
- 完整同步与兼容 report snapshot 任务仍并行执行，旧高级趋势 screen 则已不再挂载。应分别评估仍在运行的兼容任务与废弃界面代码，清理前核对云端接口兼容性。
- 新增测试应集中在竞态、故障恢复、隐私投影和关键用户路径，避免只验证 happy path 或照抄实现。

## 修复顺序与后续验收

1. **保护身份和数据可靠性：** R02、R03、R04、R05、R08、R09；同批处理 R10 的刷新失败分类，补真实数据库并发测试确认或排除 R21。HTTP 重试和 Watch 两端回执必须纳入修复范围。
2. **在 API 对外开放前补齐防护：** R16；可与第一批并行推进，部署多实例时一并验证共享限流或网关方案。
3. **恢复正式产品闭环：** R01、R06、R07，确保能真实登录、知晓披露范围、随时暂停结束；小屏修复可独立并行，不必等待 Apple 权限。
4. **补齐记录恢复与状态反馈：** R11–R13、R17、R18，覆盖误操作、手动纠错、同步失败和读取失败。
5. **完善提醒与显示：** R14、R15、R19、R20，并统一关键文案。R19 先确定后台计时规则，再补真机验收。

当前发布目标是增长免费模式。真实登录、账号与数据边界、所发布功能的真机验收仍是前置条件；StoreKit、App Store Server API 和 Paywall 改为恢复付费模式前完成，不阻塞免费版本。以上顺序是实施依赖，不表示后排 P1 可以带问题发布。

仍需补做的验收：生产配置真实登录；双账号/双设备同步；真实 PostgreSQL 并发和保留期重置；实体 iPhone + Watch 离线重放；APNs/Expo 推送退出解绑；Live Activity 锁屏恢复；Android 系统返回；iOS 侧滑返回；自定义信号输入的软键盘避让；深色模式、大字体及屏幕阅读器；通知排程第三天以后行为。

这些未验证项不应标为通过，也不应仅凭静态疑点全部计作已确认缺陷。

## 附录：2026-09-28 隔离复现步骤

以下命令从仓库根目录执行，使用已安装依赖。先运行本次复核涉及的既有测试：

```bash
pnpm --filter @xiaotidu/mobile exec vitest run \
  src/api/__tests__/transport.test.ts \
  src/features/sync/__tests__/syncCoordinatorCore.test.ts \
  src/features/watch/__tests__/watchProtocol.test.ts
```

下面脚本调用当前业务函数，网络响应全部在进程内构造，不访问真实服务或账号。断言用于证明缺陷存在，脚本通过不表示修复通过；完成修复后应迁为正式回归测试，并改为断言正确行为。它不覆盖 Swift 回执、真实通知投递或 PostgreSQL 并发。

```bash
(
  cd apps/api || exit 1
  pnpm exec node --import tsx <<'NODE'
const assert = require('node:assert/strict');
const { Hono } = require('hono');
const { createRateLimitMiddleware } = require('./src/http/middleware/rateLimit.ts');
const { ApiTransport } = require('../mobile/src/api/transport.ts');
const {
  buildSedentaryReminderDates,
  defaultReminderSettings,
  isTimeInQuietHoursRanges,
} = require('../mobile/src/features/reminders/reminderLogic.ts');

(async () => {
  const app = new Hono();
  app.use('*', createRateLimitMiddleware({ maxRequests: 1, windowMs: 60000 }));
  app.get('/', c => c.text('ok'));
  app.onError((error, c) => c.json({ error: error.message }, error.statusCode || 500));
  const statuses = [];
  for (const token of ['invalid-a', 'invalid-a', 'invalid-b']) {
    const response = await app.request('/', {
      headers: { authorization: token, 'x-real-ip': '127.0.0.1' },
    });
    statuses.push(response.status);
  }
  assert.deepEqual(statuses, [200, 429, 200]);
  console.log('R16: changing invalid Authorization bypasses the limit', statuses);

  const settings = {
    ...defaultReminderSettings,
    sedentaryEnabled: true,
    sedentaryIntervalMinutes: 60,
    quietHoursRanges: [{ id: 'lunch', start: '12:00', end: '14:00' }],
  };
  const dates = buildSedentaryReminderDates(settings, new Date(2026, 8, 28, 0, 0));
  assert.deepEqual([...new Set(dates.map(d => d.getDate()))], [28, 29]);
  assert(dates.some(d => d.getHours() === 12 && d.getMinutes() === 0));
  assert(isTimeInQuietHoursRanges('12:00', settings));
  console.log('R14/R15: only two days are scheduled, including the quiet-hours start');

  let release401;
  let currentToken = 'synthetic-token-A';
  const sent = [];
  const transport = new ApiTransport({
    baseUrl: 'https://example.invalid',
    fetchImplementation: async (_, options) => {
      sent.push({ token: options.headers.authorization, body: JSON.parse(options.body) });
      if (sent.length === 1) return await new Promise(resolve => { release401 = resolve; });
      return new Response(JSON.stringify({ data: { ok: true } }), { status: 200 });
    },
  });
  transport.setSessionRefreshHandler(async () => currentToken);
  const request = transport.request('/data-sync/push', { parse: value => value }, {
    method: 'POST',
    token: currentToken,
    body: { owner: 'A', synthetic: true },
  });
  currentToken = 'synthetic-token-B';
  release401(new Response(JSON.stringify({ error: { code: 'unauthorized', message: 'test' } }), {
    status: 401,
  }));
  await request;
  assert.equal(sent[1].token, 'Bearer synthetic-token-B');
  assert.equal(sent[1].body.owner, 'A');
  console.log('R03: the original A body is retried with the B token', sent);
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
NODE
)
```

基线 `c07d487` 的预期缺陷表现：R16 请求状态依次为 200、429、200；R14/R15 仅生成 9 月 28、29 日且含 12:00 的候选提醒；R03 第二次发送使用 B 的合成令牌，body 仍归属 A。正式修复测试还需覆盖本文各项列出的失败分支与设备场景。
