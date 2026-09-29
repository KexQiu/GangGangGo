# Architecture v2 后续待办

更新日期：2026-09-29
当前基线：Hono + Drizzle 模块化 API、Expo 本地优先移动端、Watch 状态协议 v5 / 事件协议 v3
当前发布目标：增长免费模式；恢复付费模式单独排期。

本文是当前架构修复与发布工作的执行清单。问题依据与验收要求见[全项目审查报告（2026-09-28 修订）](../audits/2026-09-22-full-review.md)，设备证据统一记录在[真机验收总清单](./physical-device-acceptance-checklist.md)。旧“小队 / nudges / sharing”规划与旧版优先级不再作为当前事实源。

## 状态和优先级

与审查报告统一使用：

- `P0`：需立即处置的严重故障或已确认的重大数据安全事件。
- `P1`：公开测试或正式发布前必须解决或完成验收的关键项；条件项须注明对应功能开放前提。
- `P2`：应排期修复的体验、可恢复性或维护问题，按依赖安排，可与 P1 同批处理。
- `P3`：当前版本延期或仅在扩大产品范围时实施的事项。

优先级、实现状态和证据状态分别记录。当前没有已确认的 P0；R21 已在真实 PostgreSQL 复现并完成代码修复。下文“已具备的实现”中的勾选仅表示代码或配置存在，不代表通过本次验收或不存在缺陷。当前待办只有在修复提交、回归结果及所需设备证据齐备后才可关闭。

## 已具备的实现

### 工程与分层

- [x] `server.ts -> app.ts/createApiApp -> registerRoutes` 装配链与模块化 API。
- [x] contracts 作为请求、响应、移动端解析和 OpenAPI 的单一来源。
- [x] 好友域 service/policy/mapper/mock/types 与报告域 service/repository/mapper/mock 分层。
- [x] 账号生命周期独立为 `accountDataService.ts`，定时保留任务独立为 `storage/retentionService.ts`。
- [x] 云端查询使用 TanStack Query；Zustand 保存会话、本地领域状态和短期 UI 状态。
- [x] API client 按 auth、users、dataSync、friends、growth、push 拆分。
- [x] `ToiletRecordForm.tsx` 已拆分表单编排、字段组件、常量和样式。

Router 薄化仅部分完成。训练、账号和好友等路由仍承载业务与界面逻辑，不能标记为全部完成；剩余范围列入下方 P2 维护项。

### 安全与数据生命周期

- [x] request id、结构化请求日志、统一错误响应和安全响应头。
- [x] 默认 256 KiB 请求体限制与结构化 413。
- [x] 单进程固定窗口限流与结构化 429；身份选择存在 R16 绕过问题，防护尚未验收。
- [x] `GET /me/export`、`DELETE /me` 及移动端入口；双账号与真实环境回归仍待完成。
- [x] 健康/增长数据保留任务、过期会话/邀请/好友事件清理及相关文档。
- [x] preview/production 移动端 API 地址校验 HTTPS 且禁止 localhost。
- [x] 服务端生产配置禁止 Mock Apple 验证；移动端已接入原生授权入口并限制开发 Mock，R01 真机/生产配置验收仍待完成。

### 构建与自动化

- [x] contracts 编译为 ESM；API 生产入口为 `node dist/server.js`；API scripts 纳入类型检查。
- [x] 根目录固定 pnpm 10.32.1，Node 类型与 CI 使用 22。
- [x] `pnpm check` 包含构建、类型、lint、格式、测试、OpenAPI 和 iOS/Android Expo bundle。
- [x] CI 配置 PostgreSQL 17、迁移及 Drizzle 集成测试；现有覆盖不等于 R21 提交乱序已验证。
- [x] Apple CI 配置 iPhone、Watch App、Complication 模拟器构建和 Watch fixture/核心测试。

历史运行结果见审查报告。本次文档更新不宣称重新完成全量门禁、签名安装或真机验收。

## P1：身份、数据与公开服务边界

以下编号沿用审查报告；状态注明已修复的条目以链接中的自动化证据为准，未注明通过的真机验收仍待完成。

| 编号 | 工作 | 当前状态 | 关键关闭条件 |
| --- | --- | --- | --- |
| R02、R03 | 会话归属贯穿 auth store、完整同步和 HTTP 自动刷新/重试 | 代码已修复；[回归记录](./session-ownership-acceptance.md) | 延迟成功、失败与 401 均不能覆盖新会话或跨账号重发旧 body；同会话令牌轮换仍可用 |
| R04 | Watch 事件绑定账号/profile/计时 session，持久化幂等 | 代码已实现；训练开始归属、计时归属与状态顺序保护见[本轮回归](./sync-device-service-boundaries-acceptance.md)，配对真机待验收 | 旧事件、换号、重复投递和跨重启不修改新的状态 |
| R05 | 设备级推送解绑与服务端有效绑定校验 | 代码已实现；会话绑定与离线撤销见[本轮回归](./sync-device-service-boundaries-acceptance.md)，真实投递待验收 | 退出、匿名态、换号失败和多设备场景不会继续使用已撤销的绑定；明确离线解绑策略与验证边界 |
| R08 | 保存结果可靠反馈，补齐 Watch 两端回执语义 | 代码已实现；[回归与待验收边界](./save-ack-acceptance.md) | 落库成功才确认完成；临时失败保留重试；永久拒绝不得换账号重放；覆盖实时与离线发送 |
| R09 | 远端合并保护本地编辑/删除与待提交 outbox | 代码已实现；[回归与冲突规则](./local-edit-sync-acceptance.md) | pull 在途产生的修改不被旧响应覆盖，最终云端结果符合冲突策略 |
| R21 | 验证数据库版本分配与提交顺序 | 已复现并修复；[真实 PostgreSQL 回归](./sync-device-service-boundaries-acceptance.md) | 两连接控制不同日期实体的提交顺序，验证是否漏同步；确认后修复并回归，排除时保留证据 |
| R16 | 基础限流、桶数量限制及可信代理边界 | 代码已实现；真实来源、共享预算及数量上限见[本轮回归](./sync-device-service-boundaries-acceptance.md)，部署代理边界待验收 | 轮换无效 token 仍受基础预算约束；网关方案验证无法绕过直连，多实例使用一致限流 |

R10 已与 R02/R03 同批修复：仅明确的凭证失效登出，暂时失败保持会话及本地资料，失败分类保留到 HTTP 层。离线启动恢复也校验并沿用已保存的用户/profile 归属。

## P1：免费版本发布闭环

- [ ] R01：原生 Sign in with Apple、同步说明衔接和 Mock 边界已实现，见[实施记录](./apple-login-acceptance.md)；签名设备及生产配置登录、取消、失效、退出重登和邀请加入仍待验收。
- [ ] R06：登录前同步说明、保留期和好友字段说明已实现，见[本轮记录](./small-screen-privacy-acceptance.md)；已衔接 R01 原生入口，隐私说明与真实授权交互仍需设备验收。
- [ ] R07：训练/计时固定操作栏、可滚动正文和安全区布局已实现，见[本轮记录](./small-screen-privacy-acceptance.md)；小屏、大字体原生视觉与交互验收待完成。
- [ ] 完成邀请分享与 onboarding 验收；增长免费模式不出现付费锁和购买入口。
- [ ] 建立隔离 Preview API/PostgreSQL、独立 secrets、迁移和清理任务，验证 HTTPS、错误展示与 R16 防护。
- [ ] 完成双账号/双设备同步、好友权限、账号导出/删除及本地数据保留回归。
- [ ] 完成所发布 Watch 功能的离线恢复、重复事件、haptic、Complication 和系统刷新验收。
- [ ] 完成所发布 Live Activity 功能的签名安装、启动、更新、结束及重启恢复验收。
- [ ] 远程 Push 开放前完成证书、投递、失败重试、回执与 R05 解绑验收；若延期，需明确收缩功能范围并同步用户说明。
- [ ] 生产发布前配置 API/PostgreSQL、连接池、最小权限、密钥轮换、指标告警、备份恢复、回滚和故障手册。
- [ ] 把数据同步、好友共享、保留和删除规则同步到用户可见隐私政策，明确审计保留和备份擦除流程，完成 App Store/TestFlight 发布材料。

Apple Developer 权限与设备签名是相应能力的外部依赖，不阻塞代码缺陷修复、隔离 Preview 和本地回归。以上事项仍待完成，不因文档列出即视为验收通过。

## P2：恢复能力、体验与维护

- [x] R10：暂时断网不强制登出，已通过受控网络失败与离线恢复测试；真机验收见[回归记录](./session-ownership-acceptance.md)。
- [ ] R11：日详情已接入记录编辑/删除页，统计和同步队列回归见[实施记录](./toilet-record-recovery-acceptance.md)；原生完整操作路径及双设备同步待验收。
- [ ] R12、R13：已实现持久化草稿、固定结束时间及手机/手表完成标记，故障回滚、恢复与时间边界见[实施记录](./toilet-record-recovery-acceptance.md)；手势离开、真实杀进程与配对手表待验收。
- [ ] R17、R18：已分离登录、完整同步和本地读取状态，提供待上传数量、完整同步时间、错误与重试，见[实施记录](./sync-status-read-recovery-acceptance.md)；真实断网、双账号和原生读取失败交互待验收。
- [ ] R14、R15：确定长期提醒策略，补排、勿扰边界和第三天以后行为均需验收。
- [ ] R19：先确定训练后台暂停或继续规则，再实现时间校准与真机验收。
- [ ] R20：修正按钮/文字对比度与小字号，补深色、大字体和关键操作状态验收。
- [ ] Router 薄化：按实际变更需要逐步迁出训练、账号、好友等路由的业务逻辑，不为目录统一进行无关重写。
- [x] 上线前清理旧报告快照同步、报告 API/契约/表、无入口页面、旧路由及历史格式兼容；SQLite 与 PostgreSQL 已整理为初始基线，见[数据库基线](./database-baseline.md)。
- [ ] 将审查中的关键竞态与故障复现迁为正式回归测试；保存提交、命令和结果，替换临时文件证据。

## P3：条件商业化与延期范围

恢复 `COMMERCIAL_MODE=paid`、重新开放购买入口前，必须完成以下项目；它们不阻塞当前增长免费版本：

- [ ] 真实 StoreKit 购买、恢复购买、取消及权益生命周期。
- [ ] App Store Server API、Server Notifications 和服务端交易校验。
- [ ] Paywall、价格/订阅说明及付费模式完整回归。

其余延期范围：Android 完整适配与商店发布、社区、自由聊天、AI、当前 v0.2 之外的新健康领域和 UI 重设计。重新纳入发布范围时再调整优先级与验收要求。

## 推荐执行顺序

1. R02、R03、R04、R05、R08、R09、R10、R21 已有代码与自动化回归；推进双设备同步、Watch 原生构建与配对设备、真实推送退出解绑验收。R21 已通过真实 PostgreSQL 提交乱序回归。
2. 准备隔离 Preview，在 API 对外开放前验证 R16 的可信代理配置、直连来源限制与共享数据库预算；完成 R07 固定操作栏的小屏与大字体原生验收。
3. R01 原生登录与 R06 同步说明已接通；完成签名设备登录、隐私说明交互、双账号/双设备回归，以及所发布 Apple 能力的端到端验收。
4. R11–R13、R17/R18 代码已实现，完成记录纠错、草稿恢复和同步状态的原生验收；下一批优先 R14、R15 的提醒续排与勿扰边界。发布候选执行 `pnpm check`、Expo dependency check、Apple scheme 和真机清单，记录失败、跳过与待验证项。
5. 完成生产部署、备份恢复、隐私政策及商店材料；商业化按付费模式的独立条件推进。
